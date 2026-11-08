# 👥 Three-Person Team Ownership & Technical Contribution Matrix

**Project:** Real-Time Surgical Tool Tracking and Gesture Recognition System  
**Institution:** GIET University, Gunupur — B.Tech CSE (AI & ML) Major Project (Semester 7)  
**Architecture:** Shared Message Contract (`tools[]` from A, `events/gestures` from B, `web/api` by C)  
**Current Status:** All Phase 1, Phase 2, and Phase 3 Deliverables Completed & Verified (8/8 tests green)

---

## Executive Summary & Contract Boundary

The system follows a strict decoupled contract. The components communicate via an event-driven payload schema over WebSocket:

```json
{
  "ts": "2026-10-09T16:00:00Z",
  "session_id": 1,
  "camera_ok": true,
  "tools": [
    {
      "track_id": 1,
      "class": "straight_dissection_clamp",
      "conf": 0.9695,
      "bbox": [120, 80, 240, 160],
      "loggable": true
    }
  ],
  "gesture": "none",
  "gesture_raw": "none",
  "gesture_progress": 0.0,
  "event": null
}
```

* **Student A** owns the visual perception feed, model weights, ByteTrack multi-object tracking, and emits `tools[]`.
* **Student B** owns MediaPipe hand gesture classification, temporal state machines, debouncing, and writes `events` to SQLite.
* **Student C** owns the FastAPI asynchronous pipeline, React telemetry UI, JWT role authentication, and clinical PDF report generation.

---

## 🧑‍💻 Student A: Perception, Detection & Tracking

