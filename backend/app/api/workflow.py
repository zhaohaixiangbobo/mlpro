from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os
import time
from app.services.ml_service import MLService
from app.api import deps

router = APIRouter()

def get_ml_service(user_dir: str = Depends(deps.get_current_user_dir)) -> MLService:
    # MLService needs access to data files (uploads)
    data_dir = os.path.join(user_dir, "uploads")
    return MLService(data_dir)

def get_workflow_dir(user_dir: str = Depends(deps.get_current_user_dir)) -> str:
    return os.path.join(user_dir, "workflows")

class RunRequest(BaseModel):
    data_file: str
    algorithm: str
    params: dict = {}
    preprocessing: List[Dict[str, Any]] = []
    node_id: str = None

class PredictRequest(BaseModel):
    node_id: str
    data_file: str
    preprocessing: List[Dict[str, Any]] = []
    algorithm_label: str = None

class WorkflowSaveRequest(BaseModel):
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

@router.post("/run")
async def run_workflow(
    request: RunRequest,
    ml_service: MLService = Depends(get_ml_service)
):
    try:
        result = ml_service.run_algorithm(
            request.data_file, 
            request.algorithm, 
            request.params,
            request.preprocessing,
            request.node_id
        )
        return {"status": "success", "result": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import FileResponse

@router.post("/predict")
async def predict(
    req: PredictRequest,
    ml_service: MLService = Depends(get_ml_service)
):
    try:
        result = ml_service.predict(req.node_id, req.data_file, req.preprocessing, req.algorithm_label)
        return {"status": "success", "result": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/prediction/{filename}")
async def download_prediction(
    filename: str,
    ml_service: MLService = Depends(get_ml_service)
):
    try:
        file_path = os.path.join(ml_service.data_dir, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Prediction file not found")
        
        return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_workflow(
    req: WorkflowSaveRequest,
    workflow_dir: str = Depends(get_workflow_dir)
):
    try:
        filename = f"{req.name}.json"
        filepath = os.path.join(workflow_dir, filename)
        
        data = {
            "name": req.name,
            "nodes": req.nodes,
            "edges": req.edges,
            "updated_at": time.time()
        }
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return {"status": "success", "message": "Workflow saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_workflows(workflow_dir: str = Depends(get_workflow_dir)):
    try:
        files = [f for f in os.listdir(workflow_dir) if f.endswith(".json")]
        workflows = []
        for f in files:
            filepath = os.path.join(workflow_dir, f)
            mtime = os.path.getmtime(filepath)
            workflows.append({
                "name": f.replace(".json", ""),
                "updated_at": mtime
            })
        
        # Sort by updated_at desc (newest first)
        workflows.sort(key=lambda x: x["updated_at"], reverse=True)
        return {"workflows": workflows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{name}")
async def delete_workflow(
    name: str,
    workflow_dir: str = Depends(get_workflow_dir)
):
    try:
        filepath = os.path.join(workflow_dir, f"{name}.json")
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Workflow not found")
            
        os.remove(filepath)
        return {"status": "success", "message": "Workflow deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}")
async def load_workflow(
    name: str,
    workflow_dir: str = Depends(get_workflow_dir)
):
    try:
        filepath = os.path.join(workflow_dir, f"{name}.json")
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Workflow not found")
            
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
