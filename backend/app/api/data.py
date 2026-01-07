from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
import shutil
import os
import pandas as pd
from typing import List, Optional
from app.services.data_service import DataService
from app.services.ml_service import MLService
from app.api import deps

router = APIRouter()

# Helper to get service instance for current user context
def get_data_service(user_dir: str = Depends(deps.get_current_user_dir)) -> DataService:
    # Data files are stored in 'uploads' subdirectory
    upload_dir = os.path.join(user_dir, "uploads")
    return DataService(upload_dir)

def get_ml_service(user_dir: str = Depends(deps.get_current_user_dir)) -> MLService:
    upload_dir = os.path.join(user_dir, "uploads")
    return MLService(upload_dir)

def get_upload_dir(user_dir: str = Depends(deps.get_current_user_dir)) -> str:
    return os.path.join(user_dir, "uploads")

class SplitRequest(BaseModel):
    filename: str
    train_ratio: float
    test_ratio: float
    val_ratio: float
    strategy: str = "random" # random, stratified
    stratify_col: Optional[str] = None

class SetLabelRequest(BaseModel):
    filename: str
    label_column: Optional[str]

class PCARequest(BaseModel):
    filename: str
    label_column: Optional[str] = None

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    upload_dir: str = Depends(get_upload_dir),
    data_service: DataService = Depends(get_data_service)
):
    file_location = os.path.join(upload_dir, file.filename)
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Initial analysis to create meta
        data_service.analyze_data(file.filename)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not upload file: {str(e)}")
    
    return {"filename": file.filename, "message": "File uploaded successfully"}

@router.get("/preview/{filename}")
async def preview_data(
    filename: str, 
    page: int = 1,
    limit: int = 20,
    upload_dir: str = Depends(get_upload_dir),
    data_service: DataService = Depends(get_data_service)
):
    file_path = os.path.join(upload_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        # Load basic preview from file
        if filename.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        total = len(df)
        start = (page - 1) * limit
        end = start + limit
        
        # Slicing the dataframe for pagination
        paginated_df = df.iloc[start:end]
        
        # Replace NaN/Inf with None for JSON serialization
        paginated_df = paginated_df.where(pd.notnull(paginated_df), None)
        
        preview = paginated_df.to_dict(orient="records")
        # columns for Table
        columns = [{"title": col, "dataIndex": col, "key": col} for col in df.columns]
        
        # Get Enhanced Meta info (cached or fresh)
        # We don't need full analysis for just paging, but meta is useful for frontend to know types
        # For performance, maybe skip full analysis on every page load if not needed?
        # But existing code calls it. Let's keep it but handle potential slowness if analyze is heavy.
        # Actually data_service.analyze_data uses caching if meta file exists.
        meta = data_service.analyze_data(filename)
        
        return {
            "filename": filename,
            "preview": preview,
            "columns": columns,
            "meta": meta,
            "total": total,
            "page": page,
            "pageSize": limit
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.get("/list")
async def list_files(upload_dir: str = Depends(get_upload_dir)):
    # Only list data files, ignore .meta.json and directories
    all_files = os.listdir(upload_dir)
    data_files = []
    for f in all_files:
        if f.endswith('.meta.json') or f.endswith('.DS_Store'):
            continue
        
        full_path = os.path.join(upload_dir, f)
        if os.path.isfile(full_path):
            data_files.append(f)
            
    return {"files": data_files}

@router.post("/analyze/{filename}")
async def analyze_data(
    filename: str, 
    data_service: DataService = Depends(get_data_service)
):
    try:
        meta = data_service.analyze_data(filename)
        return meta
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/split")
async def split_data(
    req: SplitRequest, 
    data_service: DataService = Depends(get_data_service)
):
    try:
        result = data_service.split_data(
            req.filename, 
            req.train_ratio, 
            req.test_ratio, 
            req.val_ratio, 
            req.strategy, 
            req.stratify_col
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/label")
async def set_label(
    req: SetLabelRequest, 
    data_service: DataService = Depends(get_data_service)
):
    try:
        meta = data_service.set_label(req.filename, req.label_column)
        return {"filename": req.filename, "meta": meta}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_file(
    filename: str, 
    upload_dir: str = Depends(get_upload_dir)
):
    file_path = os.path.join(upload_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')

@router.delete("/files/{filename}")
async def delete_file(
    filename: str, 
    data_service: DataService = Depends(get_data_service)
):
    try:
        deleted = data_service.delete_file(filename)
        return {"message": "File deleted", "deleted_files": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pca")
async def get_pca(
    req: PCARequest,
    ml_service: MLService = Depends(get_ml_service)
):
    try:
        data = ml_service.get_pca_data(req.filename, req.label_column)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
