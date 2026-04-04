"""
clean.py — POST /api/clean  &  GET /api/clean/download/{token}
Runs the 4-step data cleaning pipeline and returns a structured report + cleaned CSV download.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import tempfile
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse

from models.cleaning_models import (
    CleaningConfig,
    CleaningJobStatus,
    CleaningReport,
    DuplicateRemovalSummary,
    MissingValueSummary,
    OutlierSummary,
    TypeInferenceSummary,
)
from services.data_cleaner import run_cleaning_pipeline
from utils.dataset_loader import load_dataset
import job_store

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "dataforge_clean_uploads"
OUTPUT_DIR = Path(tempfile.gettempdir()) / "dataforge_clean_outputs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory token store: download_token → (file_path, original_filename)
_DOWNLOAD_STORE: dict[str, tuple[str, str]] = {}


async def _run_cleaning(job_id: str, file_path: str, config: CleaningConfig, original_filename: str = "dataset") -> None:
    try:
        job_store.update_progress(job_id, 0.05, "Loading dataset")
        df, size_mb = await load_dataset(file_path)
        logger.info("Loaded dataset: %.1f MB, shape: %s", size_mb, df.shape)

        job_store.update_progress(job_id, 0.15, "Processing and cleaning data")
        df_clean, cleaning_report = await asyncio.to_thread(
            run_cleaning_pipeline,
            df,
            remove_exact_duplicates=config.remove_exact_duplicates,
            remove_fuzzy_duplicates=config.remove_fuzzy_duplicates,
            fuzzy_threshold=config.fuzzy_threshold,
            impute_missing=config.impute_missing,
            imputation_strategy=config.imputation_strategy,
            column_strategies=config.column_strategies,
            handle_outliers=config.handle_outliers,
            outlier_method=config.outlier_method,
            cap_outliers=config.cap_outliers,
            iqr_multiplier=config.iqr_multiplier,
            zscore_threshold=config.zscore_threshold,
            infer_types=config.infer_types,
            apply_type_conversions=config.apply_type_conversions,
        )

        job_store.update_progress(job_id, 0.85, "Saving cleaned dataset")
        download_token = str(uuid.uuid4())
        out_path = str(OUTPUT_DIR / f"{download_token}.csv")
        await asyncio.to_thread(df_clean.to_csv, out_path, index=False)
        _DOWNLOAD_STORE[download_token] = (out_path, original_filename)
        logger.info("Saved cleaned dataset to %s", download_token)

        # ── Build response model ──────────────────────────────────────────────
        dr = cleaning_report.duplicate_result
        dup_summary = DuplicateRemovalSummary(
            exact_removed=dr.exact_removed,
            fuzzy_removed=dr.fuzzy_removed,
            total_removed=dr.total_removed,
            original_rows=dr.original_rows,
            cleaned_rows=dr.cleaned_rows,
            fuzzy_threshold_used=dr.fuzzy_threshold_used,
            sample_duplicate_indices=dr.duplicate_row_indices[:20],
            sample_fuzzy_pairs=[[a, b] for a, b in dr.fuzzy_pair_indices[:10]],
        ) if dr else None

        mv = cleaning_report.missing_value_result
        missing_summary = MissingValueSummary(
            strategy_used=mv.strategy_used,
            cells_filled=mv.cells_filled,
            total_cells_filled=mv.total_cells_filled,
            fill_values=mv.fill_values,
        ) if mv else None

        out = cleaning_report.outlier_result
        outlier_summary = OutlierSummary(
            method=out.method,
            columns_processed=out.columns_processed,
            outliers_detected=out.outliers_detected,
            outliers_capped=out.outliers_capped,
            bounds=out.bounds,
            total_outliers=out.total_outliers,
            total_capped=out.total_capped,
        ) if out else None

        ti = cleaning_report.type_inference_result
        type_summary = TypeInferenceSummary(
            original_dtypes=ti.original_dtypes,
            inferred_types=ti.inferred_types,
            conversions_applied=ti.conversions_applied,
            conversion_failures=ti.conversion_failures,
        ) if ti else None

        rows_removed = cleaning_report.original_shape[0] - cleaning_report.final_shape[0]
        cells_cleaned = (mv.total_cells_filled if mv else 0) + (out.total_capped if out else 0)

        report = CleaningReport(
            job_id=job_id,
            status="complete",
            original_shape=list(cleaning_report.original_shape),
            final_shape=list(cleaning_report.final_shape),
            operations_applied=cleaning_report.operations_applied,
            duplicate_summary=dup_summary,
            missing_value_summary=missing_summary,
            outlier_summary=outlier_summary,
            type_inference_summary=type_summary,
            download_token=download_token,
            rows_removed=rows_removed,
            cells_cleaned=cells_cleaned,
        )

        job_store.set_report(job_id, report)
        logger.info("Cleaning job %s complete.", job_id)

    except Exception as exc:
        logger.exception("Cleaning job %s failed: %s", job_id, exc)
        job_store.set_failed(job_id, str(exc))
    finally:
        try:
            os.unlink(file_path)
        except OSError:
            pass


@router.post(
    "/api/clean",
    response_model=CleaningJobStatus,
    status_code=202,
    tags=["Cleaning"],
)
async def clean_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Dataset file: .csv, .json, .xlsx, or .xls"),
    config: str = Form(
        default="{}",
        description="JSON-serialised CleaningConfig. Defaults apply for missing keys.",
    ),
) -> CleaningJobStatus:
    try:
        config_dict = json.loads(config) if config.strip() else {}
        cleaning_config = CleaningConfig(**config_dict)
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
    original_filename = Path(file.filename or "dataset").stem  # e.g. "sales_data"

    async with aiofiles.open(temp_path, "wb") as out:
        while chunk := await file.read(1024 * 256):
            await out.write(chunk)

    job_store.set_processing(job_id, 0.0, "Queued")
    background_tasks.add_task(_run_cleaning, job_id, temp_path, cleaning_config, original_filename)

    return CleaningJobStatus(
        job_id=job_id,
        status="processing",
        progress=0.0,
        stage="Queued",
        message="Cleaning started. Poll /api/clean/status/{job_id} for results.",
    )


@router.get("/api/clean/status/{job_id}", tags=["Cleaning"])
async def get_cleaning_status(job_id: str):
    entry = job_store.get(job_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")

    if isinstance(entry, dict):
        content = entry
    elif isinstance(entry, str) and entry.startswith("failed:"):
        raise HTTPException(status_code=500, detail=entry[len("failed:"):])
    elif isinstance(entry, CleaningReport):
        content = {"status": "complete", "report": entry.model_dump()}
    else:
        raise HTTPException(status_code=500, detail="Unexpected job state.")

    return JSONResponse(
        content=content,
        headers={"Cache-Control": "no-store"},  # ← prevents browser caching GET responses
    )

@router.get(
    "/api/clean/download/{token}",
    tags=["Cleaning"],
)
async def download_cleaned_dataset(token: str):
    """Download the cleaned CSV by token returned in the CleaningReport."""
    entry = _DOWNLOAD_STORE.get(token)
    if not entry:
        raise HTTPException(status_code=404, detail="Download token invalid or expired.")
    path, original_filename = entry
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="Cleaned file no longer available on server.")

    safe_name = re.sub(r"[^A-Za-z0-9_\-]", "_", original_filename)
    download_name = f"{safe_name}_cleaned.csv"

    def iter_file():
        with open(path, "rb") as f:
            while chunk := f.read(64 * 1024):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )
