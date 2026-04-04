from __future__ import annotations

import json
import uuid
import re
import os
import requests
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def _load_local_env_files() -> None:
    """Best-effort loader for local-only env files.

    Supports `.env` and `.env.local` located in either:
    - DataForge/ (project root)
    - DataForge/backend/

    Values never override already-set environment variables.
    """

    here = Path(__file__).resolve().parent
    root = here.parent
    candidates = [root / ".env.local", root / ".env", here / ".env.local", here / ".env"]
    for path in candidates:
        if not path.exists():
            continue
        try:
            for raw_line in path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[len("export ") :].strip()
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if not key:
                    continue
                if key in os.environ:
                    continue
                os.environ[key] = value
        except Exception:
            # Never block server startup because of local env parsing.
            continue


_load_local_env_files()

import pandas as pd
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from analysis.engine import run_full_analysis
from ai.generator import generate_grounded_report
from ai.cleaning import (
    apply_cleaning_analysis,
    generate_cleaning_analysis,
    generate_cleaning_plan,
    generate_deterministic_cleaning_plan,
)
from ai.quality_report import deterministic_quality_report, generate_quality_report

APP_DIR = Path(__file__).resolve().parent
ARTIFACTS = APP_DIR / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DataForge Sentinel API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── PII PATTERNS ─────────────────────────────────────────────────────────────
_PII_PATTERNS: Dict[str, re.Pattern] = {
    "email": re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"),
    "phone": re.compile(r"(\+?\d[\d\s\-().]{7,}\d)"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d[ -]?){13,16}\b")
}

def detect_pii(df: pd.DataFrame) -> dict:
    pii_report = {}
    for col in df.columns:
        if df[col].dtype == object:
            sample = " ".join(df[col].dropna().astype(str).sample(min(len(df), 500), random_state=42).tolist())
            found = [name for name, pat in _PII_PATTERNS.items() if pat.search(sample)]
            if found:
                pii_report[col] = found
    return pii_report

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
    async def send_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

manager = ConnectionManager()

def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/download/cleaned/{job_id}.csv")
def download_cleaned_csv(job_id: str) -> FileResponse:
    cleaned_path = ARTIFACTS / f"{job_id}_cleaned.csv"
    if not cleaned_path.exists():
        raise HTTPException(status_code=404, detail="Cleaned CSV not found")
    return FileResponse(
        path=str(cleaned_path),
        media_type="text/csv",
        filename=f"{job_id}_cleaned.csv",
    )

