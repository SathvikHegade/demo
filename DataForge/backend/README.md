# DataForge Sentinel Backend

This backend adds a full Dataset Quality Analyzer pipeline:
- Bias analysis
- Noise and missingness checks
- Duplication detection (exact + near)
- Class imbalance metrics
- Composite quality score
- AI-grounded remediation summary

## Quick Start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload
```

API docs: `http://localhost:8000/docs`

## Optional: Gemini AI output

The backend can optionally call Google Gemini for:
- The remediation brief (`ai_report`) in the `/analyze` response
- A structured, strict-JSON cleaning analysis (`cleaning_analysis`) over a small CSV sample

Environment variables:

- `GEMINI_API_KEY` (optional)
	- If not set, the backend uses a deterministic fallback for `ai_report`.
- `ENABLE_GEMINI_CLEANING_ANALYSIS` (optional)
	- Set to `1` to attach `cleaning_analysis` to `/analyze` responses (requires `GEMINI_API_KEY`).
	- Alternatively, send `enable_gemini_cleaning=true` as a multipart form field to `/analyze` for per-request control.

Do not hard-code or commit API keys to the repository.

## CLI

```bash
python cli.py analyze --file ../sample.csv --target target --sensitive gender,region
```

Output report is written to `backend/artifacts/cli_report.json`.
