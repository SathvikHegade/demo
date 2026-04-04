# ⬡ DataForge: AI-Powered Dataset Quality Analyzer

## 📋 Project Submission

**Project Name**: DataForge - AI-Powered Dataset Quality Analyzer  
**Team Name**: TATVAMASI<br>
**Team Members**: Kushal V Achar, Hemant Saralaya, Ranganath J, T S Sathvik Hegade<br>
**Track**: Advanced Track<br>
**Live demo**: [DataForge](https://genaidataforge.vercel.app/)

---

## 🚀 Project Overview

**Problem Statement:**  
Data scientists spend up to 80% of their time cleaning and preparing datasets. Manual data quality checks are tedious, error-prone, and often miss subtle issues like demographic bias, hidden outliers, PII leaks, and data leakage that can cause models to fail in production.

**Our Solution:**  
DataForge is an end-to-end platform that automates dataset quality analysis using a combination of statistical algorithms and AI-powered insights. It provides:
- **Automated quality scoring** across multiple dimensions (completeness, consistency, validity, uniqueness)
- **Intelligent bias detection** identifying class imbalances and demographic skews
- **Noise & outlier flagging** with PII leak detection
- **AI-generated recommendations** using Google Gemini to provide actionable, context-aware fixes
- **Multi-source integrations** supporting Kaggle, Google Sheets, and HuggingFace datasets
- **Real-time progress tracking** via WebSockets for large file processing

---

## 🏗️ Architecture

```
┌─────────────────────┐
│  React Dashboard    │
│  (Vite + Tailwind)  │
│  Port: 5173         │
└──────────┬──────────┘
           │ REST API + WebSockets
           │
┌──────────▼──────────┐      ┌──────────────────┐
│  FastAPI Backend    │◄────►│  Gemini AI API   │
│  (Python 3.11)      │      │  (AI Insights)   │
│  Port: 8000         │      └──────────────────┘
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│     DataForge Analytics Engine          │
│  ┌──────────────────────────────────┐   │
│  │ • Statistical Profiler           │   │
│  │ • Bias & Imbalance Detector      │   │
│  │ • Noise & Outlier Analyzer       │   │
│  │ • Duplicate Detection (MinHash)  │   │
│  │ • Quality Scorer                 │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  External Sources   │
│  • Kaggle           │
│  • Google Sheets    │
│  • HuggingFace      │
└─────────────────────┘
```

**Key Components:**
- **Frontend**: React 18 with Vite, TailwindCSS for responsive UI, Recharts for data visualization
- **Backend**: FastAPI with async support, WebSocket for real-time updates
- **Analytics**: Pandas, NumPy, Scikit-learn for statistical analysis
- **AI Integration**: Google Gemini 2.5 flash for context-aware recommendations
- **CLI Tool**: Click + Rich for terminal-based usage



## 🛠️ How to Run Locally

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd DataForge

# 2. Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Start all services
docker-compose up --build

# Access the application:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variable
export GEMINI_API_KEY=your_key_here  # Windows: set GEMINI_API_KEY=your_key_here

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Access at http://localhost:5173
```

#### CLI Tool Setup
```bash
pip install -e cli/

# Analyze a dataset
dataforge analyze sample_data/demo_dirty.csv --target-col Income --threshold 0.70

# Quick profile (no AI)
dataforge profile sample_data/demo_dirty.csv
```

---

## 🎯 Features Implemented

### Core Features
- ✅ **Multi-format Support**: CSV, JSON, Excel (XLSX)
- ✅ **Statistical Profiling**: Missing values, data types, distributions, correlations
- ✅ **Quality Scoring**: Multi-dimensional quality metrics (0-100 scale)
- ✅ **Bias Detection**: Class imbalance, demographic skew identification
- ✅ **Duplicate Detection**: MinHash LSH algorithm for near-duplicate rows
- ✅ **Noise Analysis**: Outlier detection, PII leak scanning
- ✅ **AI Recommendations**: Context-aware fixes via Gemini AI

### Integrations
- ✅ **Kaggle**: Direct dataset import via dataset ID
- ✅ **Google Sheets**: Public sheet URL import
- ✅ **HuggingFace**: Dataset streaming from HF Hub

### Advanced Features
- ✅ **Real-time Updates**: WebSocket-based progress streaming
- ✅ **CLI Tool**: Full terminal interface for CI/CD pipelines
- ✅ **API Documentation**: Auto-generated OpenAPI/Swagger docs
- ✅ **Error Handling**: Graceful failures with detailed error messages

---

## 📚 API Reference

**Base URL**: `http://localhost:8000`

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health check |
| POST | `/api/analyze` | Upload file and start analysis (returns `job_id`) |
| GET | `/api/report/{job_id}` | Retrieve completed analysis report |
| WS | `/ws/{job_id}` | Real-time progress updates |

### Integration Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/import/kaggle` | `{"dataset_id": "username/dataset"}` | Import from Kaggle |
| POST | `/api/import/sheets` | `{"url": "https://docs.google..."}` | Import from Google Sheets |
| POST | `/api/import/huggingface` | `{"dataset_name": "...", "split": "train"}` | Import from HuggingFace |

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@data.csv" \
  -F "target_column=income" \
  -F "quality_threshold=0.7"
```

---

## 🧪 Testing

```bash
# Run backend tests
cd backend
pytest tests/

# Test API endpoints
python tests/test_api.py
```

---

## 🔧 Environment Variables

Required in `.env` file:

```bash
# AI Configuration (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional Configurations
MAX_FILE_SIZE_MB=50
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
ANALYSIS_TIMEOUT_SECONDS=300

# Optional: For Kaggle Integration
KAGGLE_USERNAME=your_kaggle_username
KAGGLE_KEY=your_kaggle_api_key
```

---

## 📦 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, TailwindCSS, Recharts, Framer Motion, Zustand |
| **Backend** | Python 3.11, FastAPI, WebSockets, Uvicorn |
| **Analytics** | Pandas, NumPy, Scikit-learn, SciPy |
| **AI/ML** | Google Gemini 2.5 Flash API |
| **Data Processing** | RapidFuzz (string matching), DataSketch (MinHash), OpenPyXL (Excel) |
| **DevOps** | Docker, Docker Compose, GitHub Actions |
| **CLI** | Click, Rich (terminal UI) |

---

## 🚀 Deployment

The application is production-ready with Docker support and can be deployed to:
- **Render** (Backend + Frontend)
- **Vercel** (Frontend only)

See deployment instructions below in the submission guide.

