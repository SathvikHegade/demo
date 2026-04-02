"""
main.py — DataForge FastAPI application entry point.

Run with:
    cd DataForge
    uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure backend directory is on the Python path so relative imports work
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from dotenv import load_dotenv
load_dotenv(dotenv_path=_backend_dir / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, health, report

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DataForge API starting up …")
    # Support both GEMINI_API_KEY (per spec) and GOOGLE_API_KEY (legacy)
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        logger.warning(
            "GEMINI_API_KEY is not set — Gemini AI features will be unavailable.\n"
            "    Set it in backend/.env:  GEMINI_API_KEY=your_key_here"
        )
    else:
        os.environ.setdefault("GEMINI_API_KEY", key)
        logger.info("GEMINI_API_KEY found — AI features enabled.")
    yield
    logger.info("DataForge API shutting down.")


app = FastAPI(
    title="DataForge — Dataset Quality Analyzer API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(report.router)


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "DataForge API", "docs": "/docs", "health": "/health"}
