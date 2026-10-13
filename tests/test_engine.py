from pathlib import Path

from events.db import Database
from events.engine import EventEngine
from samples.generate import N_FRAMES, tools_at


def _feed(engine: EventEngine, frames: int = N_FRAMES):
    for index in range(frames):
        engine.update(tools_at(index))


def test_replay_log_counts(tmp_path: Path):
    db = Database(tmp_path / "app.db")
    session = db.create_session("Replay", "nurse")
    engine = EventEngine(db, session["id"])
    _feed(engine)

    events = db.events(session["id"])
    enters = [row for row in events if row["type"] == "tool_enter"]
    exits = [row for row in events if row["type"] == "tool_exit"]
    assert sorted(row["track_id"] for row in enters) == [1, 2, 3, 4]
    assert all(row["track_id"] != 99 for row in events)
    assert len(enters) == 4
    assert len(exits) == 4
    summary = {row["class"]: row["enter_count"] for row in db.summary(session["id"])}
    assert summary["scalpel"] == 1
    assert summary["straight_dissection_clamp"] == 1
    assert summary["straight_mayo_scissor"] == 1
    assert summary["curved_mayo_scissor"] == 1


def test_low_confidence_and_pause_do_not_add_rows(tmp_path: Path):
    db = Database(tmp_path / "app.db")
    session = db.create_session("Pause", "nurse")
    engine = EventEngine(db, session["id"])
    faint = {
        "track_id": 99,
        "class": "scalpel",
        "conf": 0.22,
        "bbox": [0, 0, 10, 10],
        "loggable": False,
    }
    for _ in range(30):
        assert engine.update([faint]) == []

    pause_events = engine.toggle_pause()
    assert len(pause_events) == 1 and pause_events[0]["type"] == "pause"
    visible = {
        "track_id": 7,
        "class": "scalpel",
        "conf": 0.9,
        "bbox": [1, 1, 10, 10],
        "loggable": True,
    }
    for _ in range(20):
        rows = engine.update([visible])
        assert all(row["type"] != "tool_enter" for row in rows)
    resume_events = engine.toggle_pause()
    assert len(resume_events) == 1 and resume_events[0]["type"] == "resume"
    entered = engine.update([visible])
    assert [row["type"] for row in entered] == ["tool_enter"]


def test_mark_is_a_single_row(tmp_path: Path):
    db = Database(tmp_path / "app.db")
    session = db.create_session("Mark", "nurse")
    engine = EventEngine(db, session["id"])
    assert engine.mark()[0]["type"] == "mark"
    assert len(db.events(session["id"])) == 1
    db.end_session(session["id"])
    engine.close()
    assert engine.mark() == []
