"""One live session: replay or YOLO, gestures, and the procedure log."""

from __future__ import annotations

import asyncio
import base64
import time

import cv2

from domain import CAMERA_LOST_SECONDS, TICK_SECONDS
from events.engine import EventEngine
from gestures.hand import HandTracker
from perception.source import open_perception


class SessionPipeline:
    def __init__(self, db):
        self.db = db
        self.session_id = None
        self.sockets = set()
        self.keys: list[str] = []
        self.dropped = False
        self._stop = False
        self.task = None
        self.source = None
        self.hand = None
        self.engine = None
        self.last_frame_at = None
        self.last_jpeg = None
        self.gesture_label = "none"
        self.gesture_until = 0.0

    def running(self) -> bool:
        return self.task is not None and not self.task.done() and self.session_id is not None

    async def start(self, session_id: int) -> None:
        await self.shutdown()
        self.session_id = session_id
        self.dropped = False
        self._stop = False
        self.keys = []
        self.last_frame_at = None
        self.last_jpeg = None
        self.gesture_label = "none"
        self.gesture_until = 0.0
        self.source = open_perception()
        self.hand = HandTracker()
        self.hand.open()
        self.engine = EventEngine(self.db, session_id)
        self.task = asyncio.create_task(self._loop())

    def request_stop(self) -> None:
        self._stop = True

    def drop_camera(self) -> None:
        self.dropped = True

    def restore_camera(self) -> None:
        self.dropped = False
        if self.source is not None and getattr(self.source, "eof", False):
            self.source.rewind()
            self.last_frame_at = time.monotonic()

    def push_key(self, key: str) -> None:
        if key in ("p", "f"):
            self.keys.append(key)

    async def shutdown(self) -> None:
        self._stop = True
        task = self.task
        if task is not None and not task.done():
            try:
                await asyncio.wait_for(task, timeout=3)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                task.cancel()
        self.task = None
        self.session_id = None

    async def _loop(self) -> None:
        try:
            while not self._stop:
                payload = await asyncio.to_thread(self._tick)
                await self._broadcast(payload)
                await asyncio.sleep(TICK_SECONDS)
        finally:
            if self.hand is not None:
                await asyncio.to_thread(self.hand.close)
                self.hand = None
            if self.source is not None:
                await asyncio.to_thread(self.source.close)
                self.source = None
            if self.engine is not None:
                self.engine.close()

    def _tick(self) -> dict:
        frame = None
        tools = []
        if not self.dropped and self.source is not None:
            frame, tools = self.source.read()
        now = time.monotonic()
        if frame is not None:
            self.last_frame_at = now
            self.last_jpeg = _jpeg(frame)
            camera_ok = True
        else:
            camera_ok = (
                self.last_frame_at is not None
                and now - self.last_frame_at < CAMERA_LOST_SECONDS
            )
            tools = []
        written = []
        if self.engine is not None:
            written.extend(self._apply_gestures())
            if frame is not None:
                written.extend(self.engine.update(tools))
        gesture = self.gesture_label if now < self.gesture_until else "none"
        raw_gesture = "none"
        gesture_progress = 0.0
        if self.hand and self.hand.available:
            raw_gesture = getattr(self.hand, "raw_gesture", "none")
            gesture_progress = getattr(self.hand, "progress", 0.0)
        event_name = written[-1]["type"] if written else None
        session_id = self.session_id
        return {
            "ts": _iso(),
            "session_id": str(session_id) if session_id is not None else None,
            "camera_ok": camera_ok,
            "tools": tools,
            "gesture": gesture,
            "gesture_raw": raw_gesture,
            "gesture_progress": gesture_progress,
            "event": event_name,
            "events": written,
            "paused": bool(self.engine and self.engine.paused),
            "hand_camera": bool(self.hand and self.hand.available),
            "frame": self.last_jpeg if camera_ok else None,
            "log": self.db.recent_events(session_id, 30) if session_id else [],
        }

    def _apply_gestures(self) -> list[dict]:
        written = []
        pulses = []
        if self.hand is not None:
            hand_pulse = self.hand.poll()
            if hand_pulse != "none":
                pulses.append(hand_pulse)
        if self.keys:
            key = self.keys.pop(0)
            pulses.append("open_palm" if key == "p" else "fist")
        for pulse in pulses:
            self.gesture_label = pulse
            self.gesture_until = time.monotonic() + 1.0
            if pulse == "open_palm":
                written.extend(self.engine.toggle_pause())
            elif pulse == "fist":
                written.extend(self.engine.mark())
        return written

    async def _broadcast(self, payload: dict) -> None:
        dead = []
        for socket in list(self.sockets):
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.sockets.discard(socket)


def _jpeg(frame) -> str:
    ok, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    if not ok:
        return ""
    return base64.b64encode(buffer.tobytes()).decode("ascii")


def _iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
