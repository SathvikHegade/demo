"""
job_store.py — in-memory store for analysis jobs.
FIXED: Added progress/stage tracking so the polling endpoint returns
       {status: "processing", progress: 0.4, stage: "..."} per contract.
"""
from __future__ import annotations

from typing import Dict, Optional, Union
from models.response_models import QualityReport

# job_id → QualityReport | {"status":"processing","progress":float,"stage":str} | "failed:<msg>"
_store: Dict[str, object] = {}


def set_processing(job_id: str, progress: float = 0.0, stage: str = "Initialising") -> None:
    _store[job_id] = {"status": "processing", "progress": progress, "stage": stage}


def update_progress(job_id: str, progress: float, stage: str) -> None:
    entry = _store.get(job_id)
    if isinstance(entry, dict):
        _store[job_id] = {"status": "processing", "progress": progress, "stage": stage}


def set_failed(job_id: str, reason: str) -> None:
    _store[job_id] = f"failed:{reason}"


def set_report(job_id: str, report: QualityReport) -> None:
    _store[job_id] = report


def get(job_id: str) -> Optional[object]:
    return _store.get(job_id)
