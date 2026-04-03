import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import pandas as pd

try:
    from kaggle.api.kaggle_api_extended import KaggleApi
except ImportError:
    KaggleApi = None

router = APIRouter(prefix="/api/import/kaggle", tags=["import"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "dataforge_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class KaggleImportRequest(BaseModel):
    dataset_id: str
    target_column: str | None = None
    bias_threshold: float = 0.70


@router.post("")
async def import_kaggle(req: KaggleImportRequest, background_tasks: BackgroundTasks):
    if KaggleApi is None:
        raise HTTPException(status_code=500, detail="Kaggle package not installed")

    if not os.environ.get("KAGGLE_USERNAME") or not os.environ.get("KAGGLE_KEY"):
        raise HTTPException(status_code=401, detail="Kaggle credentials not configured")

    try:
        api = KaggleApi()
        api.authenticate()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kaggle authentication failed: {str(e)}")

    # Accept full kaggle URLs or just the slug (username/dataset-name)
    raw = req.dataset_id.strip()
    if "kaggle.com/datasets/" in raw:
        raw = raw.split("kaggle.com/datasets/")[-1]
    dataset = raw.strip("/")

    logger.info(f"Downloading Kaggle dataset: '{dataset}'")
    tmp_dir = tempfile.mkdtemp()

    try:
        api.dataset_download_files(dataset, path=tmp_dir, unzip=True)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.error(f"Kaggle download failed for '{dataset}': {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to download '{dataset}': {str(e)}")

    # Find the first valid CSV file
    csv_files = sorted(Path(tmp_dir).glob("**/*.csv"))
    if not csv_files:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=404, detail="No CSV files found in Kaggle dataset")

    source_csv = csv_files[0]
    logger.info(f"Found CSV: {source_csv.name}")

    # Read a quick preview — try multiple encodings (Kaggle datasets vary wildly)
    df_preview = None
    chosen_encoding = "utf-8"
    for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            df_preview = pd.read_csv(source_csv, nrows=5, encoding=encoding)
            chosen_encoding = encoding
            logger.info(f"CSV decoded with encoding={encoding}")
            break
        except Exception:
            continue

    if df_preview is None:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Could not decode {source_csv.name} — unsupported encoding")

    try:
        with open(source_csv, encoding=chosen_encoding, errors="replace") as f:
            row_count = sum(1 for _ in f) - 1
    except Exception:
        row_count = -1

    col_names = df_preview.columns.tolist()

    # Copy the CSV into UPLOAD_DIR under a proper job_id filename
    job_id = str(uuid.uuid4())
    dest_path = str(UPLOAD_DIR / f"{job_id}.csv")

    # Re-save with UTF-8 so the analysis pipeline never hits encoding issues
    try:
        df_full = pd.read_csv(source_csv, encoding=chosen_encoding, encoding_errors="replace", low_memory=False)
        df_full.to_csv(dest_path, index=False, encoding="utf-8")
        row_count = len(df_full)
        logger.info(f"Re-saved as UTF-8: {row_count} rows, {len(col_names)} cols")
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        logger.error(f"Failed to re-save CSV: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")

    # Clean up the kaggle temp download dir
    shutil.rmtree(tmp_dir, ignore_errors=True)

    # Kick off the analysis pipeline
    from models.request_models import AnalysisConfig
    from routers.analyze import _run_analysis
    import job_store

    config = AnalysisConfig(
        target_column=req.target_column,
        bias_threshold=req.bias_threshold,
    )

    job_store.set_processing(job_id, 0.0, "Queued")
    background_tasks.add_task(_run_analysis, job_id, dest_path, config)

    logger.info(f"Kaggle import '{dataset}' queued as job {job_id} — {row_count} rows, {len(col_names)} columns")

    return {
        "status": "accepted",
        "job_id": job_id,
        "rows": row_count,
        "columns": col_names,
        "dataset_name": dataset,
        "selected_file": source_csv.name,
    }