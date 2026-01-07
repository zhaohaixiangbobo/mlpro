import os
import json
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from sklearn.model_selection import train_test_split

class DataService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    def _get_meta_path(self, filename: str) -> str:
        return os.path.join(self.data_dir, f"{filename}.meta.json")

    def _load_meta(self, filename: str) -> Dict:
        meta_path = self._get_meta_path(filename)
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"filename": filename, "columns": {}}

    def _save_meta(self, filename: str, meta: Dict):
        meta_path = self._get_meta_path(filename)
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

    def load_data(self, filename: str) -> pd.DataFrame:
        file_path = os.path.join(self.data_dir, filename)
        if filename.endswith(".csv"):
            return pd.read_csv(file_path)
        elif filename.endswith((".xlsx", ".xls")):
            return pd.read_excel(file_path)
        else:
            raise ValueError("Unsupported file format")

    def analyze_data(self, filename: str) -> Dict:
        df = self.load_data(filename)
        meta = self._load_meta(filename)
        
        column_stats = {}
        rows = len(df)
        
        # Simple heuristic for label detection if not set
        current_label = meta.get("label_column")
        possible_label = None
        
        if not current_label:
            # Check for 'target', 'label', 'y'
            for col in df.columns:
                if col.lower() in ['target', 'label', 'class', 'y','类别']:
                    possible_label = col
                    break
            # Fallback: last column if it's categorical or int with few unique values
            if not possible_label:
                last_col = df.columns[-1]
                if df[last_col].nunique() < 20: # arbitrary threshold
                     possible_label = last_col

        for col in df.columns:
            series = df[col]
            dtype = str(series.dtype)
            col_type = "unknown"
            
            if pd.api.types.is_numeric_dtype(series):
                col_type = "numeric"
            elif pd.api.types.is_datetime64_any_dtype(series):
                col_type = "datetime"
            else:
                col_type = "category"

            missing = int(series.isnull().sum())
            
            # Outlier detection (IQR) for numeric
            outliers = 0
            if col_type == "numeric":
                Q1 = series.quantile(0.25)
                Q3 = series.quantile(0.75)
                IQR = Q3 - Q1
                outliers = int(((series < (Q1 - 1.5 * IQR)) | (series > (Q3 + 1.5 * IQR))).sum())

            column_stats[col] = {
                "type": col_type,
                "missing": missing,
                "missing_pct": round(missing / rows * 100, 2) if rows > 0 else 0,
                "outliers": outliers,
                "unique": int(series.nunique())
            }

        # Update meta
        meta["columns"] = column_stats
        meta["rows"] = rows
        if not current_label and possible_label:
             meta["label_column"] = possible_label # Auto-suggest
        
        self._save_meta(filename, meta)
        
        return meta

    def set_label(self, filename: str, label_column: Optional[str]) -> Dict:
        if label_column:
            df = self.load_data(filename)
            if label_column not in df.columns:
                raise ValueError(f"Column {label_column} not found in data")
            
            # Check for missing values in label column
            if df[label_column].isnull().any():
                 raise ValueError(f"Label column '{label_column}' contains missing values. Please handle missing values (e.g. drop rows) before setting it as label.")

        meta = self._load_meta(filename)
        meta["label_column"] = label_column
        self._save_meta(filename, meta)
        return meta

    def split_data(self, filename: str, train_ratio: float, test_ratio: float, val_ratio: float, 
                   strategy: str = "random", stratify_col: str = None):
        df = self.load_data(filename)
        
        # Calculate splits
        # First split: Train vs (Test + Val)
        remaining_ratio = test_ratio + val_ratio
        if remaining_ratio >= 1.0 or remaining_ratio < 0:
             raise ValueError("Invalid split ratios")
        
        #比例合法性检查
        total = train_ratio + test_ratio + val_ratio
        if not (0.99 <= total <= 1.01):  # 允许浮点误差
            raise ValueError("Train + test + val ratios must sum to 1.0")
        if any(r < 0 for r in [train_ratio, test_ratio, val_ratio]):
            raise ValueError("All ratios must be non-negative")

        train_size = 1.0 - remaining_ratio
        print(train_size)
        stratify = None
        if strategy == "stratified" and stratify_col:
            if stratify_col not in df.columns:
                raise ValueError(f"Stratify column {stratify_col} not found")
            stratify = df[stratify_col]

        train_df, remaining_df = train_test_split(df, train_size=train_size, stratify=stratify, random_state=42)
        
        test_df = remaining_df
        val_df = None


        # Second split if validation set is needed
        if val_ratio > 0:
            # Re-calculate stratify for the remaining part
            stratify_rem = None
            if strategy == "stratified" and stratify_col:
                 stratify_rem = remaining_df[stratify_col]
            
            # test_ratio relative to remaining
            relative_test_size = test_ratio / remaining_ratio
            val_df, test_df = train_test_split(remaining_df, test_size=relative_test_size, stratify=stratify_rem, random_state=42)

        # Save files
        base_name = os.path.splitext(filename)[0]
        ext = os.path.splitext(filename)[1]
        
        generated_files = {}
        
        # Helper to save and copy meta
        meta = self._load_meta(filename)
        
        def save_split(split_df, suffix, role):
            fname = f"{base_name}_{suffix}{ext}"
            fpath = os.path.join(self.data_dir, fname)
            if ext == ".csv":
                split_df.to_csv(fpath, index=False)
            else:
                split_df.to_excel(fpath, index=False)
            
            # Create meta for split
            split_meta = meta.copy()
            split_meta["filename"] = fname
            split_meta["role"] = role
            split_meta["parent"] = filename
            split_meta["rows"] = len(split_df)
            self._save_meta(fname, split_meta)
            return fname
        

        generated_files["train"] = save_split(train_df, "train", "train")
        if test_df is not None:
            generated_files["test"] = save_split(test_df, "test", "test")
        if val_df is not None:
            generated_files["val"] = save_split(val_df, "val", "validation")


        return generated_files

    def delete_file(self, filename: str) -> List[str]:
        """
        Delete a file, its metadata, and any derived files (train/test/val splits).
        Returns a list of deleted filenames.
        """
        deleted_files = []
        files_to_delete = [filename]
        
        # 1. Identify derived files by scanning all meta files
        # This is a bit expensive but safe for a small file system based storage
        all_files = os.listdir(self.data_dir)
        for f in all_files:
            if f.endswith(".meta.json"):
                try:
                    meta_path = os.path.join(self.data_dir, f)
                    with open(meta_path, 'r', encoding='utf-8') as mf:
                        meta = json.load(mf)
                        if meta.get("parent") == filename:
                            # This file is derived from the target file
                            derived_filename = meta.get("filename")
                            if derived_filename and derived_filename not in files_to_delete:
                                files_to_delete.append(derived_filename)
                except Exception:
                    continue # Ignore malformed meta files

        # 2. Delete files and their metas
        for f_name in files_to_delete:
            # Delete data file
            f_path = os.path.join(self.data_dir, f_name)
            if os.path.exists(f_path):
                os.remove(f_path)
                deleted_files.append(f_name)
            
            # Delete meta file
            meta_path = self._get_meta_path(f_name)
            if os.path.exists(meta_path):
                os.remove(meta_path)
        
        return deleted_files
