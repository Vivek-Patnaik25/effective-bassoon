# 🔬 Real-Time Surgical Tool Tracking & Touchless Gesture Recognition System

> **Major Project — B.Tech Computer Science & Engineering (AI & ML)**  
> **GIET University, Gunupur**

A real-time AI system designed for operating theatres to automate surgical instrument tracking, prevent **Retained Surgical Instruments (RSIs)**, and provide sterile, touchless gesture controls.

---

## 🌟 Key Highlights & Capabilities

- **Object Detection (YOLOv8n):** Real-time tracking of four core surgical instrument classes:
  - `scalpel`
  - `straight_dissection_clamp`
  - `straight_mayo_scissor`
  - `curved_mayo_scissor`
- **Trained on Clinical Dataset:** University of Coimbra *Labeled Surgical Tools & Images* dataset.
  - **mAP@0.5:** **0.9408 (94.1%)** *(exceeding the 0.80 benchmark and 0.92 thesis baseline)*.
  - **Inference Speed:** ~3.4 ms per frame (~294 FPS on GPU, real-time 30+ FPS on CPU).
- **Persistent Multi-Object Tracking:** ByteTrack integration maintaining consistent `track_id` assignments across camera frames.
- **Temporal Debouncing Engine:**
  - **Entry Confirmation:** 10 consecutive frames threshold to filter transient tremors.
  - **Exit Confirmation:** 15 consecutive missing frames before logging an instrument exit.
  - **Stale Track Eviction:** Automatically purges dead tracks missing for >100 frames.
- **Sterile Touchless Gesture Control (MediaPipe):**
  - **3D Orientation-Invariant Vectors:** Euclidean distance ratio comparing fingertip-to-wrist vs PIP-to-wrist.
  - **Open Palm (held for 0.4s):** Pauses / Resumes instrument logging.
  - **Closed Fist (held for 0.4s):** Marks a surgical milestone event.
  - **Keyboard Fallbacks:** Press `P` for Pause/Resume, `F` for Milestone Mark.
- **Medical HUD & Telemetry Dashboard:**
  - Real-time FPS counter, Tools-in-View telemetry, and corner-reticle bounding boxes.
  - SVG Hold-Progress Ring for gesture debouncing.
  - Web Audio API real-time chime synthesis (760 Hz on tool enter).
  - Safety Watchdog: Triggers immediate alert if the video feed drops for >2.0s.
- **Full Tray Reconciliation & PDF Audit Export:**
  - End-of-session summary auditing all 4 classes (including 0-count instruments).
  - One-click clinical PDF report generation with doctor & circulating nurse sign-off blocks.

---

## 🏗️ Architecture

```
                      ┌──────────────────────────────────────────────┐
                      │              React 18 + Vite SPA             │
                      │   - Medical HUD & Corner Reticle BBoxes      │
                      │   - WebSocket Telemetry & SVG Hold Ring      │
                      │   - Real-time Audio Chimes & Notifications   │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTP REST / WebSocket (WSS)
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │             FastAPI Backend Server           │
                      │   - Async Thread-Offloaded Pipeline Loop     │
                      │   - JWT Role Auth (nurse / admin)            │
                      │   - YOLOv8n + ByteTrack Inference            │
                      │   - MediaPipe Gesture State Machine          │
                      │   - SQLite Audit DB & PDF Report Engine      │
                      └──────────────────────────────────────────────┘
```

---

## 🚀 Quickstart & Local Setup

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/Vivek-Patnaik25/effective-bassoon.git
cd effective-bassoon

# Install dependencies
pip install -r requirements.txt

# Run the backend server
uvicorn api.main:app --port 8000
```

> **To run with your live webcam using the trained weights:**
> ```bash
> set DETECTION_SOURCE=yolo
> set TOOL_CAMERA=0
> uvicorn api.main:app --port 8000
> ```

### 2. Frontend Setup

In a separate terminal:

```bash
cd web
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 🔐 Demo Credentials

| Role | Username | Password | Permissions |
|---|---|---|---|
| **Circulating Nurse** | `nurse` | `nurse123` | Live session, telemetry HUD, real-time event logs |
| **Surgical Supervisor** | `admin` | `admin123` | Full access: Live session, Historical audit logs, PDF export |

---

## 📊 Evaluation & Benchmarks

| Metric | Score | Target Benchmark | Status |
|---|---|---|---|
| **Overall mAP@0.5** | **0.9408** | ≥ 0.80 | ✅ Exceeded (+17.6%) |
| **mAP@0.5:0.95** | **0.8292** | — | High Precision |
| **Precision** | **0.8346** | — | Reliable Detections |
| **Recall** | **0.8810** | — | High Instrument Sensitivity |

### Per-Class Performance:
- **Scalpel:** 0.9024 AP@0.5
- **Straight Dissection Clamp:** 0.9695 AP@0.5
- **Straight Mayo Scissor:** 0.9366 AP@0.5
- **Curved Mayo Scissor:** 0.9548 AP@0.5

---

## 📜 Citation

```bibtex
@misc{dilavado2018surgicaltools,
  author = {Diana Lavado and Joaquim da Silva and Francisco Caramelo},
  title = {Labeled Surgical Tools and Images},
  year = {2018},
  publisher = {University of Coimbra},
  howpublished = {\url{https://www.kaggle.com/datasets/dilavado/labeled-surgical-tools}}
}
```

---

## ⚖️ License

This project is licensed under the MIT License — see the repository for details.
