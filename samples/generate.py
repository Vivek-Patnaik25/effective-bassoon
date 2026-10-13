"""Build the replay clip and the matching detection file on first run."""

from __future__ import annotations

import json
import os
from pathlib import Path

import cv2

from domain import CONF_MIN

WIDTH = 640
HEIGHT = 480
FPS = 10
N_FRAMES = 300

# track_id, class, first frame, exclusive end frame, confidence
WINDOWS = (
    (1, "scalpel", 20, 180, 0.93),
    (2, "straight_dissection_clamp", 40, 200, 0.90),
    (3, "straight_mayo_scissor", 60, 220, 0.88),
    (4, "curved_mayo_scissor", 80, 250, 0.86),
    (99, "scalpel", 10, 50, 0.22),
)

# BGR colors painted into the clip.
COLORS = {
    "scalpel": (76, 93, 232),
    "straight_dissection_clamp": (240, 156, 61),
    "straight_mayo_scissor": (142, 207, 62),
    "curved_mayo_scissor": (77, 193, 240),
}


def samples_dir() -> Path:
    return Path(os.environ.get("SAMPLES_DIR", "samples"))


def tools_at(frame_index: int) -> list[dict]:
    tools = []
    for track_id, name, start, end, conf in WINDOWS:
        if not start <= frame_index < end:
            continue
        span = max(1, end - start)
        progress = (frame_index - start) / span
        row = track_id % 5
        x = int(30 + progress * 280)
        y = 36 + row * 86
        tools.append(
            {
                "track_id": track_id,
                "class": name,
                "conf": conf,
                "bbox": [x, y, 170, 64],
                "loggable": conf >= CONF_MIN,
            }
        )
    return tools


def ensure_samples(directory: Path | None = None) -> tuple[Path, Path]:
    directory = directory or samples_dir()
    directory.mkdir(parents=True, exist_ok=True)
    labels = directory / "detections.jsonl"
    video = _existing_clip(directory)
    if video is not None and labels.exists() and labels.stat().st_size > 0:
        return video, labels
    video = directory / "tool_clip.mp4"
    _write(video, labels)
    return video, labels


def _existing_clip(directory: Path) -> Path | None:
    for name in ("tool_clip.mp4", "tool_clip.avi"):
        path = directory / name
        if path.exists() and path.stat().st_size > 0:
            return path
    return None


def _write(video: Path, labels: Path) -> None:
    lines = []
    frames = []
    for index in range(N_FRAMES):
        tools = tools_at(index)
        lines.append(json.dumps({"tools": tools}))
        frame = _draw(index, tools)
        frames.append(frame)

    labels.write_text("\n".join(lines) + "\n", encoding="utf-8")
    written = _write_video(video, frames)
    if written is None:
        raise RuntimeError("OpenCV could not write the replay clip.")
    if written != video and video.exists():
        video.unlink()


def _draw(index: int, tools: list[dict]):
    frame = blank_frame()
    cv2.putText(
        frame,
        "Tool camera  replay",
        (16, 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (40, 40, 40),
        1,
        cv2.LINE_AA,
    )
    for tool in tools:
        x, y, w, h = tool["bbox"]
        color = COLORS.get(tool["class"], (80, 80, 80))
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, -1)
        cv2.rectangle(frame, (x, y), (x + w, y + h), (20, 20, 20), 1)
    cv2.putText(
        frame,
        f"frame {index + 1}/{N_FRAMES}",
        (16, HEIGHT - 16),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (60, 60, 60),
        1,
        cv2.LINE_AA,
    )
    return frame


def blank_frame():
    import numpy as np

    return np.full((HEIGHT, WIDTH, 3), 236, dtype="uint8")


def _write_video(video: Path, frames) -> Path | None:
    attempts = (
        (video, "mp4v"),
        (video.with_suffix(".avi"), "XVID"),
    )
    for path, codec in attempts:
        writer = cv2.VideoWriter(
            str(path),
            cv2.VideoWriter_fourcc(*codec),
            FPS,
            (WIDTH, HEIGHT),
        )
        if not writer.isOpened():
            writer.release()
            continue
        for frame in frames:
            writer.write(frame)
        writer.release()
        if path.exists() and path.stat().st_size > 0:
            return path
    return None
