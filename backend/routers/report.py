"""
report.py — GET /api/report/{job_id}
FIXED: Returns progress+stage while processing (per contract).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Union

from models.response_models import JobStatus, QualityReport
import job_store

router = APIRouter()


@router.get(
    "/api/report/{job_id}",
    response_model=Union[QualityReport, JobStatus],
    tags=["Report"],
)
async def get_report(job_id: str) -> Union[QualityReport, JobStatus]:
    entry = job_store.get(job_id)

    if entry is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    # Processing — dict with progress/stage
    if isinstance(entry, dict):
        return JobStatus(
            job_id=job_id,
            status=entry.get("status", "processing"),
            progress=entry.get("progress", 0.0),
            stage=entry.get("stage", ""),
        )

    # Failed
    if isinstance(entry, str) and entry.startswith("failed:"):
        reason = entry[len("failed:"):]
        raise HTTPException(status_code=500, detail=f"Analysis failed: {reason}")

    # Complete
    if isinstance(entry, QualityReport):
        return entry

    raise HTTPException(status_code=500, detail="Unexpected job state.")
