from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import tempfile
import uuid
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    load_dataset = None

router = APIRouter(prefix="/api/import/huggingface", tags=["import"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "dataforge_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class HuggingFaceImportRequest(BaseModel):
    dataset_name: str
    split: str = "train"
    max_rows: int = 10000
    target_column: str | None = None
    bias_threshold: float = 0.70


@router.post("")
async def import_huggingface(req: HuggingFaceImportRequest, background_tasks: BackgroundTasks):
    if load_dataset is None:
        raise HTTPException(status_code=500, detail="datasets package not installed. Run: pip install datasets")

    dataset_name = req.dataset_name
    split = req.split
    max_rows = req.max_rows

    logger.info(f"Loading HuggingFace dataset: '{dataset_name}' split='{split}' max_rows={max_rows}")

    try:
        ds = load_dataset(dataset_name, split=split)

        if len(ds) > max_rows:
            ds = ds.select(range(max_rows))

        df = ds.to_pandas()
    except Exception as e:
        logger.error(f"Failed to load HuggingFace dataset '{dataset_name}': {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail=f"Dataset '{dataset_name}' is empty")

    # Drop any non-CSV-friendly columns (e.g. nested dicts/lists from HF datasets)
    for col in df.columns:
        if df[col].dtype == object:
            try:
                df[col] = df[col].astype(str)
            except Exception:
                df = df.drop(columns=[col])

    # Save to UPLOAD_DIR as UTF-8 CSV
    job_id = str(uuid.uuid4())
    dest_path = str(UPLOAD_DIR / f"{job_id}.csv")
    df.to_csv(dest_path, index=False, encoding="utf-8")

    logger.info(f"HuggingFace dataset '{dataset_name}' saved — {len(df)} rows, {len(df.columns)} cols")

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

    logger.info(f"HuggingFace import '{dataset_name}' queued as job {job_id}")

    return {
        "status": "accepted",
        "job_id": job_id,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "dataset_name": dataset_name,
        "split": split,
    }