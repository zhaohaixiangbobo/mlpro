from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import data, workflow, auth, report
from app.db import models
from app.db.database import engine

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MLPro API", description="Backend for MLPro Platform")

# CORS setup
origins = [
    "http://localhost:5173",  # React default port
    "http://localhost:3000",
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
