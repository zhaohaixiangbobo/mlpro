from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import shutil
import os
import json
import pandas as pd
from typing import List, Optional, Dict, Any
from app.services.data_service import DataService, detect_encoding
from app.services.ml_service import MLService
from app.api import deps
from app.api.http_utils import content_disposition

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
    strategy: str = "random"  # random, stratified
    stratify_col: Optional[str] = None


class SetLabelRequest(BaseModel):
    filename: str
    label_column: Optional[str]


class PCARequest(BaseModel):
    filename: str
    label_column: Optional[str] = None


class ClusterVisualRequest(BaseModel):
    filename: str
    algorithm: str
    params: dict = {}
    preprocessing: List[Dict[str, Any]] = []


class ElbowRequest(BaseModel):
    filename: str
    params: dict = {}
    preprocessing: List[Dict[str, Any]] = []


class ClusterExportRequest(BaseModel):
    filename: str
    algorithm: str
    params: dict = {}
    preprocessing: List[Dict[str, Any]] = []
    # 可选：簇编号 -> 业务画像名，例如 {"0": "高价值客户"}
    cluster_names: Optional[Dict[str, str]] = None


class DeleteRowsRequest(BaseModel):
    filename: str
    indices: List[int]


class DemoDataRequest(BaseModel):
    name: str


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    encoding: str = Form("auto"),
    delimiter: str = Form(""),
    upload_dir: str = Depends(get_upload_dir),
    data_service: DataService = Depends(get_data_service)
):
    filename = os.path.basename(file.filename or "")
    if not filename or not filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="仅支持 CSV / Excel 文件")
    file_location = os.path.join(upload_dir, filename)
    try:
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Resolve encoding & delimiter, then store in meta
        if filename.lower().endswith(".csv"):
            if encoding == "auto" or not encoding:
                encoding = detect_encoding(file_location)
            if delimiter == "\\t" or delimiter == "tab":
                delimiter = "\t"
            data_service._save_meta(
                filename, {"encoding": encoding, "delimiter": delimiter or None})
        else:
            data_service._save_meta(
                filename, {"encoding": None, "delimiter": None})

        # Initial analysis to create meta
        data_service.analyze_data(filename)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Could not upload file: {str(e)}")

    return {"filename": filename, "encoding": encoding, "message": "File uploaded successfully"}


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
        # Load via DataService so encoding/delimiter from meta is respected
        df = data_service.load_data(filename)

        total = len(df)
        start = (page - 1) * limit
        end = start + limit

        # Slicing the dataframe for pagination
        paginated_df = df.iloc[start:end]

        # Replace NaN/Inf with None for JSON serialization
        paginated_df = paginated_df.where(pd.notnull(paginated_df), None)

        preview = paginated_df.to_dict(orient="records")
        # columns for Table
        columns = [{"title": col, "dataIndex": col, "key": col}
                   for col in df.columns]

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
        raise HTTPException(
            status_code=500, detail=f"Error reading file: {str(e)}")


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
            role = "source"
            parent = None
            # 从 meta 读取角色信息（划分文件/自动测试集等）
            meta_path = os.path.join(upload_dir, f"{f}.meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, 'r', encoding='utf-8') as mf:
                        meta = json.load(mf)
                        role = meta.get("role", "source")
                        parent = meta.get("parent")
                except Exception:
                    pass
            # 预测结果文件（早期版本未写 role）
            if role == "source" and f.startswith("pred_"):
                role = "prediction"
            data_files.append({"filename": f, "role": role, "parent": parent})

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


@router.post("/rows/delete")
async def delete_rows(
    req: DeleteRowsRequest,
    data_service: DataService = Depends(get_data_service)
):
    try:
        meta = data_service.delete_rows(req.filename, req.indices)
        return {"message": "Rows deleted", "meta": meta, "deleted": len(req.indices)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/demo")
async def create_demo(
    req: DemoDataRequest,
    data_service: DataService = Depends(get_data_service)
):
    try:
        meta = data_service.create_demo_data(req.name)
        return {"filename": meta.get("filename"), "meta": meta, "message": "示例数据已生成"}
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


@router.post("/cluster/visualize")
async def cluster_visualize(
    req: ClusterVisualRequest,
    ml_service: MLService = Depends(get_ml_service)
):
    """聚类结果散点图：运行聚类并按簇着色投影到 PCA 二维平面"""
    try:
        data = ml_service.get_cluster_visualization(
            req.filename, req.algorithm, req.params, req.preprocessing
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cluster/elbow")
async def kmeans_elbow(
    req: ElbowRequest,
    ml_service: MLService = Depends(get_ml_service)
):
    """K-Means 肘部法则：不同 K 的 SSE / 轮廓系数，辅助选择簇数量"""
    try:
        data = ml_service.kmeans_elbow(
            req.filename, req.params, req.preprocessing)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cluster/export")
async def cluster_export(
    req: ClusterExportRequest,
    ml_service: MLService = Depends(get_ml_service)
):
    """导出聚类结果 Excel：Sheet1 逐条明细（含所属簇），Sheet2 分群汇总（均值/众数）"""
    try:
        buf, filename = ml_service.export_cluster_excel(
            req.filename, req.algorithm, req.params,
            req.preprocessing, req.cluster_names
        )
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": content_disposition(filename)}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
