from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import re
import requests
import io
import pandas as pd

router = APIRouter(prefix="/api/import/sheets", tags=["import"])
logger = logging.getLogger(__name__)

class SheetsImportRequest(BaseModel):
    url: str

@router.post("")
async def import_google_sheets(req: SheetsImportRequest):
    url = req.url
    
    # Check if this is a Google Sheets URL
    google_sheets_match = re.match(r"https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if google_sheets_match:
        sheet_id = google_sheets_match.group(1)
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    else:
        # Otherwise, maybe it's just a raw CSV URL (GitHub Raw, Data.gov, etc)
        csv_url = url

    try:
        response = requests.get(csv_url, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download from {csv_url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch data from URL: {str(e)}")

    content_type = response.headers.get("Content-Type", "")
    
    # In a real setup we might write this content to disk and pass it along safely
    try:
        if "csv" in content_type or url.endswith(".csv"):
             df = pd.read_csv(io.StringIO(response.text), nrows=10000) # Read only sample or full
        elif "json" in content_type:
             df = pd.read_json(io.StringIO(response.text))
        else:
             df = pd.read_csv(io.StringIO(response.text)) # Fallback to trying to read as CSV
    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Parsing error: File format not supported or invalid CSV: {str(e)}")
    
    if df.empty:
         raise HTTPException(status_code=400, detail="Data source was empty")
         
    # Pass df into celery task or main processor
    
    return {
        "status": "accepted",
        "rows": len(df),
        "columns": df.columns.tolist()
    }