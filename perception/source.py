"""Tool detections: replay by default, YOLO when weights exist."""

from __future__ import annotations

import json
import os
from pathlib import Path

import cv2

from domain import CONF_MIN
from samples.generate import ensure_samples

WEIGHTS = Path("perception/weights/best.pt")


def read_tools(backend, frame):
    """Return the tool list for this frame from the active backend."""
    return backend.read_tools(frame)


def open_perception():
    mode = os.environ.get("DETECTION_SOURCE", "replay").strip().lower()
    if mode == "yolo":
        yolo = _open_yolo()
        if yolo is not None:
            return yolo
        print("best.pt is missing or failed to load. Staying on replay.")
    video, labels = ensure_samples()
    return ReplaySource(video, labels)


def _open_yolo():
    if not WEIGHTS.exists():
        print("perception/weights/best.pt was not found.")
        return None
    try:
        camera = int(os.environ.get("TOOL_CAMERA", "0"))
        return YoloSource(WEIGHTS, camera)
    except Exception as exc:
        print(f"YOLO source failed: {exc}")
        return None


class ReplaySource:
    def __init__(self, video: Path, labels: Path):
        self.video = video
        self.records = [
            json.loads(line)["tools"]
            for line in labels.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        self.capture = cv2.VideoCapture(str(video))
        self.index = 0
        self.eof = False

    def read(self):
        if self.eof:
            return None, []
        ok, frame = self.capture.read()
        if not ok or self.index >= len(self.records):
            self.eof = True
            return None, []
        tools = self.read_tools(frame)
        self.index += 1
        return frame, tools

    def read_tools(self, frame):
        if self.index >= len(self.records):
            return []
        return [dict(tool) for tool in self.records[self.index]]

    def rewind(self):
        self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
        self.index = 0
        self.eof = False

    def close(self):
        self.capture.release()


class YoloSource:
    def __init__(self, weights: Path, camera_index: int):
        from ultralytics import YOLO

        self.model = YOLO(str(weights))
        self.camera_index = camera_index
        self.capture = cv2.VideoCapture(camera_index)
        if not self.capture.isOpened():
            raise RuntimeError(f"Tool camera {camera_index} did not open.")
        self.names = self.model.names

    def read(self):
        if not self.capture.isOpened():
            self.capture.open(self.camera_index)
            if not self.capture.isOpened():
                return None, []
        ok, frame = self.capture.read()
        if not ok:
            return None, []
        return frame, self.read_tools(frame)

    def read_tools(self, frame):
        results = self.model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
        )
        tools = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            names = result.names or self.names
            for box in boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                name = str(names.get(cls_id, names[cls_id]) if isinstance(names, dict) else names[cls_id])
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
                track_id = int(box.id[0]) if box.id is not None else cls_id
                tools.append(
                    {
                        "track_id": track_id,
                        "class": name,
                        "conf": round(conf, 4),
                        "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)],
                        "loggable": conf >= CONF_MIN,
                    }
                )
        return tools

    def rewind(self):
        return None

    def close(self):
        self.capture.release()
