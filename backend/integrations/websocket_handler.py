from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
from typing import Dict
from asyncio import sleep

router = APIRouter(tags=["websockets"])
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[job_id] = websocket

    def disconnect(self, job_id: str):
        if job_id in self.active_connections:
            del self.active_connections[job_id]

    async def send_personal_message(self, message: dict, job_id: str):
        if job_id in self.active_connections:
            await self.active_connections[job_id].send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await manager.connect(job_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # We can handle inputs from the client if needed here.
            # Example: client sending "cancel"
    except WebSocketDisconnect:
        manager.disconnect(job_id)
        logger.info(f"Client # {job_id} left the chat")

# Example publisher function (to use in Celery or BackgroundTasks)
async def broadcast_progress(job_id: str, stage: str, progress: float, message: str, report: dict = None):
    # Use global manager instance
    payload = {
        "stage": stage,
        "progress": progress,
        "message": message
    }
    if report:
        payload["report"] = report
    await manager.send_personal_message(payload, job_id)