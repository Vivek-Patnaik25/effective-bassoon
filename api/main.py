"""Theatre API: sessions, live socket, history, and PDF."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.auth import authenticate, create_token, current_user, decode_token, require_admin
from api.pipeline import SessionPipeline
from api.report import build_pdf
from events.db import Database
from fastapi.responses import Response
from samples.generate import ensure_samples

db: Database | None = None
pipeline: SessionPipeline | None = None


def get_db() -> Database:
    if db is None:
        raise HTTPException(status_code=503, detail="Database is not ready")
    return db


def get_pipeline() -> SessionPipeline:
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline is not ready")
    return pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, pipeline
    db = Database()
    pipeline = SessionPipeline(db)
    ensure_samples()
    print("Demo accounts: nurse / nurse123 and admin / admin123")
    yield
    if pipeline is not None:
        await pipeline.shutdown()


allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app = FastAPI(title="Surgical tool log", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app" if "*" not in allowed_origins else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginBody(BaseModel):
    username: str
    password: str


class SessionBody(BaseModel):
    name: str = Field(default="Untitled procedure", max_length=80)


@app.post("/login")
def login(body: LoginBody, database: Database = Depends(get_db)):
    user = authenticate(database, body.username, body.password)
    return {
        "token": create_token(user["username"], user["role"]),
        "username": user["username"],
        "role": user["role"],
    }


@app.post("/sessions")
async def create_session(
    body: SessionBody,
    user: dict = Depends(current_user),
    database: Database = Depends(get_db),
    live: SessionPipeline = Depends(get_pipeline),
):
    active = database.active_session()
    if active is not None:
        raise HTTPException(
            status_code=409,
            detail={"message": "A session is already open", "session_id": active["id"]},
        )
    session = database.create_session(body.name, user["username"])
    if os.environ.get("PIPELINE_AUTOSTART", "1") != "0":
        await live.start(session["id"])
    return session


@app.post("/sessions/{session_id}/end")
async def end_session(
    session_id: int,
    user: dict = Depends(current_user),
    database: Database = Depends(get_db),
    live: SessionPipeline = Depends(get_pipeline),
):
    del user
    if live.session_id == session_id:
        live.request_stop()
        await live.shutdown()
    session = database.end_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session": session,
        "events": database.events(session_id),
        "summary": database.summary(session_id),
    }


@app.get("/sessions")
def list_sessions(
    date: str | None = None,
    user: dict = Depends(require_admin),
    database: Database = Depends(get_db),
):
    del user
    return database.list_sessions(date)


@app.get("/sessions/{session_id}")
def read_session(
    session_id: int,
    user: dict = Depends(current_user),
    database: Database = Depends(get_db),
):
    del user
    session = database.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session": session,
        "events": database.events(session_id),
        "summary": database.summary(session_id),
    }


@app.get("/sessions/{session_id}/report.pdf")
def report_pdf(
    session_id: int,
    user: dict = Depends(require_admin),
    database: Database = Depends(get_db),
):
    del user
    session = database.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    payload = build_pdf(session, database.events(session_id), database.summary(session_id))
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="session-{session_id}.pdf"'},
    )


@app.post("/camera/drop")
def drop_camera(
    user: dict = Depends(current_user),
    live: SessionPipeline = Depends(get_pipeline),
):
    del user
    if not live.running():
        raise HTTPException(status_code=409, detail="No live session")
    live.drop_camera()
    return {"camera": "dropped"}


@app.post("/camera/restore")
def restore_camera(
    user: dict = Depends(current_user),
    live: SessionPipeline = Depends(get_pipeline),
):
    del user
    if not live.running():
        raise HTTPException(status_code=409, detail="No live session")
    live.restore_camera()
    return {"camera": "restored"}


@app.websocket("/ws")
async def live_socket(websocket: WebSocket, token: str = "", session_id: int = 0):
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4401)
        return
    del payload
    live = pipeline
    if live is None or live.session_id != session_id:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    live.sockets.add(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "key":
                live.push_key(str(message.get("key", "")))
    except WebSocketDisconnect:
        live.sockets.discard(websocket)
    except Exception:
        live.sockets.discard(websocket)
