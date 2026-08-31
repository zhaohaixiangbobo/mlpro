import pandas as pd
import os
import io
import json
import joblib
from joblib import parallel_backend
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score, learning_curve
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, mean_squared_error, r2_score, silhouette_score, mean_absolute_error, calinski_harabasz_score, davies_bouldin_score
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, LabelEncoder
import numpy as np

# Optional imports for XGBoost and LightGBM
try:
    from xgboost import XGBClassifier
except ImportError:
    XGBClassifier = None

try:
    from lightgbm import LGBMClassifier
except ImportError:
    LGBMClassifier = None

# 自动调参的预置参数网格（小网格，保证速度）
AUTO_TUNE_GRIDS = {
    "逻辑回归": {"C": [0.1, 1.0, 10.0]},
    "决策树": {"max_depth": [3, 5, None]},
    "随机森林": {"n_estimators": [50, 100], "max_depth": [None, 5]},
    "支持向量机 SVM": {"C": [0.1, 1.0, 10.0], "kernel": ["rbf", "linear"]},
    "岭回归": {"alpha": [0.1, 1.0, 10.0]},
    "Lasso": {"alpha": [0.1, 1.0, 10.0]},
    "随机森林回归": {"n_estimators": [50, 100]},
    "GBDT回归": {"n_estimators": [50, 100], "learning_rate": [0.05, 0.1]},
}

# 元参数：由后端流程单独处理（划分测试集、随机种子、自动调参开关），
# 不能透传给 sklearn 模型构造函数，否则会抛 unexpected keyword argument
META_PARAM_KEYS = ("test_file", "random_state", "auto_tune")


def strip_meta_params(params: dict, extra_exclude=()):
    """剔除元参数后返回可直接传给 sklearn 构造函数的参数字典"""
    excluded = set(META_PARAM_KEYS) | set(extra_exclude)
    return {k: v for k, v in (params or {}).items() if k not in excluded}


