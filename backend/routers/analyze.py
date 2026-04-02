"""
analyze.py — POST /api/analyze
FIXED: Uses update_progress() for live polling feedback.
       Imports fixed to be relative to backend/ sys.path.
       Added gemini_service.py alias import (spec name).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
import aiofiles

from models.request_models import AnalysisConfig
from models.response_models import JobStatus
from services.ai_service import generate_executive_summary, generate_issue_narratives
from services.bias_detector import run_bias_detection
from services.nlp_analyzer import run_nlp_analysis
from services.report_generator import (
    _build_duplicate_report,
    _build_imbalance_report,
    _build_noise_report,
    assemble_report,
    build_statistical_summary,
)
from utils.dataset_loader import load_dataset
import job_store

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "dataforge_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


async def _run_analysis(job_id: str, file_path: str, config: AnalysisConfig) -> None:
    try:
        job_store.update_progress(job_id, 0.05, "Loading dataset")
        df, size_mb = await load_dataset(file_path)

        job_store.update_progress(job_id, 0.20, "Detecting bias")
        bias = await run_bias_detection(
            df,
            config.sensitive_columns,
            config.target_column,
            config.bias_threshold,
        )

        job_store.update_progress(job_id, 0.35, "Analysing noise & outliers")
        noise = _build_noise_report(df, config)

        job_store.update_progress(job_id, 0.50, "Detecting duplicates")
        dup = _build_duplicate_report(df, config.fuzzy_duplicate_threshold)

        job_store.update_progress(job_id, 0.60, "Checking class imbalance")
        imbalance = _build_imbalance_report(df, config.target_column)

        job_store.update_progress(job_id, 0.70, "Running NLP analysis")
        nlp = await run_nlp_analysis(df) if config.run_nlp else _empty_nlp()

        job_store.update_progress(job_id, 0.80, "Building statistical summary")
        stats = build_statistical_summary(df, bias, noise, dup, imbalance, config)

        job_store.update_progress(job_id, 0.88, "Generating AI insights")
        summary_task = asyncio.create_task(generate_executive_summary(stats))
        issues_task = asyncio.create_task(generate_issue_narratives(stats))
        executive_summary, ai_issues = await asyncio.gather(summary_task, issues_task)

        job_store.update_progress(job_id, 0.97, "Assembling report")
        report = assemble_report(
            job_id=job_id,
            df=df,
            size_mb=size_mb,
            config=config,
            bias=bias,
            noise=noise,
            dup=dup,
            imbalance=imbalance,
            nlp=nlp,
            ai_issues=ai_issues,
            executive_summary=executive_summary,
        )

        job_store.set_report(job_id, report)
        logger.info("Job %s completed successfully.", job_id)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        job_store.set_failed(job_id, str(exc))
    finally:
        try:
            os.unlink(file_path)
        except OSError:
            pass


def _empty_nlp():
    from models.response_models import NLPReport
    return NLPReport(text_columns_analyzed=[], details=[])


@router.post("/api/analyze", response_model=JobStatus, status_code=202, tags=["Analysis"])
async def analyze_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Dataset file: .csv, .json, .xlsx, or .xls"),
    config: str = Form(
        default="{}",
        description="JSON-serialised AnalysisConfig. Defaults apply for missing keys.",
    ),
) -> JobStatus:
    try:
        config_dict = json.loads(config) if config.strip() else {}
        analysis_config = AnalysisConfig(**config_dict)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config JSON: {exc}")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".csv", ".json", ".xlsx", ".xls"}:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Accepted: .csv, .json, .xlsx, .xls",
        )

    job_id = str(uuid.uuid4())
    temp_path = str(UPLOAD_DIR / f"{job_id}{suffix}")

    async with aiofiles.open(temp_path, "wb") as out:
        while chunk := await file.read(1024 * 256):
            await out.write(chunk)

    job_store.set_processing(job_id, 0.0, "Queued")
    background_tasks.add_task(_run_analysis, job_id, temp_path, analysis_config)

    return JobStatus(
        job_id=job_id,
        status="processing",
        progress=0.0,
        stage="Queued",
        message="Analysis started. Poll /api/report/{job_id} for results.",
    )
