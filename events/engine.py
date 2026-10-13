"""Turn per-frame tracks into enter, exit, pause, and mark rows."""

from __future__ import annotations

from domain import ENTER_FRAMES, EXIT_FRAMES


class EventEngine:
    def __init__(self, db, session_id: int):
        self.db = db
        self.session_id = session_id
        self.paused = False
        self.closed = False
        self.tracks: dict[int, dict] = {}

    def toggle_pause(self):
        if self.closed:
            return []
        self.paused = not self.paused
        event_type = "pause" if self.paused else "resume"
        row = self.db.add_event(self.session_id, event_type, None, None)
        return [row] if row else []

    def mark(self):
        if self.closed:
            return []
        row = self.db.add_event(self.session_id, "mark", None, None)
        return [row] if row else []

    def close(self) -> None:
        self.closed = True

    def update(self, tools: list[dict]) -> list[dict]:
        if self.closed:
            return []
        loggable = [tool for tool in tools if tool.get("loggable")]
        present = set()
        written = []
        for tool in loggable:
            track_id = int(tool["track_id"])
            present.add(track_id)
            state = self.tracks.setdefault(
                track_id,
                {"class": tool["class"], "seen": 0, "missing": 0, "active": False},
            )
            state["class"] = tool["class"]
            state["missing"] = 0
            if state["active"]:
                continue
            state["seen"] += 1
            if state["seen"] >= ENTER_FRAMES and not self.paused:
                state["active"] = True
                row = self.db.add_event(
                    self.session_id, "tool_enter", state["class"], track_id
                )
                if row:
                    written.append(row)
        stale_ids = []
        for track_id, state in self.tracks.items():
            if track_id in present:
                continue
            state["missing"] += 1
            if not state["active"]:
                state["seen"] = 0
                if state["missing"] > 100:
                    stale_ids.append(track_id)
                continue
            if state["missing"] >= EXIT_FRAMES and not self.paused:
                state["active"] = False
                state["seen"] = 0
                row = self.db.add_event(
                    self.session_id, "tool_exit", state["class"], track_id
                )
                if row:
                    written.append(row)
        for track_id in stale_ids:
            self.tracks.pop(track_id, None)
        return written
