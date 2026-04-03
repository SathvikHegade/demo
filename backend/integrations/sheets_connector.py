from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import re
import requests
import io
import uuid
import tempfile
from pathlib import Path

import pandas as pd

router = APIRouter(prefix="/api/import/sheets", tags=["import"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "dataforge_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class SheetsImportRequest(BaseModel):
    url: str
    target_column: str | None = None
    bias_threshold: float = 0.70


@router.post("")
async def import_google_sheets(req: SheetsImportRequest, background_tasks: BackgroundTasks):
    url = req.url

    # Build the download URL
    google_sheets_match = re.match(r"https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if google_sheets_match:
        sheet_id = google_sheets_match.group(1)
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    else:
        csv_url = url  # raw CSV URL fallback

    # Fetch the data
    try:
        response = requests.get(csv_url, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download from {csv_url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch data from URL: {str(e)}")

    content_type = response.headers.get("Content-Type", "")

    try:
        if "csv" in content_type or url.endswith(".csv"):
            df = pd.read_csv(io.StringIO(response.text), nrows=10000)
        elif "json" in content_type:
            df = pd.read_json(io.StringIO(response.text))
        else:
            df = pd.read_csv(io.StringIO(response.text))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parsing error: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Data source was empty")

    # Save df to a temp CSV so the analysis pipeline can load it
    job_id = str(uuid.uuid4())
    temp_path = str(UPLOAD_DIR / f"{job_id}.csv")
    df.to_csv(temp_path, index=False)

    # Build config and kick off the same analysis pipeline
    from models.request_models import AnalysisConfig
    from routers.analyze import _run_analysis
    import job_store

    config = AnalysisConfig(
        target_column=req.target_column,
        bias_threshold=req.bias_threshold,
    )

    job_store.set_processing(job_id, 0.0, "Queued")
    background_tasks.add_task(_run_analysis, job_id, temp_path, config)

    logger.info(f"Sheets import queued as job {job_id} — {len(df)} rows, {len(df.columns)} columns")

    return {
        "status": "accepted",
        "job_id": job_id,
        "rows": len(df),
        "columns": df.columns.tolist(),
    }