@app.post("/import/kaggle")
async def import_kaggle(dataset_id: str = Form(...), target_column: str | None = Form(default=None), sensitive_columns: str | None = Form(default=None), client_id: str | None = Form(default=None)) -> JSONResponse:
    import json, uuid, shutil, tempfile, pandas as pd, os, asyncio
    from pathlib import Path
    
    if client_id:
        await manager.send_message({"status": "authenticating_kaggle", "progress": 5}, client_id)
        
    # Check if either username/key pair exists OR the new single token format is present
    has_legacy_credentials = os.environ.get("KAGGLE_USERNAME") and os.environ.get("KAGGLE_KEY")
    has_token_credentials = os.environ.get("KAGGLE_API_TOKEN") is not None
    
    if not (has_legacy_credentials or has_token_credentials):
        # Setup dummy credentials so the kaggle package import doesn't crash the server
        os.environ["KAGGLE_USERNAME"] = "dummy"
        os.environ["KAGGLE_KEY"] = "dummy"
        has_real_credentials = False
    else:
        has_real_credentials = True

    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except Exception as e:
        return JSONResponse({"error": f"kaggle package error: {str(e)}"}, status_code=500)
    
    if not has_real_credentials:
        if client_id:
            await manager.send_message({"status": "error", "message": "Credentials missing"}, client_id)
        return JSONResponse(
            {"error": "Kaggle credentials not found! Set KAGGLE_API_TOKEN in your environment."}, 
            status_code=400
        )
        
    try:
        if client_id:
            await manager.send_message({"status": "downloading_kaggle_dataset", "progress": 15}, client_id)
        api = KaggleApi()
        api.authenticate()
    except Exception as e:
        return JSONResponse({"error": f"Kaggle authentication failed: {str(e)}"}, status_code=500)

    raw = dataset_id.strip()
    if "kaggle.com/datasets/" in raw:
        raw = raw.split("kaggle.com/datasets/")[-1]
    dataset = raw.strip("/")

    tmp_dir = tempfile.mkdtemp()
    try:
        api.dataset_download_files(dataset, path=tmp_dir, unzip=True)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return JSONResponse({"error": f"Failed to download '{dataset}': {str(e)}"}, status_code=400)

    csv_files = sorted(Path(tmp_dir).glob("**/*.csv"))
    if not csv_files:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return JSONResponse({"error": "No CSV files found in Kaggle dataset"}, status_code=404)

    if client_id:
        await manager.send_message({"status": "processing_csv_and_pii", "progress": 30}, client_id)

    source_csv = csv_files[0]
    job_id = str(uuid.uuid4())
    dest_path = str(ARTIFACTS / f"{job_id}.csv")
    
    try:
        df = pd.read_csv(source_csv, encoding="utf-8", encoding_errors="replace", low_memory=False)
        df.to_csv(dest_path, index=False, encoding="utf-8")
        pii_leaks = detect_pii(df)
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return JSONResponse({"error": f"Failed to process CSV: {str(e)}"}, status_code=400)
        
    shutil.rmtree(tmp_dir, ignore_errors=True)

    if client_id:
        await manager.send_message({"status": "analyzing_quality", "progress": 50}, client_id)
        await asyncio.sleep(0.5)

    config = {
        "target_column": target_column,
        "sensitive_columns": [c.strip() for c in (sensitive_columns or "").split(",") if c.strip()],
    }
    result = run_full_analysis(dest_path, config=config)
    result["pii_leaks"] = pii_leaks
    
    if client_id:
        await manager.send_message({"status": "generating_ai_report", "progress": 80}, client_id)
        
    ai_report = generate_grounded_report(result)
    payload = {
        "job_id": job_id,
        "source_filename": source_csv.name,
        "dataset_size_bytes": int(Path(dest_path).stat().st_size) if Path(dest_path).exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
        "ai_report": ai_report,
    }

    # Attach a PDF-friendly quality report (Gemini if configured; else deterministic)
    try:
        sample_csv = df.head(200).to_csv(index=False)
        qr = generate_quality_report(sample_csv)
        if not isinstance(qr, dict):
            qr = deterministic_quality_report(
                df,
                dataset_size_bytes=payload.get("dataset_size_bytes"),
                quality_score=float(result.get("quality_score")) if result.get("quality_score") is not None else None,
                score_breakdown=result.get("score_breakdown") if isinstance(result.get("score_breakdown"), dict) else None,
            )
        # Ensure core metrics are accurate from the actual payload
        qr.setdefault("core_metrics", {})
        qr["core_metrics"]["rows"] = int(len(df))
        qr["core_metrics"]["columns"] = int(len(df.columns))
        if payload.get("dataset_size_bytes") is not None:
            qr["core_metrics"]["size_mb"] = round(float(payload["dataset_size_bytes"]) / (1024 * 1024), 2)
        payload["quality_report"] = qr
    except Exception:
        pass

    # Consistent cleaned CSV artifact for import flows too
    try:
        cleaning_plan = generate_deterministic_cleaning_plan(df)
        cleaned_df = apply_cleaning_analysis(df, {"cleaning_plan": cleaning_plan})
        cleaned_path = ARTIFACTS / f"{job_id}_cleaned.csv"
        cleaned_df.to_csv(cleaned_path, index=False, encoding="utf-8")
        payload["cleaned_csv_url"] = f"/download/cleaned/{job_id}.csv"
    except Exception:
        pass
    (ARTIFACTS / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    
    if client_id:
        await manager.send_message({"status": "complete", "progress": 100}, client_id)
        
    return JSONResponse(payload)

@app.post("/import/huggingface")
async def import_huggingface(dataset_name: str = Form(...), split: str = Form(default="train"), max_rows: int = Form(default=10000), target_column: str | None = Form(default=None), sensitive_columns: str | None = Form(default=None), client_id: str | None = Form(default=None)) -> JSONResponse:
    import json, uuid, pandas as pd, asyncio
    from pathlib import Path
    try:
        from datasets import load_dataset
    except ImportError:
        return JSONResponse({"error": "datasets package not installed"}, status_code=500)
        
    if client_id:
        await manager.send_message({"status": "downloading_hf_dataset", "progress": 15}, client_id)

    try:
        # HF expects something like 'yelp_review_full' for the dataset.
        ds = load_dataset(dataset_name, split=split, trust_remote_code=True)
        if len(ds) > max_rows:
            ds = ds.select(range(max_rows))
        df = ds.to_pandas()
    except Exception as e:
        return JSONResponse({"error": f"Hugging Face dataset error: {str(e)}. Try a popular dataset name like 'rotten_tomatoes' or 'imdb'."}, status_code=400)

    if df.empty:
        return JSONResponse({"error": f"Dataset '{dataset_name}' is empty"}, status_code=400)

    if client_id:
        await manager.send_message({"status": "processing_csv_and_pii", "progress": 30}, client_id)

    for col in df.columns:
        if df[col].dtype == object:
            try:
                df[col] = df[col].astype(str)
            except Exception:
                df = df.drop(columns=[col])

    job_id = str(uuid.uuid4())
    dest_path = str(ARTIFACTS / f"{job_id}.csv")
    df.to_csv(dest_path, index=False, encoding="utf-8")

    try:
        pii_leaks = detect_pii(df)
    except:
        pii_leaks = {}

    if client_id:
        await manager.send_message({"status": "analyzing_quality", "progress": 50}, client_id)
        await asyncio.sleep(0.5)

    config = {
        "target_column": target_column,
        "sensitive_columns": [c.strip() for c in (sensitive_columns or "").split(",") if c.strip()],
    }
    result = run_full_analysis(dest_path, config=config)
    result["pii_leaks"] = pii_leaks
    
    if client_id:
        await manager.send_message({"status": "generating_ai_report", "progress": 80}, client_id)

    ai_report = generate_grounded_report(result)
    payload = {
        "job_id": job_id,
        "source_filename": f"{dataset_name}_{split}.csv",
        "dataset_size_bytes": int(Path(dest_path).stat().st_size) if Path(dest_path).exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
        "ai_report": ai_report,
    }

    try:
        sample_csv = df.head(200).to_csv(index=False)
        qr = generate_quality_report(sample_csv)
        if not isinstance(qr, dict):
            qr = deterministic_quality_report(
                df,
                dataset_size_bytes=payload.get("dataset_size_bytes"),
                quality_score=float(result.get("quality_score")) if result.get("quality_score") is not None else None,
                score_breakdown=result.get("score_breakdown") if isinstance(result.get("score_breakdown"), dict) else None,
            )
        qr.setdefault("core_metrics", {})
        qr["core_metrics"]["rows"] = int(len(df))
        qr["core_metrics"]["columns"] = int(len(df.columns))
        if payload.get("dataset_size_bytes") is not None:
            qr["core_metrics"]["size_mb"] = round(float(payload["dataset_size_bytes"]) / (1024 * 1024), 2)
        payload["quality_report"] = qr
    except Exception:
        pass

    try:
        cleaning_plan = generate_deterministic_cleaning_plan(df)
        cleaned_df = apply_cleaning_analysis(df, {"cleaning_plan": cleaning_plan})
        cleaned_path = ARTIFACTS / f"{job_id}_cleaned.csv"
        cleaned_df.to_csv(cleaned_path, index=False, encoding="utf-8")
        payload["cleaned_csv_url"] = f"/download/cleaned/{job_id}.csv"
    except Exception:
        pass
    (ARTIFACTS / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if client_id:
        await manager.send_message({"status": "complete", "progress": 100}, client_id)

    return JSONResponse(payload)

import asyncio

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    target_column: str | None = Form(default=None),
    sensitive_columns: str | None = Form(default=None),
    client_id: str | None = Form(default=None),
    enable_gemini_cleaning: bool = Form(default=False),
) -> JSONResponse:
    job_id = str(uuid.uuid4())
    if client_id:
        await manager.send_message({"status": "uploading", "progress": 10}, client_id)
        
    raw_path = ARTIFACTS / f"{job_id}_{file.filename}"
    raw_path.write_bytes(await file.read())

    if client_id:
        await manager.send_message({"status": "checking_pii", "progress": 30}, client_id)

    df: pd.DataFrame | None = None
    try:
        df = pd.read_csv(raw_path, nrows=50000)
        pii_leaks = detect_pii(df)
    except Exception:
        pii_leaks = {}

    if client_id:
        await manager.send_message({"status": "analyzing_quality", "progress": 50}, client_id)
        # Small sleep just for UI effect to simulate heavy processing
        await asyncio.sleep(0.5)

    config = {
        "target_column": target_column,
        "sensitive_columns": [c.strip() for c in (sensitive_columns or "").split(",") if c.strip()],
    }
    result = run_full_analysis(str(raw_path), config=config)
    result["pii_leaks"] = pii_leaks
    
    if client_id:
        await manager.send_message({"status": "generating_ai_report", "progress": 80}, client_id)

    ai_report = generate_grounded_report(result)
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "source_filename": file.filename,
        "dataset_size_bytes": int(raw_path.stat().st_size) if raw_path.exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
        "ai_report": ai_report,
    }

    # Always generate a deterministic cleaned CSV for downloads.
    # Optional: when Gemini is enabled/configured, attach cleaning_analysis and a model-proposed plan.
    should_run_gemini = enable_gemini_cleaning or os.getenv("ENABLE_GEMINI_CLEANING_ANALYSIS") == "1"
    try:
        if df is None:
            df = pd.read_csv(raw_path, nrows=50000)
        sample_csv = df.head(200).to_csv(index=False)

        cleaning_analysis = None
        cleaning_plan = None
        if should_run_gemini:
            cleaning_plan = generate_cleaning_plan(sample_csv)
            cleaning_analysis = generate_cleaning_analysis(sample_csv)

        if cleaning_plan is None:
            cleaning_plan = generate_deterministic_cleaning_plan(df)
        payload["cleaning_plan"] = cleaning_plan

        if cleaning_analysis is not None:
            payload["cleaning_analysis"] = cleaning_analysis

        combined: Dict[str, Any] = {}
        if isinstance(cleaning_analysis, dict):
            combined.update(cleaning_analysis)
        if isinstance(cleaning_plan, dict):
            combined["cleaning_plan"] = cleaning_plan

        cleaned_df = apply_cleaning_analysis(df, combined or None)
        cleaned_path = ARTIFACTS / f"{job_id}_cleaned.csv"
        cleaned_df.to_csv(cleaned_path, index=False, encoding="utf-8")
        payload["cleaned_csv_url"] = f"/download/cleaned/{job_id}.csv"
    except Exception:
        # Never fail the main analysis if Gemini or CSV writing errors occur.
        pass

    # Attach a PDF-friendly quality report: Gemini JSON when enabled+configured, else deterministic fallback.
    try:
        if df is None:
            df = pd.read_csv(raw_path, nrows=50000)
        sample_csv = df.head(200).to_csv(index=False)

        quality_report = generate_quality_report(sample_csv) if should_run_gemini else None
        if not isinstance(quality_report, dict):
            quality_report = deterministic_quality_report(
                df,
                dataset_size_bytes=payload.get("dataset_size_bytes"),
                quality_score=float(result.get("quality_score")) if result.get("quality_score") is not None else None,
                score_breakdown=result.get("score_breakdown") if isinstance(result.get("score_breakdown"), dict) else None,
            )

        quality_report.setdefault("core_metrics", {})
        quality_report["core_metrics"]["rows"] = int(len(df))
        quality_report["core_metrics"]["columns"] = int(len(df.columns))
        if payload.get("dataset_size_bytes") is not None:
            quality_report["core_metrics"]["size_mb"] = round(float(payload["dataset_size_bytes"]) / (1024 * 1024), 2)
        payload["quality_report"] = quality_report
    except Exception:
        pass
    (ARTIFACTS / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if client_id:
        await manager.send_message({"status": "complete", "progress": 100}, client_id)

    return JSONResponse(payload)
    
@app.post("/import/sheets")
async def import_google_sheets(url: str = Form(...), target_column: str | None = Form(default=None), sensitive_columns: str | None = Form(default=None), client_id: str | None = Form(default=None)) -> JSONResponse:
    import json, uuid, re, requests, io, pandas as pd, asyncio
    from pathlib import Path

    if client_id:
        await manager.send_message({"status": "fetching_google_sheets", "progress": 15}, client_id)

    google_sheets_match = re.match(r"https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if google_sheets_match:
        sheet_id = google_sheets_match.group(1)
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    else:
        csv_url = url

    try:
        response = requests.get(csv_url, timeout=30)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        if client_id:
            await manager.send_message({"status": "error", "message": str(e)}, client_id)
        return JSONResponse({"error": f"Failed to fetch data from URL: {str(e)}"}, status_code=400)

    content_type = response.headers.get("Content-Type", "")

    try:
        if "csv" in content_type or url.endswith(".csv"):
            df = pd.read_csv(io.StringIO(response.text), nrows=50000)
        elif "json" in content_type:
            df = pd.read_json(io.StringIO(response.text))
        else:
            df = pd.read_csv(io.StringIO(response.text))
    except Exception as e:
        return JSONResponse({"error": f"Parsing error: {str(e)}"}, status_code=400)

    if df.empty:
        return JSONResponse({"error": "Data source was empty"}, status_code=400)

    if client_id:
        await manager.send_message({"status": "processing_csv_and_pii", "progress": 35}, client_id)

    job_id = str(uuid.uuid4())
    dest_path = str(ARTIFACTS / f"{job_id}.csv")
    df.to_csv(dest_path, index=False, encoding="utf-8")
    
    try:
        pii_leaks = detect_pii(df)
    except:
        pii_leaks = {}

    if client_id:
        await manager.send_message({"status": "analyzing_quality", "progress": 50}, client_id)
        await asyncio.sleep(0.5)

    config = {
        "target_column": target_column,
        "sensitive_columns": [c.strip() for c in (sensitive_columns or "").split(",") if c.strip()],
    }
    result = run_full_analysis(dest_path, config=config)
    result["pii_leaks"] = pii_leaks
    
    if client_id:
        await manager.send_message({"status": "generating_ai_report", "progress": 80}, client_id)
        
    ai_report = generate_grounded_report(result)
    payload = {
        "job_id": job_id,
        "source_filename": "google_sheets.csv",
        "dataset_size_bytes": int(Path(dest_path).stat().st_size) if Path(dest_path).exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
        "ai_report": ai_report,
    }

    try:
        sample_csv = df.head(200).to_csv(index=False)
        qr = generate_quality_report(sample_csv)
        if not isinstance(qr, dict):
            qr = deterministic_quality_report(
                df,
                dataset_size_bytes=payload.get("dataset_size_bytes"),
                quality_score=float(result.get("quality_score")) if result.get("quality_score") is not None else None,
                score_breakdown=result.get("score_breakdown") if isinstance(result.get("score_breakdown"), dict) else None,
            )
        qr.setdefault("core_metrics", {})
        qr["core_metrics"]["rows"] = int(len(df))
        qr["core_metrics"]["columns"] = int(len(df.columns))
        if payload.get("dataset_size_bytes") is not None:
            qr["core_metrics"]["size_mb"] = round(float(payload["dataset_size_bytes"]) / (1024 * 1024), 2)
        payload["quality_report"] = qr
    except Exception:
        pass

    try:
        cleaning_plan = generate_deterministic_cleaning_plan(df)
        cleaned_df = apply_cleaning_analysis(df, {"cleaning_plan": cleaning_plan})
        cleaned_path = ARTIFACTS / f"{job_id}_cleaned.csv"
        cleaned_df.to_csv(cleaned_path, index=False, encoding="utf-8")
        payload["cleaned_csv_url"] = f"/download/cleaned/{job_id}.csv"
    except Exception:
        pass
    (ARTIFACTS / f"{job_id}.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    
    if client_id:
        await manager.send_message({"status": "complete", "progress": 100}, client_id)
        
    return JSONResponse(payload)
def get_analysis(job_id: str) -> JSONResponse:
    return JSONResponse(_read_json(ARTIFACTS / f"{job_id}.json"))


@app.get("/report/{job_id}.json")
def report_json(job_id: str) -> JSONResponse:
    return JSONResponse(_read_json(ARTIFACTS / f"{job_id}.json"))


@app.get("/report/{job_id}.html")
def report_html(job_id: str) -> HTMLResponse:
    payload = _read_json(ARTIFACTS / f"{job_id}.json")
    score = float(payload["result"]["quality_score"])
    score_color = "#2FBF71" if score >= 85 else "#F2A900" if score >= 65 else "#E5484D"
    breakdown = payload["result"].get("score_breakdown", {})
    bars = "".join(
        [
            f"<div style='margin: 8px 0'><div style='display:flex;justify-content:space-between'>"
            f"<span style='text-transform:capitalize'>{k}</span><span>{v:.2f}</span></div>"
            f"<div style='height:8px;background:#2A2A33;border-radius:6px;overflow:hidden'>"
            f"<div style='height:8px;width:{max(2,min(100,v))}%;background:linear-gradient(90deg,#C46A2D,#7A5AF8)'></div></div></div>"
            for k, v in breakdown.items()
        ]
    )
    actions = "".join(
        [
            f"<li><strong>{a['priority']}.</strong> {a['action']} <em>({a['effort']})</em></li>"
            for a in payload["ai_report"].get("top_actions", [])
        ]
    )
    html = f"""
    <html>
      <head><title>DataForge Sentinel Report</title></head>
      <body style="font-family: Inter, Arial, sans-serif; margin: 2rem; background:#0B0B0F; color:#EDE8E4;">
        <h1 style="margin:0 0 4px 0">DataForge Sentinel Report</h1>
        <p style="opacity:0.8;margin:0 0 16px 0"><strong>Job:</strong> {job_id}</p>
        <div style="padding:16px;border:1px solid #2A2A33;background:#13131A;border-radius:12px">
          <p style="margin:0 0 6px 0;opacity:0.8">Quality Score</p>
          <h2 style="margin:0;color:{score_color}">{score:.2f}</h2>
          <p style="margin:8px 0 0 0">{payload['ai_report']['deployment_readiness']}</p>
        </div>
        <div style="padding:16px;border:1px solid #2A2A33;background:#13131A;border-radius:12px;margin-top:14px">
          <h3 style="margin-top:0">Pillar Scores</h3>
          {bars}
        </div>
        <div style="padding:16px;border:1px solid #2A2A33;background:#13131A;border-radius:12px;margin-top:14px">
          <h3 style="margin-top:0">AI Executive Summary</h3>
          <p>{payload['ai_report']['executive_summary']}</p>
          <ol>{actions}</ol>
        </div>
        <details style="margin-top:14px">
          <summary>Raw JSON</summary>
          <pre>{json.dumps(payload['result'], indent=2)}</pre>
        </details>
      </body>
    </html>
    """
    return HTMLResponse(content=html)
