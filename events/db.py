"""SQLite sessions, users, and procedure events."""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

import bcrypt


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class Database:
    def __init__(self, path: Path | None = None):
        if path is None:
            root = Path(os.environ.get("APP_DATA", "data"))
            root.mkdir(parents=True, exist_ok=True)
            path = root / "app.db"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init()

    def _init(self) -> None:
        with self._lock:
            self.conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    created_by TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY,
                    session_id INTEGER NOT NULL,
                    ts TEXT NOT NULL,
                    type TEXT NOT NULL,
                    class_name TEXT,
                    track_id INTEGER,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                );
                """
            )
            self.conn.commit()
            self._seed()

    def _seed(self) -> None:
        existing = self.conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        if existing:
            return
        accounts = (
            ("nurse", "nurse123", "nurse"),
            ("admin", "admin123", "admin"),
        )
        for username, password, role in accounts:
            self.conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (username, hash_password(password), role),
            )
        self.conn.commit()

    def user_by_name(self, username: str):
        with self._lock:
            return self.conn.execute(
                "SELECT * FROM users WHERE username = ?",
                (username,),
            ).fetchone()

    def create_session(self, name: str, username: str) -> dict:
        with self._lock:
            cur = self.conn.execute(
                "INSERT INTO sessions (name, started_at, created_by) VALUES (?, ?, ?)",
                (name.strip() or "Untitled procedure", utc_now(), username),
            )
            self.conn.commit()
            return self._session(cur.lastrowid)

    def active_session(self):
        with self._lock:
            row = self.conn.execute(
                "SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1"
            ).fetchone()
            return dict(row) if row else None

    def end_session(self, session_id: int):
        with self._lock:
            row = self._session(session_id)
            if row is None:
                return None
            if row["ended_at"] is None:
                self.conn.execute(
                    "UPDATE sessions SET ended_at = ? WHERE id = ?",
                    (utc_now(), session_id),
                )
                self.conn.commit()
            return self._session(session_id)

    def add_event(self, session_id: int, event_type: str, class_name, track_id):
        with self._lock:
            session = self._session(session_id)
            if session is None or session["ended_at"] is not None:
                return None
            cur = self.conn.execute(
                """
                INSERT INTO events (session_id, ts, type, class_name, track_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (session_id, utc_now(), event_type, class_name, track_id),
            )
            self.conn.commit()
            return self._event(cur.lastrowid)

    def events(self, session_id: int) -> list[dict]:
        with self._lock:
            rows = self.conn.execute(
                "SELECT * FROM events WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def recent_events(self, session_id: int, limit: int = 30) -> list[dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT * FROM events
                WHERE session_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (session_id, limit),
            ).fetchall()
            return [dict(row) for row in reversed(rows)]

    def summary(self, session_id: int, include_all: bool = True) -> list[dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT class_name, COUNT(*) AS enter_count
                FROM events
                WHERE session_id = ? AND type = 'tool_enter' AND class_name IS NOT NULL
                GROUP BY class_name
                ORDER BY class_name
                """,
                (session_id,),
            ).fetchall()
            counts = {row["class_name"]: row["enter_count"] for row in rows}
            if not include_all:
                return [
                    {"class": row["class_name"], "enter_count": row["enter_count"]}
                    for row in rows
                ]
            from domain import CLASSES

            all_classes = list(CLASSES)
            for cls in counts:
                if cls not in all_classes:
                    all_classes.append(cls)
            return [
                {"class": cls, "enter_count": counts.get(cls, 0)}
                for cls in all_classes
            ]

    def list_sessions(self, on_date: str | None = None) -> list[dict]:
        with self._lock:
            if on_date:
                rows = self.conn.execute(
                    """
                    SELECT * FROM sessions
                    WHERE started_at LIKE ?
                    ORDER BY id DESC
                    """,
                    (on_date + "%",),
                ).fetchall()
            else:
                rows = self.conn.execute(
                    "SELECT * FROM sessions ORDER BY id DESC"
                ).fetchall()
            return [dict(row) for row in rows]

    def get_session(self, session_id: int):
        with self._lock:
            return self._session(session_id)

    def _session(self, session_id: int):
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,),
        ).fetchone()
        return dict(row) if row else None

    def _event(self, event_id: int):
        row = self.conn.execute(
            "SELECT * FROM events WHERE id = ?",
            (event_id,),
        ).fetchone()
        return dict(row) if row else None