### 1. Ownership Scope
* **Directory Ownership:** [`perception/`](file:///s:/SEM_7/per_po/perception/) (`train.py`, `source.py`, `weights/`) and dataset pipeline setup.
* **User Stories Assigned:** `US-02`, `US-04`, `US-12`.

### 2. Responsibilities & Implementation Details
1. **Public Dataset Selection & Extraction:**
   * Sourced and integrated the University of Coimbra *Labeled Surgical Tools and Images* dataset (3,009 images).
   * Locked canonical class names: `scalpel`, `straight_dissection_clamp`, `straight_mayo_scissor`, `curved_mayo_scissor`.
2. **YOLO Model Training Pipeline (`perception/train.py` & Kaggle):**
   * Engineered Kaggle GPU training script running YOLOv8n (3.0M parameters, 8.6 GFLOPs).
   * Applied surgical augmentations: HSV jitter (`hsv_h=0.015`, `hsv_s=0.7`, `hsv_v=0.4`), random rotation (`degrees=15.0`), and vertical/horizontal flips (`flipud=0.5`, `fliplr=0.5`) to mimic tray orientation.
   * Attained **0.9408 mAP@0.5** (surpassing the 0.80 benchmark and published 0.92 thesis benchmark).
3. **Multi-Object Tracking (`ByteTrack` Integration):**
   * Integrated ByteTrack with persistent `track_id` assignments in [`perception/source.py`](file:///s:/SEM_7/per_po/perception/source.py#L104-L131).
   * Prevents re-logging the same instrument across consecutive frames.
4. **Resilience & Fault Handling:**
   * Implemented automatic camera reconnect logic in `YoloSource.read()` if video capture drops.
   * Built dual-engine abstraction: transparently swaps between live webcam inference (`YoloSource`) and pre-recorded simulation (`ReplaySource`).

### 3. Key Quantitative Deliverables
* **Trained Weights:** [`perception/weights/best.pt`](file:///s:/SEM_7/per_po/perception/weights/best.pt) (6.2 MB)
* **Model Benchmark:**
  * Scalpel: `0.9024` AP@0.5
  * Straight Dissection Clamp: `0.9695` AP@0.5
  * Straight Mayo Scissor: `0.9366` AP@0.5
  * Curved Mayo Scissor: `0.9548` AP@0.5
  * Global Mean: **`0.9408` mAP@0.5** | **`0.8292` mAP@0.5:0.95**
* **Inference Speed:** 3.4 ms per frame (~294 FPS on T4 GPU; 30+ FPS on CPU laptop).

---

## 🧑‍⚕️ Student B: Gestures, Event Engine & State Machine

### 1. Ownership Scope
* **Directory Ownership:** [`gestures/`](file:///s:/SEM_7/per_po/gestures/) (`hand.py`), [`events/`](file:///s:/SEM_7/per_po/events/) (`engine.py`, `db.py`), and [`domain.py`](file:///s:/SEM_7/per_po/domain.py).
* **User Stories Assigned:** `US-03`, `US-05`, `US-06`, `US-07`, `US-11`.

### 2. Responsibilities & Implementation Details
1. **Touchless Gesture Tracking (`gestures/hand.py`):**
   * Integrated Google MediaPipe Hands tracking for touchless operating theatre sterile control.
   * **Orientation-Invariant Vector Math:** Upgraded finger classification from naive vertical `y`-coordinates to 3D Euclidean distance vectors:
     $$\text{dist}(\text{tip}, \text{wrist}) > \text{dist}(\text{pip}, \text{wrist})$$
     Ensures gestures function correctly regardless of whether the hand is vertical, sideways, or inverted.
   * Supported gestures: `open_palm` (sterile pause/resume), `fist` (milestone bookmark).
2. **Debouncing & Hold Progress State Machine:**
   * Implemented 0.40s duration hold threshold (`domain.HOLD_SECONDS = 0.4`) before firing an action.
   * Exposes live `progress` ($0.0 \rightarrow 1.0$) for frontend HUD progress ring visualization.
   * Requires hand neutralization before triggering repeated events.
3. **Instrument Enter/Exit Event Engine (`events/engine.py`):**
   * Temporal state debouncing:
     * **Tool Enter:** Requires 10 consecutive frames (`ENTER_FRAMES = 10`) of detection with confidence $\ge 0.40$.
     * **Tool Exit:** Requires 15 consecutive missing frames (`EXIT_FRAMES = 15`) before marking an instrument exit.
   * Emits audio/visual trigger alerts on tool enter (`tool_enter`).
   * **Stale Track Eviction:** Prunes dead track IDs missing for $>100$ frames to prevent unbounded memory leaks.
4. **SQLite Surgical Persistence (`events/db.py`):**
   * Maintains atomic transactional records for surgery sessions and timestamped events.
   * **Full 4-Class Reconciliation Summary:** Ensures all registered surgical instruments appear in the end-of-surgery count, including 0-count instruments (`enter_count: 0`), guaranteeing sterile tray reconciliation.

### 3. Key Quantitative Deliverables
* **Temporal State Stability:** Zero false double-counts on quick hand or instrument tremors.
* **Event Engine Unit Tests:** 100% green tests in [`tests/test_engine.py`](file:///s:/SEM_7/per_po/tests/test_engine.py) and [`tests/test_gestures.py`](file:///s:/SEM_7/per_po/tests/test_gestures.py).

---

## 💻 Student C: Live Telemetry, Full-Stack API & Clinical Reporting

### 1. Ownership Scope
* **Directory Ownership:** [`api/`](file:///s:/SEM_7/per_po/api/) (`main.py`, `pipeline.py`, `report.py`, `auth.py`), and [`web/`](file:///s:/SEM_7/per_po/web/) (`src/`, `package.json`, `styles.css`).
* **User Stories Assigned:** `US-01`, `US-08`, `US-09`, `US-10`, `US-13`.

### 2. Responsibilities & Implementation Details
1. **Asynchronous Non-Blocking Engine (`api/pipeline.py`):**
   * Solved OpenCV and MediaPipe frame-blocking bottlenecks by moving synchronous frame processing to worker threads via `asyncio.to_thread(self._tick)`.
   * Broadcasts 10 Hz telemetry packets over WebSockets with Base64 encoded JPEG preview frames.
2. **Clinical HUD & React Telemetry Frontend (`web/src/Live.jsx`):**
   * Built responsive dashboard displaying:
     * **Live Telemetry Badge:** Rolling FPS counter, Tools-in-View counter, and log status indicators.
     * **Medical Corner Reticles:** Precision bounding boxes on detected surgical instruments.
     * **SVG Hold-Ring Animation:** Real-time visual progress ring for gesture hold confirmation.
     * **Audio Feedback Synthesizer:** Built-in Web Audio API chimes (760 Hz on tool enter, 520 Hz on gesture trigger).
     * **Auto-Dismissing Toast Banners:** Non-intrusive clinical event notices.
3. **Safety Alarm & Feed Loss Protection:**
   * 2.0-second watchdog timer (`CAMERA_LOST_SECONDS = 2.0`). Displays prominent red safety banner if camera drops.
   * Separated simulation controls ("Drop Feed") from clinical actions ("End Session").
4. **Security & Role-Based Access Control (`api/auth.py`):**
   * JWT bearer token authentication with bcrypt password hashing.
   * Roles:
     * `nurse`: Live surgery monitoring, session management, and real-time logs.
     * `admin`: Complete access including past surgery history, audit logs, and PDF downloads.
5. **Clinical PDF Audit Report Generation (`api/report.py`):**
   * Designed hospital-standard PDF export using `fpdf2`.
   * Features: Dark clinical header banner, metadata card, complete reconciliation table with alternating zebra rows, color-coded chronological audit trail, and formal Nurse & Surgeon sign-off blocks.

### 3. Key Quantitative Deliverables
* **Frontend Build:** Clean Vite production build with zero bundle warnings or errors.
* **API Unit Tests:** Verified in [`tests/test_api.py`](file:///s:/SEM_7/per_po/tests/test_api.py) covering JWT auth, summary generation, and PDF binary export.

---

## 📊 Summary Responsibility Matrix

| Feature / Module | Primary Owner | Secondary Contributor | Verification Method |
|---|---|---|---|
| **YOLOv8n Training & Model Optimization** | **Student A** | Student B (Class selection) | Kaggle run logs & `metrics.json` |
| **ByteTrack Instrument ID Persistence** | **Student A** | Student C (BBox serialization) | `perception/source.py` unit test |
| **MediaPipe Touchless Gesture Engine** | **Student B** | Student C (Hold ring UI) | `tests/test_gestures.py` |
| **Enter/Exit Debouncing State Machine** | **Student B** | Student A (Track input) | `tests/test_engine.py` |
| **SQLite Session & Event Logging** | **Student B** | Student C (API queries) | `events/db.py` queries |
| **Async WebSocket Pipeline** | **Student C** | Student A & B (Data sources) | `api/pipeline.py` loop check |
| **Medical HUD & Interactive React UI** | **Student C** | Student B (Gesture feedback) | `web/src/Live.jsx` & CSS |
| **Clinical PDF Audit Report Generator** | **Student C** | Student B (Summary data) | `tests/test_api.py::test_roles_history_and_pdf` |
| **JWT Authentication & RBAC** | **Student C** | - | `api/auth.py` endpoint tests |

---

## 📁 Generated Deliverables in Repository
* **Team Ownership Documentation:** [`TEAM_CONTRIBUTIONS.md`](file:///s:/SEM_7/per_po/TEAM_CONTRIBUTIONS.md)
* **Training Convergence Plots:** [`kaggle_res/training_metrics_progression.png`](file:///s:/SEM_7/per_po/kaggle_res/training_metrics_progression.png)
* **Per-Class Benchmark Bar Chart:** [`kaggle_res/per_class_map_comparison.png`](file:///s:/SEM_7/per_po/kaggle_res/per_class_map_comparison.png)
* **Confusion Matrix Visualization:** [`kaggle_res/confusion_matrix_surgical.png`](file:///s:/SEM_7/per_po/kaggle_res/confusion_matrix_surgical.png)
* **Production Model Weights:** [`perception/weights/best.pt`](file:///s:/SEM_7/per_po/perception/weights/best.pt)
