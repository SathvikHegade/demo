# ⬡ DataForge — AI-Powered Dataset Quality Analyzer

> Upload any CSV, JSON, or Excel file. Get a comprehensive AI quality report — bias flags, noise maps, duplicate clusters, and Gemini-powered fix recommendations — in under a minute.

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg) ![React](https://img.shields.io/badge/React-18-blue.svg) ![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg) ![`AI-Powered`](https://img.shields.io/badge/AI-Powered-orange.svg) ![License](https://img.shields.io/badge/License-MIT-green.svg)

![Demo](docs/images/demo.gif)

---

## Why DataForge?

Data scientists and machine learning engineers spend up to 80% of their time cleaning and preparing data. This process is manual, tedious, and error-prone. Worse, subtle issues like demographic bias, hidden outliers, and implicit data leakage often go unnoticed until a model fails in production.

**DataForge** automates this crucial step. We built a robust, scalable platform that not only profiles your data statistically but actively *reads* it using Google's Gemini LLM. It detects problems classic algorithms miss and provides actionable, code-ready recommendations to fix them.

Our tool bridges the gap between raw data and model-ready datasets, ensuring AI models are trained on high-quality, unbiased, and mathematically sound foundations.

---

## Architecture

```ascii
                                +-------------------+
                                |  React Dashboard  |
                                |  (Vite + Tailwind)|
                                +---------+---------+
                                          | REST + WebSockets
+-----------------+             +---------v---------+
| Kaggle / Sheets |  ------->   | FastAPI Backend   | -----> [ Gemini 1.5 Pro API ] (AI Insights)
| (Integrations)  |             | (DataForge Core)  |
+-----------------+             +---------+---------+
                                          | Celery / BackgroundTasks
                                +---------v---------+
                                | Analytics Engine  |
                                | (Pandas/Scikit)   |
                                +-------------------+
                                 - Profiler
                                 - Bias Detector
                                 - Noise Analyzer
                                 - Quality Scorer
```

---

## Features

| Feature | Description |
|---|---|
| 📊 **Deep Profiling** | Instant statistical breakdown of missing values, uniqueness, and distributions. |
| ⚖️ **Bias Detection** | Identifies severe class imbalances and potential demographic skews. |
| 🗑️ **Noise & Outliers** | Flags anomalous rows, PII leaks, and conflicting labels. |
| 🤖 **AI Insights** | Gemini analyzes the context of your data and suggests tailored fixes. |
| 🔌 **External Integrations** | Direct import from Kaggle, Google Sheets, and HuggingFace. |
| ⚡ **Real-Time Progress** | WebSockets stream updates as large datasets process. |
| 💻 **CLI Tool** | Full terminal experience for Headless usage and CI/CD pipelines. |

---

## Quick Start (Docker)

The fastest way to get DataForge running is via Docker Compose.

```bash
# 1. Clone the repository
git clone https://github.com/your-org/dataforge.git
cd DataForge

# 2. Configure environment (add your Gemini or Anthropic API key)
cp .env.example .env
nano .env # Add GEMINI_API_KEY=your_key_here

# 3. Start the stack
docker-compose up --build
```
> The dashboard will be available at `http://localhost:5173` and the API at `http://localhost:8000`.

---

## Manual Setup

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
### 2. Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

---

## CLI Usage

DataForge includes a standalone CLI tool for automated pipelines.

```bash
# Install the CLI tool
pip install -e cli/

# Analyze a local file and output a colorful terminal report
dataforge analyze data.csv --target-col Income --threshold 0.70

# Save the AI report as JSON
dataforge analyze data.csv --output json --save report.json

# Perform a quick local profile (No AI, instantly returns stats)
dataforge profile dataset.csv

# Compare two datasets
dataforge compare dirty.csv cleaned.csv
```

---

## API Reference

Base URL: `http://localhost:8000`

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Check system status. |
| `/api/analyze` | POST | Upload a file (`multipart/form-data`) to start analysis. Returns `job_id`. |
| `/api/report/{job_id}` | GET | Retrieve the completed analysis report. |
| `/ws/{job_id}` | WS | Connect for real-time progress updates via WebSockets. |
| `/api/import/kaggle` | POST | `{ "dataset_id": "user/dataset" }` - Imports from Kaggle. |
| `/api/import/sheets` | POST | `{ "url": "https://docs..." }` - Imports from Google Sheets. |
| `/api/import/huggingface`| POST | `{ "dataset_name": "...", "split": "train" }` - Imports from HF. |

---

## Integration Details
* **Kaggle**: Requires `KAGGLE_USERNAME` and `KAGGLE_KEY` in `.env` or `~/.kaggle/kaggle.json`. Downloads the first available CSV in the dataset.
* **Google Sheets**: Supports public sheet URLs without OAuth by converting Google Sheets links to CSV export endpoints. 
* **HuggingFace**: Uses `huggingface_hub` to stream in DataFrame splits up to `MAX_FILE_SIZE_MB`.

---

## Tech Stack

| Domain | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS, Chart.js / Recharts |
| **Backend** | Python 3.11, FastAPI, WebSockets |
| **Analytics Engine** | Pandas, Numpy, Scikit-learn |
| **AI Integration** | Google Gemini 1.5 API |
| **DevOps** | Docker, Docker Compose, GitHub Actions CI/CD |
| **CLI** | Click, Rich |

---

## Hackathon Submission

This project was built for the [Hackathon Name].
* **Team:** [Your Team Name]
* **Problem Addressed:** The lack of automated, actionable data quality tooling for AI engineering.
* **Key Achievements:** Full-stack integration, real-time WebSocket progress bars, generic integration connectors, and an elegant UI/UX.

---

## License
MIT License. See [LICENSE](LICENSE) for more details.