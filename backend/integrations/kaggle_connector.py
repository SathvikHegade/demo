import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging

try:
    from kaggle.api.kaggle_api_extended import KaggleApi
except ImportError:
    KaggleApi = None

router = APIRouter(prefix="/api/import/kaggle", tags=["import"])
logger = logging.getLogger(__name__)

class KaggleImportRequest(BaseModel):
    dataset_id: str

@router.post("")
async def import_kaggle(req: KaggleImportRequest, background_tasks: BackgroundTasks):
    if KaggleApi is None:
        raise HTTPException(status_code=500, detail="Kaggle package not installed")
    
    # Must have Kaggle credentials locally or in environment
    if not os.environ.get("KAGGLE_USERNAME") or not os.environ.get("KAGGLE_KEY"):
         raise HTTPException(status_code=401, detail="Kaggle credentials not configured")

    try:
        api = KaggleApi()
        api.authenticate()
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Kaggle authentication failed: {str(e)}")

    dataset = req.dataset_id

    # Create temporary directory for extraction
    tmp_dir = tempfile.mkdtemp()
    
    try:
        # Download and extract dataset to tmp_dir
        api.dataset_download_files(dataset, path=tmp_dir, unzip=True)
    except Exception as e:
         shutil.rmtree(tmp_dir)
         raise HTTPException(status_code=400, detail=f"Failed to download dataset: {str(e)}")

    # Find the first valid CSV file
    download_dir = Path(tmp_dir)
    csv_files = list(download_dir.glob("**/*.csv"))
    
    if not csv_files:
        shutil.rmtree(tmp_dir)
        raise HTTPException(status_code=404, detail="No CSV files found in Kaggle dataset")

    target_file = csv_files[0]
    
    # Here, we would enqueue the target_file to our main processing pipeline.
    # We will just return the file path or a mocked job ID for now.
    
    # TODO: Connect to your actual analysis pipeline / celery worker here
    # Start background task that executes pipeline on target_file
    
    return {
        "status": "accepted",
        "dataset_name": dataset,
        "selected_file": target_file.name,
        "job_id": "kaggle_" + dataset.replace("/", "_")
    }