class MLService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    def _load_meta(self, filename: str):
        meta_path = os.path.join(self.data_dir, f"{filename}.meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def load_data(self, filename: str):
        file_path = os.path.join(self.data_dir, filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File {filename} not found")

        if filename.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif filename.endswith(".xlsx"):
            df = pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file format")
        return df

    def preprocess_data(self, df: pd.DataFrame, steps: list, label_col: str = None) -> pd.DataFrame:
        """
        Apply a list of preprocessing steps to the DataFrame.
        steps: list of dicts, e.g. [{"method": "mean", "params": {"columns": ["Age"]}}]
        label_col: Name of the label column to exclude from processing
        """
        for i, step in enumerate(steps):
            try:
                method = step.get("method")
                params = step.get("params", {})
                columns = params.get("columns", [])

                # If columns is empty, select applicable columns based on method
                if not columns:
                    if method in ["mean", "median", "mode", "standard", "minmax"]:
                        # Numeric columns only
                        columns = df.select_dtypes(
                            include=[np.number]).columns.tolist()
                    elif method == "drop":
                        # All columns
                        columns = df.columns.tolist()

                # Ensure columns exist in df
                columns = [c for c in columns if c in df.columns]

                # Exclude label column from processing
                if label_col and label_col in columns:
                    columns.remove(label_col)

                if not columns:
                    continue

                if method == "drop":
                    df = df.dropna(subset=columns)

                elif method in ("mean", "median", "mode"):
                    # 按 dtype 分组分别填充：数值列用指定策略，文本列统一用众数填充。
                    # 避免把文本列和数值列丢进同一个 SimpleImputer（混合列会返回 object 数组，
                    # 赋值回 DataFrame 后数值列变成非数值类型，导致后续特征筛选丢失全部数值特征）。
                    num_cols = [
                        c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
                    cat_cols = [c for c in columns if c not in num_cols]
                    if num_cols:
                        # mean/median 只对数值列有意义；mode 对数值列同样用众数填充
                        num_strategy = method if method in (
                            "mean", "median") else "most_frequent"
                        imputer = SimpleImputer(strategy=num_strategy)
                        df[num_cols] = imputer.fit_transform(df[num_cols])
                    if cat_cols:
                        imputer = SimpleImputer(strategy="most_frequent")
                        df[cat_cols] = imputer.fit_transform(df[cat_cols])

                elif method == "standard":
                    scaler = StandardScaler()
                    df[columns] = scaler.fit_transform(df[columns])

                elif method == "minmax":
                    scaler = MinMaxScaler()
                    df[columns] = scaler.fit_transform(df[columns])

                else:
                    raise ValueError(f"Unknown preprocessing method: {method}")

            except Exception as e:
                # Re-raise with step info
                raise RuntimeError(f"Step {i+1} ({method}): {str(e)}")

        return df

    def _evaluate_model(self, model, X_test, y_test, task_type, label_map: dict = None):
        """
        Evaluate model based on task type
        label_map: {encoded_label: original_label_str} for classification display
        """
        if task_type == "classification":
            y_pred = model.predict(X_test)
            acc = accuracy_score(y_test, y_pred)
            cm = confusion_matrix(y_test, y_pred).tolist()
            result = {
                "type": "classification",
                "accuracy": acc,
                "confusion_matrix": cm,
                "report": classification_report(y_test, y_pred, output_dict=True)
            }
            # Probability output (sampled rows)
            proba_sample = []
            if hasattr(model, "predict_proba"):
                try:
                    proba = model.predict_proba(X_test)
                    classes = list(getattr(model, "classes_", []))
                    n = min(10, len(proba))
                    idxs = np.linspace(0, len(proba) - 1, n).astype(int)
                    for i in idxs:
                        yt = y_test.iloc[i] if hasattr(
                            y_test, "iloc") else y_test[i]

                        def disp(v):
                            if label_map:
                                return label_map.get(int(v), str(v))
                            return str(v)
                        row = {"actual": disp(
                            yt), "predicted": disp(y_pred[i])}
                        for j, c in enumerate(classes):
                            row[f"p({disp(c)})"] = round(float(proba[i][j]), 4)
                        proba_sample.append(row)
                except Exception:
                    proba_sample = []
            result["probabilities"] = proba_sample
            return result

        elif task_type == "regression":
            y_pred = model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            # Residual sample for plots (max 300 points)
            residuals = []
            try:
                n = min(300, len(y_test))
                idxs = np.linspace(0, len(y_test) - 1, n).astype(int)
                for i in idxs:
                    yt = y_test.iloc[i] if hasattr(
                        y_test, "iloc") else y_test[i]
                    actual = float(yt)
                    pred = float(y_pred[i])
                    residuals.append(
                        {"actual": actual, "predicted": pred, "residual": round(pred - actual, 6)})
            except Exception:
                residuals = []
            return {
                "type": "regression",
                "mse": mse,
                "rmse": rmse,
                "mae": mae,
                "r2_score": r2,
                "prediction_head": y_pred[:10].tolist(),
                "residuals": residuals
            }

        elif task_type == "clustering":
            # For clustering, X_test is the data itself, y_test might be labels if available (not used here mostly)
            # We assume 'model' is already fitted
            labels = model.labels_ if hasattr(
                model, 'labels_') else model.predict(X_test)

            unique_labels = set(labels)
            n_clusters = len(unique_labels) - (1 if -1 in labels else 0)
            n_noise = list(labels).count(-1)

            metrics = {
                "type": "clustering",
                "n_clusters": n_clusters,
                "n_noise": n_noise,
            }

            if len(unique_labels) > 1:
                metrics["silhouette_score"] = silhouette_score(X_test, labels)
                metrics["calinski_harabasz_score"] = calinski_harabasz_score(
                    X_test, labels)
                metrics["davies_bouldin_score"] = davies_bouldin_score(
                    X_test, labels)
            else:
                metrics["silhouette_score"] = -1
                metrics["calinski_harabasz_score"] = -1
                metrics["davies_bouldin_score"] = -1

            if hasattr(model, 'inertia_'):
                metrics["inertia"] = model.inertia_

            if hasattr(model, 'cluster_centers_'):
                metrics["centers"] = model.cluster_centers_.tolist()

            return metrics

        return {}

    def save_model(self, model, node_id: str, le=None):
        """Save the trained model to disk. 分类模型同时保存 LabelEncoder 以便预测时还原原始标签"""
        models_dir = os.path.join(self.data_dir, "models")
        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, f"{node_id}.joblib")
        joblib.dump(model, model_path)
        if le is not None:
            joblib.dump(le, os.path.join(models_dir, f"{node_id}_le.joblib"))
        return model_path

    def load_label_encoder(self, node_id: str):
        """Load the saved LabelEncoder for a node, or None if not available."""
        le_path = os.path.join(self.data_dir, "models", f"{node_id}_le.joblib")
        if os.path.exists(le_path):
            return joblib.load(le_path)
        return None

    def load_model(self, node_id: str):
        """Load a trained model from disk."""
        models_dir = os.path.join(self.data_dir, "models")
        model_path = os.path.join(models_dir, f"{node_id}.joblib")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model for node {node_id} not found.")
        return joblib.load(model_path)

    def predict(self, node_id: str, data_file: str, preprocessing: list = None, algorithm_label: str = None, chain: list = None, column_map: dict = None):
        """
        Run prediction using a saved model.
        chain: 上游模型节点列表（链式模型预测）
        column_map: {model_feature: file_column} 列名映射
        """
        try:
            # 1. Load Data
            df = self.load_data(data_file)

            # 1.5 Apply column mapping (rename file columns to model features)
            if column_map:
                rename_map = {file_col: model_feat for model_feat, file_col in column_map.items(
                ) if file_col and file_col in df.columns}
                df = df.rename(columns=rename_map)

            # 2. Preprocessing
            if preprocessing:
                df = self.preprocess_data(df, preprocessing)

            # 2.5 Chain features
            if chain:
                df = self._apply_chain_features(df, chain, None)

            df_numeric = df.select_dtypes(include=[np.number])
            if df_numeric.empty:
                raise ValueError("No numeric data found for prediction")

            # 3. Load Model
            model = self.load_model(node_id)

            # 4. Predict
            # DBSCAN 等模型没有 predict 方法，只支持聚类分析
            if not hasattr(model, "predict"):
                raise ValueError(
                    "该模型不支持预测（DBSCAN 仅支持聚类分析，请使用 K-Means 等可预测的聚类算法）")
            # Align columns if possible or assume correct input
            # Ideally we should save feature names with the model to verify.
            # For now, we assume user uploads correct format.
            if hasattr(model, "feature_names_in_"):
                # Reorder columns to match training
                common_cols = [
                    c for c in model.feature_names_in_ if c in df_numeric.columns]
                if len(common_cols) < len(model.feature_names_in_):
                    missing = set(model.feature_names_in_) - set(common_cols)
                    raise ValueError(
                        f"预测数据缺少模型特征: {sorted(missing)}。请检查列名，或在预测页面使用列映射功能。")
                X = df_numeric[model.feature_names_in_]
            else:
                X = df_numeric

            predictions = model.predict(X)
            # 分类模型：用训练时保存的 LabelEncoder 把编码还原为原始标签值
            try:
                saved_le = self.load_label_encoder(node_id)
                if saved_le is not None:
                    predictions = saved_le.inverse_transform(predictions)
            except Exception:
                pass

            # 5. Save Results
            # Create a dataframe with predictions
            result_df = df.copy()
            result_df["prediction"] = predictions

            # Generate formatted filename
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M")
            original_name = os.path.splitext(data_file)[0]
            # Truncate original name to 10 chars to keep it short
            original_name_short = original_name[:10]

            # Map Chinese algorithm names to English abbreviations
            ALGO_NAME_MAP = {
                "逻辑回归": "LR",
                "决策树": "DT",
                "随机森林": "RF",
                "支持向量机 SVM": "SVM",
                "KNN": "KNN",
                "XGBoost": "XGBoost",
                "LightGBM": "LightGBM",
                "线性回归": "LinearRegression",
                "岭回归": "Ridge",
                "Lasso": "Lasso",
                "随机森林回归": "RFRegressor",
                "GBDT回归": "GBDTRegressor",
                "K-Means": "KMeans",
                "DBSCAN": "DBSCAN"
            }

            # Use algorithm label if provided, else generic 'Model'
            algo_tag = ALGO_NAME_MAP.get(
                algorithm_label, algorithm_label) if algorithm_label else "Model"
            # Sanitize tag
            algo_tag = "".join(c for c in algo_tag if c.isalnum())

            pred_filename = f"pred_{original_name_short}_{algo_tag}_{timestamp}.csv"
            # Handle excel extension if original was excel? For now output as csv is safer/simpler
            # But let's respect output format based on extension logic below

            if data_file.endswith(".xlsx"):
                pred_filename = pred_filename.replace(".csv", ".xlsx")

            pred_path = os.path.join(self.data_dir, pred_filename)

            if pred_filename.endswith(".csv"):
                result_df.to_csv(pred_path, index=False)
            else:
                result_df.to_excel(pred_path, index=False)

            # 写入 meta：标注为预测结果并记录来源文件（便于数据管理分组/清理）
            try:
                pred_meta = self._load_meta(data_file)
                pred_meta["filename"] = pred_filename
                pred_meta["role"] = "prediction"
                pred_meta["parent"] = data_file
                pred_meta["rows"] = len(result_df)
                with open(os.path.join(self.data_dir, f"{pred_filename}.meta.json"), "w", encoding="utf-8") as f:
                    json.dump(pred_meta, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

            return {
                "filename": pred_filename,
                "preview": result_df.head(10).to_dict(orient="records")
            }

        except Exception as e:
            raise RuntimeError(f"Prediction failed: {str(e)}")

    def get_model_features(self, node_id: str):
        """Return the feature names a trained model expects, if available."""
        model = self.load_model(node_id)
        return list(getattr(model, "feature_names_in_", []))

    def get_pca_data(self, filename: str, label_col: str = None):
        """
        Perform PCA dimensionality reduction for visualization.
        Returns: [{"x": 1.2, "y": -0.5, "label": "A"}, ...]
        """
        try:
            df = self.load_data(filename)

            # Auto-detect label if not provided
            if not label_col:
                meta = self._load_meta(filename)
                label_col = meta.get("label_column")

            # Select numeric columns
            df_numeric = df.select_dtypes(include=[np.number])

            # Handle labels
            labels = None
            if label_col and label_col in df.columns:
                labels = df[label_col].fillna("Unknown").astype(str).tolist()
                # Remove label from features if it is in numeric
                if label_col in df_numeric.columns:
                    df_numeric = df_numeric.drop(columns=[label_col])

            # 1. Handle Infinite values and NaNs (Critical Fix)
            # Replace inf/-inf with NaN, then drop rows with NaNs
            df_numeric = df_numeric.replace([np.inf, -np.inf], np.nan).dropna()

            # 2. Check data shape after cleaning
            if df_numeric.empty or len(df_numeric) < 2:
                # PCA requires at least 2 samples
                print("PCA Skipped: Not enough samples (need >= 2)")
                return []

            # Check feature count
            if df_numeric.shape[1] < 2:
                print(
                    f"PCA Skipped: Not enough features (need >= 2, got {df_numeric.shape[1]})")
                return []

            # Update labels to match the filtered data (if rows were dropped)
            if labels and len(labels) != len(df_numeric):
                # Align labels using the index of the remaining rows
                if label_col:
                    labels = df.loc[df_numeric.index, label_col].fillna(
                        "Unknown").astype(str).tolist()

            # Standardize
            scaler = StandardScaler()
            data_scaled = scaler.fit_transform(df_numeric)

            # PCA
            pca = PCA(n_components=2)
            coords = pca.fit_transform(data_scaled)

            result = []
            for i in range(len(coords)):
                point = {
                    "x": float(coords[i][0]),
                    "y": float(coords[i][1])
                }
                if labels:
                    point["label"] = labels[i]
                result.append(point)

            return result

        except Exception as e:
            # Log error but don't crash the whole dashboard request
            import traceback
            traceback.print_exc()
            print(f"PCA Error: {str(e)}")
            return []

    def _fit_clustering(self, data_file: str, algorithm: str, params: dict, preprocessing: list = None):
        """
        Shared helper: load data, apply preprocessing, fit a clustering model.
        Returns (model, X_numeric_cleaned, label_col)
        """
        df = self.load_data(data_file)
        meta = self._load_meta(data_file)
        label_col = meta.get("label_column")

        if preprocessing:
            df = self.preprocess_data(df, preprocessing, label_col)

        df_numeric = df.select_dtypes(include=[np.number])
        if label_col and label_col in df_numeric.columns:
            df_numeric = df_numeric.drop(columns=[label_col])
        if df_numeric.empty:
            raise ValueError("No numeric data found for clustering")
        df_numeric = df_numeric.replace([np.inf, -np.inf], np.nan).dropna()
        if len(df_numeric) < 2:
            raise ValueError("Not enough samples for clustering (need >= 2)")

        # 聚类不支持 GridSearchCV 自动调参，auto_tune 等元参数需在此剔除
        model_params = strip_meta_params(params)
        random_state = params.get("random_state", 42)

        if algorithm == "K-Means":
            model = KMeans(**model_params, random_state=random_state)
        elif algorithm == "DBSCAN":
            model = DBSCAN(**model_params)
        else:
            raise ValueError(f"Unknown clustering algorithm: {algorithm}")
        model.fit(df_numeric)
        return model, df_numeric

    def get_cluster_visualization(self, data_file: str, algorithm: str, params: dict, preprocessing: list = None):
        """
        Run clustering and return PCA-projected points colored by cluster label.
        Returns: {"points": [{"x","y","cluster"}], "centers": [{"x","y","cluster"}],
                  "n_clusters": n, "n_noise": n}
        """
        try:
            model, X = self._fit_clustering(
                data_file, algorithm, params, preprocessing)
            labels = model.labels_ if hasattr(
                model, "labels_") else model.predict(X)
            labels = np.asarray(labels)

            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            pca = PCA(n_components=2)
            coords = pca.fit_transform(X_scaled)

            points = [
                {"x": float(c[0]), "y": float(c[1]), "cluster": int(labels[i])}
                for i, c in enumerate(coords)
            ]
            centers = []
            if hasattr(model, "cluster_centers_"):
                centers_pc = pca.transform(
                    scaler.transform(model.cluster_centers_))
                centers = [
                    {"x": float(c[0]), "y": float(c[1]), "cluster": int(i)}
                    for i, c in enumerate(centers_pc)
                ]
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            return {
                "points": points,
                "centers": centers,
                "n_clusters": int(n_clusters),
                "n_noise": int(list(labels).count(-1)),
                "algorithm": algorithm,
            }
        except Exception as e:
            raise RuntimeError(f"Cluster visualization failed: {str(e)}")

    @staticmethod
    def _autofit_excel(writer, max_width: int = 30, sample_rows: int = 200):
        """粗略自适应列宽并冻结表头，导出后可直接投屏演示。

        中文按 2 个字符宽度估算；仅采样前 sample_rows 行，
        避免大表逐单元格扫全量拖慢导出。
        """
        for ws in writer.book.worksheets:
            for col in ws.columns:
                letter = col[0].column_letter
                width = 0
                for cell in col[:sample_rows + 1]:
                    if cell.value is None:
                        continue
                    text = str(cell.value)
                    width = max(width, sum(
                        2 if ord(ch) > 127 else 1 for ch in text))
                ws.column_dimensions[letter].width = min(
                    max(width + 2, 8), max_width)
            ws.freeze_panes = "A2"

    def export_cluster_excel(self, data_file: str, algorithm: str, params: dict,
                             preprocessing: list = None, cluster_names: dict = None):
        """
        导出聚类结果 Excel（双 Sheet），返回 (BytesIO, 建议文件名)。

        Sheet1「聚类明细」：原始数据 + 所属簇编号/簇名称，可逐行落地到具体客户。
                            这里刻意用未预处理的原始数据，保留业务可读量纲
                            （标准化后的 z 分数无法给业务人员看）。
        Sheet2「分群汇总」：每簇一行，数值列取均值、文本列取众数，附客户数与占比，
                            最后追加「总体」基线行，便于对比“这一群比整体高多少”。
        """
        model, X = self._fit_clustering(
            data_file, algorithm, params, preprocessing)
        labels = model.labels_ if hasattr(
            model, "labels_") else model.predict(X)
        labels = np.asarray(labels)

        # X 经过预处理与 dropna，index 是原数据的子集；用 index 对齐回原始数据
        df_raw = self.load_data(data_file)
        detail = df_raw.loc[X.index].copy()

        # 避开与原数据重名的列，否则 DataFrame.insert 会抛 already exists
        def _uniq(name: str) -> str:
            candidate, suffix = name, 2
            while candidate in df_raw.columns:
                candidate = f"{name}_{suffix}"
                suffix += 1
            return candidate

        col_cluster = _uniq("所属簇")
        col_cname = _uniq("簇名称")

        def _name_of(cid):
            """簇编号转展示名。cluster_names 可由前端传入业务画像名。"""
            if cid == -1:
                return "噪声点"
            if cluster_names:
                return (cluster_names.get(str(cid))
                        or cluster_names.get(cid) or f"簇 {cid}")
            return f"簇 {cid}"

        detail.insert(0, col_cluster, labels)
        detail.insert(1, col_cname, [_name_of(c) for c in labels])

        # 按 dtype 拆分汇总方式：数值取均值，文本取众数
        num_cols = [c for c in df_raw.columns
                    if pd.api.types.is_numeric_dtype(df_raw[c])]
        cat_cols = [c for c in df_raw.columns if c not in num_cols]

        # 近似唯一的标识列（如零售户编码）取众数没有业务含义，汇总时置“-”
        row_total = len(df_raw)
        id_like = {c for c in cat_cols
                   if row_total and df_raw[c].nunique(dropna=True) > max(20, 0.5 * row_total)}

        def _mode(series: pd.Series):
            series = series.dropna()
            if series.empty:
                return None
            modes = series.mode()
            return modes.iloc[0] if not modes.empty else None

        total = len(detail)
        # DBSCAN 的噪声簇（-1）排到末尾，保证正常簇从 0 开始依序展示
        cluster_ids = sorted(set(labels.tolist()), key=lambda c: (c == -1, c))
        rows = []
        for cid in cluster_ids:
            sub = detail[detail[col_cluster] == cid]
            row = {
                col_cluster: cid,
                col_cname: _name_of(cid),
                "客户数": len(sub),
                "占比": round(len(sub) / total * 100, 2) if total else 0,
            }
            for col in num_cols:
                row[col] = round(float(sub[col].mean()),
                                 2) if len(sub) else None
            for col in cat_cols:
                row[col] = "-" if col in id_like else _mode(sub[col])
            rows.append(row)

        # 总体基线行：讲“这群毛利率 22.4%，整体才 15.3%”比单报结果更有说服力
        overall = {col_cluster: "-", col_cname: "总体",
                   "客户数": total, "占比": 100.0 if total else 0}
        for col in num_cols:
            overall[col] = round(float(detail[col].mean()),
                                 2) if total else None
        for col in cat_cols:
            overall[col] = "-" if col in id_like else _mode(detail[col])
        rows.append(overall)

        summary = pd.DataFrame(rows)
        ordered = [col_cluster, col_cname, "客户数",
                   "占比"] + num_cols + cat_cols
        summary = summary[[c for c in ordered if c in summary.columns]]
        summary = summary.rename(columns={"占比": "占比_%"})

        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            detail.to_excel(writer, sheet_name="聚类明细", index=False)
            summary.to_excel(writer, sheet_name="分群汇总", index=False)
            self._autofit_excel(writer)
        buf.seek(0)

        base = os.path.splitext(os.path.basename(data_file))[0]
        return buf, f"{base}_聚类结果.xlsx"

    def kmeans_elbow(self, data_file: str, params: dict, preprocessing: list = None, k_max: int = 10):
        """
        K-Means elbow method: inertia & silhouette for k = 1..k_max.
        Returns: {"ks": [...], "inertia": [...], "silhouette": [...], "recommended_k": int|None}
        """
        try:
            # n_clusters 由循环变量 k 提供，其余元参数一并剔除
            model_params = strip_meta_params(
                params, extra_exclude=("n_clusters",))
            random_state = params.get("random_state", 42)

            df = self.load_data(data_file)
            meta = self._load_meta(data_file)
            label_col = meta.get("label_column")
            if preprocessing:
                df = self.preprocess_data(df, preprocessing, label_col)
            df_numeric = df.select_dtypes(include=[np.number])
            if label_col and label_col in df_numeric.columns:
                df_numeric = df_numeric.drop(columns=[label_col])
            df_numeric = df_numeric.replace([np.inf, -np.inf], np.nan).dropna()
            if len(df_numeric) < 2:
                raise ValueError("Not enough samples for elbow analysis")

            ks, inertia, silhouette = [], [], []
            for k in range(1, int(k_max) + 1):
                km = KMeans(n_clusters=k, **model_params,
                            random_state=random_state)
                km.fit(df_numeric)
                ks.append(k)
                inertia.append(float(km.inertia_))
                if k >= 2 and len(set(km.labels_)) > 1:
                    try:
                        sil = float(silhouette_score(df_numeric, km.labels_))
                    except Exception:
                        sil = -1.0
                    silhouette.append(round(sil, 4))
                else:
                    silhouette.append(None)

            recommended_k = None
            valid = [(k, s) for k, s in zip(ks, silhouette) if s is not None]
            if valid:
                recommended_k = max(valid, key=lambda x: x[1])[0]
            return {
                "ks": ks,
                "inertia": [round(v, 4) for v in inertia],
                "silhouette": silhouette,
                "recommended_k": recommended_k,
            }
        except Exception as e:
            raise RuntimeError(f"K-Means elbow analysis failed: {str(e)}")

    def _apply_chain_features(self, df: pd.DataFrame, chain: list, label_col: str = None) -> pd.DataFrame:
        """
        Apply chain model predictions as extra features (支持多数据源/多上游模型 stacking).
        chain: list of [{"node_id": str, "preprocessing": list, "algorithm_label": str,
                         "data_file": str (optional, 独立数据源)}]
        """
        for c in chain:
            node_id = c.get("node_id")
            if not node_id:
                continue
            c_pre = c.get("preprocessing") or []
            c_file = c.get("data_file")
            if c_file:
                # 独立数据源：链式模型在自己的数据源上预测
                c_df = self.load_data(c_file)
                c_label = label_col
                if c_label and c_label not in c_df.columns:
                    c_label = None
                if c_pre:
                    c_df = self.preprocess_data(c_df, c_pre, c_label)
            else:
                c_df = df.copy()
                if c_pre:
                    c_df = self.preprocess_data(c_df, c_pre, label_col)
            c_numeric = c_df.select_dtypes(include=[np.number])
            if label_col and label_col in c_numeric.columns:
                c_numeric = c_numeric.drop(columns=[label_col])
            if c_numeric.empty:
                raise ValueError(f"链式模型 {node_id} 无可用的数值特征")
            c_model = self.load_model(node_id)
            if hasattr(c_model, "feature_names_in_"):
                common = [
                    f for f in c_model.feature_names_in_ if f in c_numeric.columns]
                missing = set(c_model.feature_names_in_) - set(common)
                if missing:
                    raise ValueError(f"链式模型 {node_id} 缺少特征: {sorted(missing)}")
                c_X = c_numeric[c_model.feature_names_in_]
            else:
                c_X = c_numeric
            chain_pred = c_model.predict(c_X)
            if len(chain_pred) != len(df):
                raise ValueError(
                    f"链式模型 {node_id} 预测行数 ({len(chain_pred)}) 与主数据行数 ({len(df)}) 不一致，"
                    f"请检查各分支数据是否对齐（如缺失值处理方式一致）"
                )
            df[f"chain_pred_{node_id}"] = chain_pred
        return df

    def export_holdout_test(self, df_test: pd.DataFrame, data_file: str) -> str:
        """
        将训练时自动划分出的留出测试集导出为文件（含 meta），
        供模型预测页直接选用，无需手动划分/上传。
        返回导出的文件名。
        """
        base = os.path.splitext(data_file)[0]
        ext = os.path.splitext(data_file)[1] or ".csv"
        fname = f"{base}_auto_test{ext}"
        fpath = os.path.join(self.data_dir, fname)
        if ext.lower() == ".csv":
            df_test.to_csv(fpath, index=False)
        else:
            df_test.to_excel(fpath, index=False)

        meta = self._load_meta(data_file)
        meta["filename"] = fname
        meta["role"] = "auto_test"
        meta["parent"] = data_file
        meta["rows"] = len(df_test)
        with open(os.path.join(self.data_dir, f"{fname}.meta.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        return fname

    def run_algorithm(self, data_file: str, algorithm: str, params: dict, preprocessing: list = None, node_id: str = None, chain: list = None):
        try:
            df = self.load_data(data_file)
            meta = self._load_meta(data_file)
            label_col = meta.get("label_column")

            # 1. Preprocessing
            if preprocessing:
                df = self.preprocess_data(df, preprocessing, label_col)

            # 1.5 Chain: 上游模型的预测结果作为额外特征（模型链式建模）
            if chain:
                df = self._apply_chain_features(df, chain, label_col)

            df_numeric = df.select_dtypes(include=[np.number])
            if df_numeric.empty:
                raise ValueError("No numeric data found")

            result = {}

            # Classification Algorithms
            classification_algos = ["逻辑回归", "决策树", "随机森林",
                                    "支持向量机 SVM", "KNN", "XGBoost", "LightGBM"]
            # Regression Algorithms
            regression_algos = ["线性回归", "岭回归", "Lasso", "随机森林回归", "GBDT回归"]
            # Clustering Algorithms
            clustering_algos = ["K-Means", "DBSCAN"]

            model = None
            X_test = None
            y_test = None
            task_type = None
            auto_test_file = None  # 默认划分策略下导出的留出测试集文件名
            skipped_test = 0  # 因类别不在训练集中而被剔除的测试样本数

            if algorithm in classification_algos or algorithm in regression_algos:
                # Supervised Learning
                if not label_col:
                    raise ValueError(
                        f"Algorithm {algorithm} requires a Label column. Please set a label in Data Management.")

                # Check for explicit test file
                test_file = params.get("test_file")
                random_state = params.get("random_state", 42)

                # Remove common params that are not model specific or handled separately
                model_params = strip_meta_params(params)

                # Prepare Train Data
                if label_col not in df.columns:
                    raise ValueError(
                        f"Label column {label_col} not found in data")

                # Validate Label Type for Regression
                if algorithm in regression_algos:
                    if not pd.api.types.is_numeric_dtype(df[label_col]):
                        raise ValueError(f"回归算法需要一个数值型Label列")

                y = df[label_col]
                X = df_numeric.drop(columns=[label_col], errors='ignore')

                # Encode Label if Classification
                le = None
                if algorithm in classification_algos:
                    le = LabelEncoder()
                    y = le.fit_transform(y)

                if X.empty:
                    raise ValueError("No features left after dropping label")

                if test_file:
                    # Explicit Test Set Strategy
                    # Load Test Data
                    df_test = self.load_data(test_file)

                    # Apply Preprocessing to Test Data (SAME AS TRAIN)
                    if preprocessing:
                        df_test = self.preprocess_data(
                            df_test, preprocessing, label_col)

                    df_test_numeric = df_test.select_dtypes(
                        include=[np.number])

                    if label_col not in df_test.columns:
                        raise ValueError(
                            f"Label column {label_col} not found in test data")

                    y_test = df_test[label_col]

                    # Transform Test Labels if Classification
                    if algorithm in classification_algos and le is not None:
                        # Handle unseen labels by filtering or erroring?
                        # For simplicity, we assume test labels are subset of train labels or we let it error if not found.
                        # Or better: fit on combined, but that leaks info.
                        # Standard way: fit on train, transform test.
                        try:
                            y_test = le.transform(y_test)
                        except ValueError as e:
                            # Fallback or meaningful error
                            raise ValueError(
                                f"Test data contains labels not seen in training data: {str(e)}")

                    X_test = df_test_numeric.drop(
                        columns=[label_col], errors='ignore')

                    # Align columns (Test set must have same columns as Train set)
                    # Get common columns
                    common_cols = X.columns.intersection(X_test.columns)
                    X = X[common_cols]
                    X_test = X_test[common_cols]

                    X_train = X
                    y_train = y
                    # X_test, y_test are already set

                else:
                    # Default Split Strategy: 自动划分 80/20，并把留出测试集导出为文件，
                    # 模型预测页可直接选用（无需手动划分/上传）
                    df_train, df_test = train_test_split(
                        df, test_size=0.2, random_state=random_state)
                    auto_test_file = None
                    try:
                        auto_test_file = self.export_holdout_test(
                            df_test, data_file)
                    except Exception:
                        auto_test_file = None
                    if le is not None:
                        # 重新基于训练集 fit，保证编码类别连续（0..k-1），
                        # 否则划分后缺失的类别会造成编码空洞，XGBoost/LightGBM 会报
                        # "Invalid classes inferred from unique values of y"
                        le = LabelEncoder()
                        y_train = le.fit_transform(df_train[label_col])
                        # 测试集可能包含训练集中未出现的低频类别，
                        # 剔除这些样本以保证评估可用（结果中会记录数量）
                        seen_classes = set(le.classes_)
                        test_mask = df_test[label_col].isin(seen_classes)
                        skipped_test = int((~test_mask).sum())
                        if skipped_test:
                            df_test = df_test[test_mask]
                        y_test = le.transform(df_test[label_col])
                    else:
                        y_train = df_train[label_col]
                        y_test = df_test[label_col]
                    X_train = df_train.select_dtypes(include=[np.number]).drop(
                        columns=[label_col], errors='ignore')
                    X_test = df_test.select_dtypes(include=[np.number]).drop(
                        columns=[label_col], errors='ignore')

                # Initialize Model

                # Classification
                if algorithm == "逻辑回归":
                    model = LogisticRegression(
                        **model_params, random_state=random_state)
                elif algorithm == "决策树":
                    model = DecisionTreeClassifier(
                        **model_params, random_state=random_state)
                elif algorithm == "随机森林":
                    model = RandomForestClassifier(
                        **model_params, random_state=random_state)
                elif algorithm == "支持向量机 SVM":
                    svc_params = dict(model_params)
                    # 输出概率需要 probability=True
                    svc_params.setdefault("probability", True)
                    model = SVC(**svc_params, random_state=random_state)
                elif algorithm == "KNN":
                    model = KNeighborsClassifier(
                        **model_params)  # KNN has no random_state
                elif algorithm == "XGBoost":
                    if XGBClassifier is None:
                        raise ValueError("XGBoost library is not installed.")
                    # 注意: xgboost >= 2.0 已移除 use_label_encoder 参数，不能再传入
                    model = XGBClassifier(
                        **model_params, random_state=random_state, eval_metric='logloss')
                elif algorithm == "LightGBM":
                    if LGBMClassifier is None:
                        raise ValueError("LightGBM library is not installed.")
                    model = LGBMClassifier(
                        **model_params, random_state=random_state)

                # Regression
                elif algorithm == "线性回归":
                    model = LinearRegression(**model_params)  # No random_state
                elif algorithm == "岭回归":
                    model = Ridge(**model_params, random_state=random_state)
                elif algorithm == "Lasso":
                    model = Lasso(**model_params, random_state=random_state)
                elif algorithm == "随机森林回归":
                    model = RandomForestRegressor(
                        **model_params, random_state=random_state)
                elif algorithm == "GBDT回归":
                    model = GradientBoostingRegressor(
                        **model_params, random_state=random_state)

                if model is None:
                    raise ValueError(
                        f"Algorithm {algorithm} implementation pending")

                # 自动调参（GridSearchCV）
                tune_note = {}
                if params.get("auto_tune") and algorithm in AUTO_TUNE_GRIDS:
                    # 线程后端：Windows 下 joblib 多进程池无法回收会泄漏 numpy worker 进程，拖垮系统
                    with parallel_backend("threading", n_jobs=2):
                        grid_cv = GridSearchCV(
                            model, AUTO_TUNE_GRIDS[algorithm], cv=3, n_jobs=2)
                    grid_cv.fit(X_train, y_train)
                    model = grid_cv.best_estimator_
                    tune_note = {
                        "best_params": grid_cv.best_params_,
                        "cv_best_score": float(grid_cv.best_score_),
                    }
                else:
                    model.fit(X_train, y_train)

                # ---------- 评估深度：交叉验证 ----------
                cv_folds = 5 if len(X_train) >= 100 else 3
                cv_scores, cv_mean, cv_std = [], None, None
                try:
                    with parallel_backend("threading", n_jobs=2):
                        scores = cross_val_score(
                            model, X_train, y_train, cv=cv_folds, n_jobs=2)
                    cv_scores = [round(float(s), 4) for s in scores]
                    cv_mean = float(np.mean(scores))
                    cv_std = float(np.std(scores))
                except Exception:
                    cv_scores, cv_mean, cv_std = [], None, None

                # ---------- 评估深度：学习曲线 ----------
                learning_curve_data = None
                try:
                    with parallel_backend("threading", n_jobs=2):
                        train_sizes, train_scores, test_scores = learning_curve(
                            model, X_train, y_train, cv=cv_folds,
                            train_sizes=[0.3, 0.5, 0.7, 1.0], n_jobs=2
                        )
                    learning_curve_data = {
                        "train_sizes": [float(s) for s in train_sizes],
                        "train_scores": [round(float(np.mean(ts)), 4) for ts in train_scores],
                        "test_scores": [round(float(np.mean(ts)), 4) for ts in test_scores],
                    }
                except Exception:
                    learning_curve_data = None

                # ---------- 评估深度：特征重要性 ----------
                feature_importance = None
                try:
                    imp_attr = getattr(model, "feature_importances_", None)
                    if imp_attr is not None:
                        feature_importance = sorted(
                            [{"feature": str(f), "importance": round(float(v), 6)}
                             for f, v in zip(X.columns, imp_attr)],
                            key=lambda x: -x["importance"]
                        )
                    elif hasattr(model, "coef_"):
                        coef = np.ravel(model.coef_)
                        feature_importance = sorted(
                            [{"feature": str(f), "importance": round(abs(float(v)), 6), "coef": round(float(v), 6)}
                             for f, v in zip(X.columns, coef)],
                            key=lambda x: -x["importance"]
                        )
                except Exception:
                    feature_importance = None

                # Evaluate
                task_type = "classification" if algorithm in classification_algos else "regression"
                label_map = None
                if task_type == "classification" and le is not None:
                    label_map = {int(le.transform([c])[0]): str(
                        c) for c in le.classes_}
                # Save Model if node_id provided (分类模型附上 LabelEncoder 以便预测还原原始标签)
                if node_id:
                    self.save_model(
                        model, node_id, le if task_type == "classification" else None)
                result = self._evaluate_model(
                    model, X_test, y_test, task_type, label_map)
                result.update(tune_note)
                if auto_test_file:
                    result["auto_test_file"] = auto_test_file
                if skipped_test:
                    result["test_skipped"] = skipped_test
                if cv_scores:
                    result["cv_mean"] = cv_mean
                    result["cv_std"] = cv_std
                    result["cv_scores"] = cv_scores
                if learning_curve_data:
                    result["learning_curve"] = learning_curve_data
                if feature_importance:
                    result["feature_importance"] = feature_importance

            elif algorithm in clustering_algos:
                # Unsupervised
                model, X = self._fit_clustering(
                    data_file, algorithm, params, preprocessing)

                # Save Model if node_id provided
                if node_id:
                    self.save_model(model, node_id)

                # Evaluate Clustering
                result = self._evaluate_model(model, X, None, "clustering")

            else:
                raise ValueError(f"Unknown algorithm: {algorithm}")

            return result
        except RuntimeError as e:
            raise e
        except Exception as e:
            raise RuntimeError(f"Algorithm Execution: {str(e)}")
