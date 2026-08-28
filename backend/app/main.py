from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import data, workflow, auth, report
from app.db import models
from app.db.database import engine

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MLPro API", description="Backend for MLPro Platform")

# CORS setup
# 生产环境前后端经 Nginx 同源部署（页面与接口同域），实际不产生跨域；
# 这里保留本地开发地址与生产访问地址，便于直连后端调试时排查问题。
origins = [
    "http://localhost:5173",  # React default port
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://10.9.14.167",     # 远端服务器（Nginx 80 端口）
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(workflow.router, prefix="/api/workflow", tags=["workflow"])
app.include_router(report.router, prefix="/api/report", tags=["report"])


@app.get("/")
def read_root():
    return {"message": "Welcome to MLPro API"}
