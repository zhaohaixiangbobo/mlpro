import pandas as pd
import os
import json
import joblib
from sklearn.model_selection import train_test_split
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
                         columns = df.select_dtypes(include=[np.number]).columns.tolist()
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
                
                elif method == "mean":
                    imputer = SimpleImputer(strategy="mean")
                    df[columns] = imputer.fit_transform(df[columns])
                
                elif method == "median":
                    imputer = SimpleImputer(strategy="median")
                    df[columns] = imputer.fit_transform(df[columns])
                
                elif method == "mode":
                    imputer = SimpleImputer(strategy="most_frequent")
                    df[columns] = imputer.fit_transform(df[columns])

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

    def _evaluate_model(self, model, X_test, y_test, task_type):
        """
        Evaluate model based on task type
        """
        if task_type == "classification":
            y_pred = model.predict(X_test)
            acc = accuracy_score(y_test, y_pred)
            cm = confusion_matrix(y_test, y_pred).tolist()
            return {
                "type": "classification",
                "accuracy": acc,
                "confusion_matrix": cm,
                "report": classification_report(y_test, y_pred, output_dict=True)
            }
        
        elif task_type == "regression":
            y_pred = model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            return {
                "type": "regression",
                "mse": mse,
                "rmse": rmse,
                "mae": mae,
                "r2_score": r2,
                "prediction_head": y_pred[:10].tolist()
            }
        
        elif task_type == "clustering":
            # For clustering, X_test is the data itself, y_test might be labels if available (not used here mostly)
            # We assume 'model' is already fitted
            labels = model.labels_ if hasattr(model, 'labels_') else model.predict(X_test)
            
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
                metrics["calinski_harabasz_score"] = calinski_harabasz_score(X_test, labels)
                metrics["davies_bouldin_score"] = davies_bouldin_score(X_test, labels)
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

    def save_model(self, model, node_id: str):
        """Save the trained model to disk."""
        models_dir = os.path.join(self.data_dir, "models")
        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, f"{node_id}.joblib")
        joblib.dump(model, model_path)
        return model_path

    def load_model(self, node_id: str):
        """Load a trained model from disk."""
        models_dir = os.path.join(self.data_dir, "models")
        model_path = os.path.join(models_dir, f"{node_id}.joblib")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model for node {node_id} not found.")
        return joblib.load(model_path)

    def predict(self, node_id: str, data_file: str, preprocessing: list = None, algorithm_label: str = None):
        """
        Run prediction using a saved model.
        """
        try:
            # 1. Load Data
            df = self.load_data(data_file)
            
            # 2. Preprocessing
            if preprocessing:
                df = self.preprocess_data(df, preprocessing)
            
            df_numeric = df.select_dtypes(include=[np.number])
            if df_numeric.empty:
                raise ValueError("No numeric data found for prediction")
                
            # 3. Load Model
            model = self.load_model(node_id)
            
            # 4. Predict
            # Align columns if possible or assume correct input
            # Ideally we should save feature names with the model to verify.
            # For now, we assume user uploads correct format.
            if hasattr(model, "feature_names_in_"):
                 # Reorder columns to match training
                 common_cols = [c for c in model.feature_names_in_ if c in df_numeric.columns]
                 if len(common_cols) < len(model.feature_names_in_):
                     missing = set(model.feature_names_in_) - set(common_cols)
                     raise ValueError(f"Missing features for prediction: {missing}")
                 X = df_numeric[model.feature_names_in_]
            else:
                 X = df_numeric
            
            predictions = model.predict(X)
            
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
            algo_tag = ALGO_NAME_MAP.get(algorithm_label, algorithm_label) if algorithm_label else "Model"
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
                
            return {
                "filename": pred_filename,
                "preview": result_df.head(10).to_dict(orient="records")
            }
            
        except Exception as e:
            raise RuntimeError(f"Prediction failed: {str(e)}")
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
                 print(f"PCA Skipped: Not enough features (need >= 2, got {df_numeric.shape[1]})")
                 return []
            
            # Update labels to match the filtered data (if rows were dropped)
            if labels and len(labels) != len(df_numeric):
                # Align labels using the index of the remaining rows
                if label_col:
                     labels = df.loc[df_numeric.index, label_col].fillna("Unknown").astype(str).tolist()

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

    def run_algorithm(self, data_file: str, algorithm: str, params: dict, preprocessing: list = None, node_id: str = None):
        try:
            df = self.load_data(data_file)
            meta = self._load_meta(data_file)
            label_col = meta.get("label_column")
            
            # 1. Preprocessing
            if preprocessing:
                df = self.preprocess_data(df, preprocessing, label_col)
            
            df_numeric = df.select_dtypes(include=[np.number])
            if df_numeric.empty:
                 raise ValueError("No numeric data found")
    
            result = {}
            
            # Classification Algorithms
            classification_algos = ["逻辑回归", "决策树", "随机森林", "支持向量机 SVM", "KNN", "XGBoost", "LightGBM"]
            # Regression Algorithms
            regression_algos = ["线性回归", "岭回归", "Lasso", "随机森林回归", "GBDT回归"]
            # Clustering Algorithms
            clustering_algos = ["K-Means", "DBSCAN"]

            model = None
            X_test = None
            y_test = None
            task_type = None

            if algorithm in classification_algos or algorithm in regression_algos:
                # Supervised Learning
                if not label_col:
                    raise ValueError(f"Algorithm {algorithm} requires a Label column. Please set a label in Data Management.")
                
                # Check for explicit test file
                test_file = params.get("test_file")
                random_state = params.get("random_state", 42)
                
                # Remove common params that are not model specific or handled separately
                model_params = params.copy()
                model_params.pop("test_file", None)
                model_params.pop("random_state", None)

                # Prepare Train Data
                if label_col not in df.columns:
                     raise ValueError(f"Label column {label_col} not found in data")

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
                        df_test = self.preprocess_data(df_test, preprocessing, label_col)
                    
                    df_test_numeric = df_test.select_dtypes(include=[np.number])
                    
                    if label_col not in df_test.columns:
                        raise ValueError(f"Label column {label_col} not found in test data")
                        
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
                             raise ValueError(f"Test data contains labels not seen in training data: {str(e)}")

                    X_test = df_test_numeric.drop(columns=[label_col], errors='ignore')
                    
                    # Align columns (Test set must have same columns as Train set)
                    # Get common columns
                    common_cols = X.columns.intersection(X_test.columns)
                    X = X[common_cols]
                    X_test = X_test[common_cols]
                    
                    X_train = X
                    y_train = y
                    # X_test, y_test are already set
                    
                else:
                    # Default Split Strategy
                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=random_state)
                
                # Initialize Model
                
                # Classification
                if algorithm == "逻辑回归":
                    model = LogisticRegression(**model_params, random_state=random_state)
                elif algorithm == "决策树":
                    model = DecisionTreeClassifier(**model_params, random_state=random_state)
                elif algorithm == "随机森林":
                    model = RandomForestClassifier(**model_params, random_state=random_state)
                elif algorithm == "支持向量机 SVM":
                    model = SVC(**model_params, random_state=random_state)
                elif algorithm == "KNN":
                    model = KNeighborsClassifier(**model_params) # KNN has no random_state
                elif algorithm == "XGBoost":
                    if XGBClassifier is None:
                        raise ValueError("XGBoost library is not installed.")
                    model = XGBClassifier(**model_params, random_state=random_state, use_label_encoder=False, eval_metric='logloss')
                elif algorithm == "LightGBM":
                    if LGBMClassifier is None:
                        raise ValueError("LightGBM library is not installed.")
                    model = LGBMClassifier(**model_params, random_state=random_state)
                
                # Regression
                elif algorithm == "线性回归":
                    model = LinearRegression(**model_params) # No random_state
                elif algorithm == "岭回归":
                    model = Ridge(**model_params, random_state=random_state)
                elif algorithm == "Lasso":
                    model = Lasso(**model_params, random_state=random_state)
                elif algorithm == "随机森林回归":
                    model = RandomForestRegressor(**model_params, random_state=random_state)
                elif algorithm == "GBDT回归":
                    model = GradientBoostingRegressor(**model_params, random_state=random_state)

                if model is None:
                     raise ValueError(f"Algorithm {algorithm} implementation pending")

                model.fit(X_train, y_train)
                
                # Save Model if node_id provided
                if node_id:
                    self.save_model(model, node_id)
                
                # Evaluate
                task_type = "classification" if algorithm in classification_algos else "regression"
                result = self._evaluate_model(model, X_test, y_test, task_type)
    
            elif algorithm in clustering_algos:
                # Unsupervised
                random_state = params.get("random_state", 42)
                model_params = params.copy()
                model_params.pop("test_file", None)
                model_params.pop("random_state", None)

                # Use all numeric columns including label if it's numeric? Usually drop label for clustering if it exists.
                X = df_numeric.drop(columns=[label_col], errors='ignore') if label_col else df_numeric
                
                model = None
                if algorithm == "K-Means":
                    model = KMeans(**model_params, random_state=random_state)
                    model.fit(X)
                elif algorithm == "DBSCAN":
                    model = DBSCAN(**model_params)
                    model.fit(X) # DBSCAN fits and predicts implicitly
                
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
