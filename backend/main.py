"""
Smart Email Summarizer - FastAPI Backend
Production-ready AI-powered email summarization service
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import os
import logging
from datetime import datetime

from routers import summarize, history
from models.schemas import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Smart Email Summarizer API",
    description="AI-powered email and document summarization using Hugging Face Transformers",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware - allow frontend and Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for frontend
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "static")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Include routers
app.include_router(summarize.router, prefix="/api", tags=["Summarization"])
app.include_router(history.router, prefix="/api", tags=["History"])


@app.get("/", response_class=FileResponse)
async def serve_frontend():
    """Serve the frontend application."""
    index_path = os.path.join(
        os.path.dirname(__file__), "..", "frontend", "templates", "index.html"
    )
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Smart Email Summarizer API", "docs": "/api/docs"})


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        models_available=["facebook/bart-large-cnn", "google/pegasus-xsum", "t5-base"]
    )


@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Smart Email Summarizer API starting up...")
    logger.info("📖 API docs available at: http://localhost:8000/api/docs")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("👋 Smart Email Summarizer API shutting down...")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
