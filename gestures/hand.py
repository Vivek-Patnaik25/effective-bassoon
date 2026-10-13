"""Fixed hand-camera gestures, with a one-shot debounce."""

from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path

import cv2

from domain import HOLD_SECONDS

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)


def model_path() -> Path:
    return Path(__file__).with_name("hand_landmarker.task")


def ensure_hand_model() -> Path | None:
    path = model_path()
    if path.exists() and path.stat().st_size > 0:
        return path
    try:
        urllib.request.urlretrieve(MODEL_URL, path)
    except Exception as exc:
        print(f"Could not download the hand model ({exc}). Press P to pause and F to mark.")
        return None
    return path if path.exists() and path.stat().st_size > 0 else None


def classify_landmarks(landmarks) -> str:
    """Classify open palm vs fist using orientation-invariant Euclidean distances.

    A finger is considered extended if the distance from fingertip to wrist (0)
    is greater than the distance from the PIP joint to wrist.
    Falls back to vertical y-coordinates if 2D/3D coordinates are unavailable.
    """
    tips = (8, 12, 16, 20)
    pips = (6, 10, 14, 18)
    extended = 0

    has_x = hasattr(landmarks[0], "x")
    if has_x:
        w = landmarks[0]
        wx, wy, wz = w.x, w.y, getattr(w, "z", 0.0)
        for tip, pip in zip(tips, pips):
            t = landmarks[tip]
            p = landmarks[pip]
            tx, ty, tz = t.x, t.y, getattr(t, "z", 0.0)
            px, py, pz = p.x, p.y, getattr(p, "z", 0.0)
            d_tip_sq = (tx - wx) ** 2 + (ty - wy) ** 2 + (tz - wz) ** 2
            d_pip_sq = (px - wx) ** 2 + (py - wy) ** 2 + (pz - wz) ** 2
            if d_tip_sq > d_pip_sq:
                extended += 1
    else:
        for tip, pip in zip(tips, pips):
            if landmarks[tip].y < landmarks[pip].y:
                extended += 1

    if extended >= 4:
        return "open_palm"
    if extended == 0:
        return "fist"
    return "none"


class Debouncer:
    def __init__(self, hold_seconds: float = HOLD_SECONDS):
        self.hold_seconds = hold_seconds
        self.candidate = "none"
        self.since = None
        self.armed = True
        self.pulse = "none"

    @property
    def progress(self) -> float:
        if not self.armed or self.candidate == "none" or self.since is None:
            return 0.0
        elapsed = time.monotonic() - self.since
        return min(1.0, round(elapsed / self.hold_seconds, 2))

    def update(self, raw: str) -> None:
        if not self.armed:
            if raw == "none":
                self.armed = True
            return
        if raw == "none" or raw != self.candidate:
            self.candidate = raw
            self.since = time.monotonic() if raw != "none" else None
            return
        if self.since is not None and time.monotonic() - self.since >= self.hold_seconds:
            self.pulse = raw
            self.armed = False
            self.candidate = "none"
            self.since = None

    def consume(self) -> str:
        pulse = self.pulse
        self.pulse = "none"
        return pulse


class HandTracker:
    """Reads the fixed hand webcam on the same thread as the tool camera."""

    def __init__(self, camera_index: int | None = None):
        if camera_index is None:
            camera_index = int(os.environ.get("HAND_CAMERA", "1"))
        self.camera_index = camera_index
        self.available = False
        self._debouncer = Debouncer()
        self._capture = None
        self._landmarker = None
        self._mp = None
        self._timestamp_ms = 0

    @property
    def progress(self) -> float:
        return self._debouncer.progress

    @property
    def raw_gesture(self) -> str:
        return self._debouncer.candidate

    def open(self) -> None:
        if os.environ.get("DISABLE_HAND_CAMERA") == "1":
            print("Hand camera disabled. Press P to pause and F to mark.")
            return
        weights = ensure_hand_model()
        if weights is None:
            return
        try:
            import mediapipe as mp
            from mediapipe.tasks.python import BaseOptions
            from mediapipe.tasks.python.vision import (
                HandLandmarker,
                HandLandmarkerOptions,
                RunningMode,
            )
        except Exception as exc:
            print(f"MediaPipe is unavailable ({exc}). Press P to pause and F to mark.")
            return
        capture = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        if not capture.isOpened():
            capture.release()
            print(
                f"Hand camera {self.camera_index} is not available. "
                "Press P to pause and F to mark."
            )
            return
        try:
            options = HandLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(weights)),
                running_mode=RunningMode.VIDEO,
                num_hands=1,
                min_hand_detection_confidence=0.6,
                min_tracking_confidence=0.5,
            )
            self._landmarker = HandLandmarker.create_from_options(options)
        except Exception as exc:
            capture.release()
            print(f"Hand model failed to load ({exc}). Press P to pause and F to mark.")
            return
        self._mp = mp
        self._capture = capture
        self.available = True

    def poll(self) -> str:
        if self._capture is None or self._landmarker is None:
            return "none"
        raw = "none"
        self._timestamp_ms += 100
        try:
            ok, frame = self._capture.read()
            if ok:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
                result = self._landmarker.detect_for_video(image, self._timestamp_ms)
                if result.hand_landmarks:
                    raw = classify_landmarks(result.hand_landmarks[0])
        except Exception as exc:
            print(f"Hand camera stopped: {exc}")
            self.close()
            return "none"
        self._debouncer.update(raw)
        return self._debouncer.consume()

    def close(self) -> None:
        self.available = False
        if self._capture is not None:
            self._capture.release()
            self._capture = None
        if self._landmarker is not None:
            self._landmarker.close()
            self._landmarker = None
