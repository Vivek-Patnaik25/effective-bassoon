# Features and Implementation

Project: Real-Time Surgical Tool Tracking and Gesture Recognition System  
B.Tech CSE (AI & ML) — Major Project | GIET University, Gunupur

## Problem

In an operating theatre, instrument use is still written down by staff while the procedure is going on. A surgeon who needs to mark an event or pause a record has to touch a screen, a keyboard, or ask someone else to do it. That touch meets a non-sterile surface. A camera can see the tools, but a raw detection on every frame is not a procedure log: the same instrument would be counted hundreds of times. Hand gestures and tool sightings also stay disconnected, so there is no single timeline of what entered the view and what the surgeon marked.

## Solution

This project is an educational prototype that watches two cameras and writes one session log.

- A tool camera (or a recorded surgical clip) is read with OpenCV. YOLOv8n or YOLO11n detects the agreed instrument classes. Ultralytics tracking (ByteTrack or BoT-SORT) keeps a stable id on each tool while it remains in view.
- A second webcam watches the surgeon's hand. MediaPipe classifies open palm and fist. Palm pauses logging. Fist writes a single mark. A short hold and a return to neutral stop the same gesture from firing twice.
- An event step turns tracks into procedure rows: tool entered, tool left, logging paused, event marked. A row is written only when that state changes. The end of the session lists how many times each class entered, which is the count staff can reconcile.
- A web dashboard shows the live overlay, the log, alerts, past sessions, and a PDF export. Sign-in has two roles, nurse and admin.

The prototype logs what the cameras see and lets a hand pause or mark that log. It is a student demonstration for the major project. It is not a certified medical device, it does not drive operating-theatre equipment, and a tool entering the camera view is not treated as proof of what happened inside the patient.

## Uniqueness

The project is a single session timeline that joins both perceptions.

- Tool identity and hand gestures write into the same session. A mark lands on the procedure log next to the instruments that were in view, instead of living in a separate demo window.
- The log stores enter, exit, pause, and mark. It does not store a row per video frame, so the nurse's count is usable at the end of the session.
- The tool view and the hand view are separate cameras. Instrument detection keeps a close, stable field, and gesture detection keeps a view of the hand.
- Low-confidence boxes can still be drawn for the surgeon, and they stay out of the official log. A dropped camera is shown as a lost feed rather than as an empty instrument count.

## Shared message

A, B, and C all build against this JSON object. Only A fills `tools`. Only B writes `event`. C displays the message.

```json
{
  "ts": "2026-10-09T16:00:00Z",
  "session_id": "s1",
  "camera_ok": true,
  "tools": [
    { "track_id": 3, "class": "straight_dissection_clamp", "conf": 0.91, "bbox": [0, 0, 0, 0] }
  ],
  "gesture": "none",
  "event": null
}
```

| Field | Allowed values | Writer |
|---|---|---|
| `gesture` | `open_palm`, `fist`, `none` | B |
| `event` | `tool_enter`, `tool_exit`, `pause`, `mark`, or `null` | B |
| `tools` | list of `track_id`, `class`, `conf`, `bbox` | A |
| `camera_ok` | `true` or `false` | A for the tool camera; C displays it |

Class names are the labels of the dataset chosen before training. The same strings appear in the overlay, the database, and the PDF.

## Features and how they are built

### 1. Tool detection and tracking

Covers US-02, US-04, US-12. Owner: A.

- Dataset: a public surgical-tool detection set. Training can run on Colab. Inference uses a nano model so the demo laptop can target 15 FPS.
- OpenCV reads the tool webcam or a file in `samples/`.
- Ultralytics returns boxes, class names, and confidence. Tracking assigns `track_id`.
- Confidence under 0.40 may be sent for drawing and is flagged so B does not log it.
- The project report records mAP@0.5, per-class precision and recall, a confusion matrix, and measured FPS.

### 2. Hand-gesture control

Covers US-03. Owner: B.

- MediaPipe Hands on the second webcam.
- Open palm sets logging to paused. Fist appends one `mark` row.
- The pose is held for about 0.4 seconds. It arms again only after the hand is neutral.
- The gesture state is `open_palm`, `fist`, or `none` on the shared message.

### 3. Session start and end

Covers US-11. Owner: B for storage, C for the buttons.

- Start creates a session id, a display name, and a start time in SQLite.
- End writes the end time and freezes further rows.
- Later events cannot attach to a closed session.

### 4. Procedure log

Covers US-05 and US-07. Owner: B.

- SQLite tables for sessions and events. Columns for an event: session id, timestamp, type, class, track id.
- `tool_enter` after the same `track_id` is visible for about 10 consecutive frames.
- `tool_exit` after that track is missing for about 15 frames.
- Pause suppresses new enter and exit rows until the surgeon clears the pause.
- The summary query counts `tool_enter` rows per class for that session.

### 5. Enter alert

Covers US-06. Owner: B for the event, C for the on-screen notice.

- Each new `tool_enter` produces one notification with class and track id.
- The notice is not repeated on later frames of the same track.

### 6. Live operating view

Covers US-01 and US-04. Owner: C, using A's `tools`.

- FastAPI WebSocket sends the shared message.
- React draws the video, boxes, class name, and confidence percentage, plus the current gesture and the log table.
- Target: 15 FPS or better on the demo laptop, with the measured number kept for the report.

### 7. Camera and confidence state

Covers US-13. Owner: C for the banner, A for `camera_ok`, B for the log filter.

- If no tool frame arrives for 2 seconds, `camera_ok` is false and the page shows that the camera is lost.
- Boxes under 0.40 confidence are not inserted as events.

### 8. Sign-in and roles

Covers US-09. Owner: C.

- Username and password checked by the API.
- Nurse opens the live session and the log.
- Admin opens the live session and history.
- Account create, edit, and deactivate screens are out of this build.

### 9. Session history

Covers US-08. Owner: C, reading B's tables.

- List sessions with start time, end time, and name.
- Filter by date.
- Open one session to its event rows and enter-count summary.

### 10. PDF report

Covers US-10. Owner: C. Build this after the live log and history work.

- Download for one session.
- Contents: session id, start and end, event rows (time, class, event type), enter-count summary.

## Stack

| Piece | Choice |
|---|---|
| Detection | YOLOv8n or YOLO11n, Ultralytics |
| Tracking | ByteTrack or BoT-SORT via Ultralytics |
| Video I/O | OpenCV |
| Gestures | MediaPipe Hands |
| API and live stream | FastAPI, WebSocket |
| UI | React |
| Database | SQLite |
| Report | PDF generated from the session rows |

MongoDB, Docker, and a full user-admin panel are not part of this implementation.

## Repository layout

| Path | Owner | Contents |
|---|---|---|
| `perception/` | A | Training notes, weights, script that emits `tools` |
| `gestures/` | B | MediaPipe loop and debounce |
| `events/` | B | Enter, exit, pause, mark rules and SQLite |
| `api/` | C | FastAPI shell, WebSocket, auth, PDF |
| `web/` | C | React dashboard |
| `samples/` | Shared | One short video and one saved JSON message so the UI can run before the model is ready |
