# Task Split

Project: Real-Time Surgical Tool Tracking and Gesture Recognition System  
Three members. Stories and behaviour are defined in `user_stories.md`. Feature detail is in `features.md`.

Shared message. Only A fills `tools`. Only B writes `event`. C only displays it.

```json
{
  "ts": "2026-10-09T16:00:00Z",
  "session_id": "s1",
  "camera_ok": true,
  "tools": [{ "track_id": 3, "class": "straight_dissection_clamp", "conf": 0.91, "bbox": [0, 0, 0, 0] }],
  "gesture": "none",
  "event": null
}
```

`gesture`: `open_palm`, `fist`, or `none`.  
`event`: `tool_enter`, `tool_exit`, `pause`, `mark`, or `null`.

Folders: `perception/` (A), `gestures/` and `events/` (B), `api/` and `web/` (C), `samples/` (shared). Database is SQLite.

## A — Perception

Stories: US-02, US-04, US-12

- Lock class names to the public dataset you download.
- Train YOLOv8n or YOLO11n and save the weights.
- Run detection plus ByteTrack or BoT-SORT on a sample video and on the tool webcam.
- Emit `tools[]` with `track_id`, class, confidence, and bbox.
- Set `camera_ok`, and flag detections under 0.40 confidence so they are not logged.
- Record mAP@0.5, per-class precision and recall, a confusion matrix, and FPS on the demo laptop.

Done when a script prints that `tools` array from a sample video, without the UI and without gesture code.

## B — Gestures and session log

Stories: US-03, US-05, US-06, US-07, US-11

- Read the hand webcam with MediaPipe.
- Open palm pauses logging. Fist appends one mark. Hold about 0.4 seconds, then require a neutral hand before it can fire again.
- Start and end a session in SQLite.
- Write a row only on tool-enter, tool-exit, pause, or mark.
- Enter: the same `track_id` stayed visible for about 10 frames. Exit: it was missing for about 15 frames.
- One alert event per tool-enter.
- End-of-session summary is the enter count per class.

Done when palm, fist, enter, exit, and the summary work against a recorded `tools` JSON file, without React.

## C — Live view, history, and export

Stories: US-01, US-08, US-09, US-10, US-13

- FastAPI app and WebSocket that send the shared message.
- React page: video, boxes, class name, confidence percentage, gesture state, and the live log.
- Start and End session controls wired to B's session logic.
- Banner when the tool camera is lost for 2 seconds.
- Login with two roles: nurse (live session) and admin (live session and history).
- History list filtered by date, then open one session.
- PDF of that session: id, start and end, event rows, enter-count summary.

Done when the page renders a saved sample message, including boxes and log rows, before A's model is finished.

## Left out of this split

Account create, edit, and deactivate. MongoDB. Docker. Any control of real medical equipment.
