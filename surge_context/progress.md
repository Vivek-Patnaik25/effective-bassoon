# Built so far, and what to improve

Project: Real-Time Surgical Tool Tracking and Gesture Recognition System  
Status of the prototype in this folder. Training has not been done.

## What is running

The dashboard and the procedure log work today on a **replay clip**, not on a trained detector. Colored blocks stand in for the four instruments. The same message shape is what a real YOLO model will fill later.

Open http://127.0.0.1:5173 after the API (`port 8000`) and `web` dev server are running.

| Account | Password | Can do |
|---|---|---|
| nurse | nurse123 | Live session and the instrument log |
| admin | admin123 | Live session, history, and PDF download |

## Features built

### Live tool view

- A tool clip plays at 10 frames per second. Each frame has matching boxes in `samples/detections.jsonl`.
- The page draws a box, the class name, and confidence as a percentage.
- Classes are `scalpel`, `straight_dissection_clamp`, `straight_mayo_scissor`, and `curved_mayo_scissor`.
- A box under 0.40 confidence is drawn with a dashed outline and is not written to the log.
- **Drop camera** freezes the feed. After 2 seconds the page shows **Camera lost**. **Restore** rewinds the clip.

Story coverage: US-01 and US-04 on the replay feed. US-13 for the lost camera and the low-confidence rule. The 15 FPS measurement is still open, because the clip is intentionally 10 FPS and there is no trained model yet.

### Procedure log

- **Start** opens a named session. **End** freezes it and shows enter counts.
- A tool is logged as `tool_enter` only after the same track id stays visible for about 10 frames.
- It is logged as `tool_exit` after that id is missing for about 15 frames.
- One physical tool in the clip keeps one track id, so the log does not add a row every frame.
- Each enter shows one on-screen alert with the class and track id.
- The end-of-session summary is the enter count per class, not a count of frames.

Story coverage: US-05, US-06, US-07, US-11. US-12 is true for the replay ids. ByteTrack or BoT-SORT runs only after real weights are loaded.

### Gestures

- Open palm pauses new enter and exit rows. A fist appends one mark.
- MediaPipe Hand Landmarker reads a second, fixed webcam (`HAND_CAMERA`, default `1`). A pose must be held for about 0.4 seconds, then the hand must return to neutral before it can fire again.
- If that camera is missing, **P** pauses and **F** marks. This keyboard path is what was checked on a laptop with no second camera.

Story coverage: US-03. The webcam path is implemented. It still needs a check on a machine that actually has camera 1.

### Sign-in, history, and PDF

- Passwords are stored as bcrypt hashes. Sign-in returns a token. Nurse cannot open history.
- Admin can list sessions, filter by date, open one session, and download a PDF.
- The PDF contains the session id, name, start and end time, event rows, and the enter-count summary.

Story coverage: US-08, US-09, US-10. Creating and deactivating accounts was left out on purpose.

### Ready for a model, not trained

- `DETECTION_SOURCE=yolo` loads `perception/weights/best.pt` with Ultralytics tracking when that file exists.
- If the file is missing, the app prints that and stays on replay.
- There is no training script, no dataset download, and no mAP number yet.

Story coverage: US-02 is not done. The class names are locked so training can use them. US-12's tracker is wired only inside that YOLO path.

## Checked

- Replay of the clip writes one enter and one exit for each of the four classes, and never logs the faint box.
- Pause blocks an enter until logging is resumed. A mark is a single row. A closed session accepts no new rows.
- Nurse is refused the history list and the PDF. Admin can list sessions and the PDF starts as a real PDF containing the tool name.
- In the browser: boxes and percentages render, the four enter alerts appear, P pauses, F marks, Drop camera shows Camera lost, and End shows an enter count of 1 for each class.

## Improvements worth doing next

### 1. Train the detector

This is the main gap. Download [Labeled Surgical Tools and Images](https://www.kaggle.com/datasets/dilavado/labeled-surgical-tools) (Diana Lavado, Joaquim da Silva, Francisco Caramelo, 2018). Train YOLOv8n or YOLO11n, save `perception/weights/best.pt`, and record mAP@0.5, per-class precision and recall, a confusion matrix, and FPS on the demo laptop. That closes US-02 and the FPS line in US-01.

### 2. Point the tool camera at real instruments

After weights exist, run with `DETECTION_SOURCE=yolo` and `TOOL_CAMERA=0`. Confirm the same enter, exit, pause, and summary rules on a webcam or a recorded clip of actual tools, not only the colored blocks.

### 3. Confirm the hand camera on a second webcam

Plug in camera 1, hold an open palm and a fist for about half a second, and check that pause and mark fire once each. Keep P and F as the fallback.

### 4. Raise the live rate

The replay clock is 10 FPS so the demo is easy to follow. On the trained model, measure FPS on the demo laptop and aim for 15 or better. Write that number in the project report.

### 5. Smaller product gaps

- Let the nurse open the session they just finished without the log clearing from the page.
- Show the instrument table after End, not only the enter counts.
- Replace the two seeded passwords before any demo outside the team, and keep the signing secret out of the source file.
- Allow only one obvious recovery when a session is left open: the live page already offers End, and a stuck session still blocks the next Start.

### 6. Leave for later

- Screens to create, edit, and deactivate accounts.
- MongoDB, Docker, and control of real theatre equipment.
- Any claim that a tool entering the camera proves it entered or left a patient.

The prototype logs what the cameras see and lets a hand pause or mark that log. The next step that changes the project is training, then swapping the colored blocks for the weights file.
