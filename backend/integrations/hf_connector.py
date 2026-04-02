from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging

try:
    from datasets import load_dataset
except ImportError:
    load_dataset = None

router = APIRouter(prefix="/api/import/huggingface", tags=["import"])
logger = logging.getLogger(__name__)

class HuggingFaceImportRequest(BaseModel):
    dataset_name: str
    split: str = "train"
    max_rows: int = 10000

@router.post("")
async def import_huggingface(req: HuggingFaceImportRequest, background_tasks: BackgroundTasks):
    if load_dataset is None:
        raise HTTPException(status_code=500, detail="huggingface_hub package not installed")

    dataset_name = req.dataset_name
    split = req.split
    max_rows = req.max_rows

    try:
        # Load dataset from HuggingFace
        # Note: streaming=True could be used, but to_pandas is easier initially
        ds = load_dataset(dataset_name, split=split)
        
        # Take a subset if necessary
        if len(ds) > max_rows:
            ds = ds.select(range(max_rows))
            
        df = ds.to_pandas()
    except Exception as e:
        logger.error(f"Failed to load HuggingFace dataset {dataset_name}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail=f"HuggingFace dataset {dataset_name} is empty")

    # In a real app, save df to a temporary file, pass to processing queue/task
    job_id = f"hf_{dataset_name.replace('/', '_')}"

    return {
        "status": "accepted",
        "dataset_name": dataset_name,
        "rows": len(df),
        "columns": df.columns.tolist(),
        "job_id": job_id
    }