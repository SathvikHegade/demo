# DataForge Architecture

## Components

The system is composed of several independent components communicating over REST APIs and WebSockets.

```
frontend/                 backend/
+-------------------+     +------------------+     +-------------------+
| React + Vite App  | <-> | FastAPI Server   | <-> | Redis / Celery    |
| (UI Dashboard)    |     | (Rest API & WS)  |     | (Async Processing)|
+-------------------+     +------------------+     +-------------------+
                              |                             |
                              v                             v
                        +------------------+      +-------------------+
                        | dataforge        | ---> | Gemini / Claude   |
                        | _analytics       |      | (LLM Services)    |
                        +------------------+      +-------------------+
```

## Data Flow

1. Upload file or provide Kaggle dataset ID via `/api/analyze` or `/api/import/kaggle`.
2. Backend assigns a `job_id`, saves to local upload volume, and queues a Celery task.
3. Client opens a WebSocket to `/ws/{job_id}`.
4. Worker (or main thread) calls `dataforge_analytics.*` logic.
5. As it progresses (Profiler -> Duplicate -> Bias -> AI Service), Redis updates state and WS emits JSON to the client.
6. Finally, AI suggestions are retrieved from Gemini and saved. Client fetches `/api/report/{job_id}`.