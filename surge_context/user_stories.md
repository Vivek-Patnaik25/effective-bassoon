# User Stories Document

Project: Real-Time Surgical Tool Tracking and Gesture Recognition System  
B.Tech CSE (AI & ML) — Major Project | GIET University, Gunupur

## Step 1: Identify Who Will Use Your System

| Sl. No. | Person / User | What will they do in the system? |
|---|---|---|
| 1 | Surgeon / Doctor | View the live feed with tool boxes and confidence, and pause or mark the log with hand gestures |
| 2 | Scrub Nurse / OR Staff | Start and end a session, watch the instrument log and enter alerts, and check the end-of-session count |
| 3 | Hospital Administrator | Sign in, review past session logs, and export a session report |

## Step 2: Identify User Requirements

| User | What the user wants | Why the user needs it |
|---|---|---|
| Surgeon | View a real-time video feed with tool detection overlay | To see which instrument is in view while staying on the procedure |
| Surgeon | Control the tool log with hand gestures (open palm / fist) | To interact without touching a non-sterile surface |
| Surgeon | See the tool name, confidence, and a stable track id | To judge the detection and avoid counting the same tool on every frame |
| OR Nurse | Start and end a named surgery session | So every log row belongs to one procedure |
| OR Nurse | View a real-time tool log with timestamps | To keep an accurate record of instruments that entered the camera view |
| OR Nurse | Receive an alert when a new instrument enters the view | To update the manual instrument count |
| OR Nurse | View an end-of-session enter-count per tool class | To reconcile instruments at the end of the procedure |
| OR Nurse | See a clear state when the camera drops or confidence stays low | So a frozen or weak feed is not treated as a valid log |
| Admin | Access historical surgery session logs | For training review and audit |
| Admin | Sign in with a role | So only authorised staff open the dashboard |
| Admin | Export a session report as PDF | So the record can be filed |

## Step 3: Write User Stories

Format: As a (user), I want (feature), so that (purpose).

| User Story ID | User | Requirement (User Story) |
|---|---|---|
| US-01 | Surgeon | As a surgeon, I want a live video feed with boxes and labels on detected surgical tools so that I can confirm what is in view without looking away from the field. |
| US-02 | Surgeon | As a surgeon, I want the system to detect and label the agreed tool classes in real time so that the OR team gets an automated instrument log. |
| US-03 | Surgeon | As a surgeon, I want open palm to pause logging and a fist to mark an event so that I can interact without touching a non-sterile surface. |
| US-04 | Surgeon | As a surgeon, I want a confidence percentage beside each detection so that I can judge whether to trust that box. |
| US-05 | OR Nurse | As an OR nurse, I want a live instrument log with timestamps so that I can see which tools have entered the view during this procedure. |
| US-06 | OR Nurse | As an OR nurse, I want an alert when a new instrument enters the view so that I can update my manual instrument count. |
| US-07 | OR Nurse | As an OR nurse, I want an end-of-session summary of each tool class and how many times it entered so that I can reconcile the instrument count. |
| US-08 | Admin | As an administrator, I want to open past session logs so that I can review them for training and audit. |
| US-09 | Admin | As an administrator, I want to sign in with a role so that only authorised staff open the dashboard. |
| US-10 | Admin | As an administrator, I want to download a session report as PDF so that the log can be filed. |
| US-11 | OR Nurse | As an OR nurse, I want to start and end a named session so that logs belong to one procedure. |
| US-12 | Surgeon | As a surgeon, I want a tool to keep the same id while it remains in view so that the log does not repeat it on every frame. |
| US-13 | OR Nurse | As an OR nurse, I want a clear on-screen state when a camera drops or confidence stays low so that I do not trust a frozen feed. |

Class names in US-02 are the labels of the dataset chosen for training. The demo must use those names consistently in the overlay, the log, and the report.

Priority for the demo:

| Priority | Stories |
|---|---|
| Must | US-01, US-02, US-03, US-04, US-05, US-07, US-11, US-12 |
| Should | US-06, US-08, US-09, US-13 |
| After the above are done | US-10 |

Creating, editing, and deactivating user accounts is outside the demo. US-09 is login plus two roles: nurse and admin.

## Step 4: Define When a User Story is Completed

| User Story | How will we check it is completed? (Acceptance Criteria) |
|---|---|
| US-01 – Live feed with detection | On the demo laptop the overlay updates at 15 FPS or better. Each box shows the class name and confidence. Measured FPS is recorded for the project report. |
| US-02 – Tool identification | mAP@0.5 is measured on a held-out validation split for the agreed classes. Target is mAP@0.5 of 0.80 or higher. If the dataset is too small to reach that, the achieved mAP@0.5, per-class precision and recall, and a confusion matrix are reported. |
| US-03 – Gesture control | Gestures come from a hand webcam, separate from the tool camera. Open palm pauses new log lines. A fist appends one mark. The gesture is held for about 0.4 seconds before it fires, and it does not fire again until the hand returns to neutral. A recognized gesture is applied within 1 second. |
| US-04 – Confidence score display | Every overlay label shows confidence as a percentage from 0 to 100. |
| US-05 – Real-time instrument log | A new log row appears within 2 seconds of a confirmed tool-enter. The row has time, class, and track id. One detection frame is not a log row. |
| US-06 – New tool alert | One visible notification appears per confirmed tool-enter (class and track id). The alert means the instrument appeared in the camera view. |
| US-07 – Session summary count | The end-of-session summary lists each class and its enter count for that session. Enter means the same track id stayed visible for about 10 consecutive frames. Exit means that track was missing for about 15 frames. |
| US-08 – Session log access | Sessions can be listed and opened. The list can be filtered by date. An opened session shows its event log and enter-count summary. |
| US-09 – Sign-in and roles | Login works. Nurse can open the live session and log. Admin can open the live session and the history. |
| US-10 – Export report | The system generates a downloadable PDF with session id, start and end time, event rows (time, class, event type), and the enter-count summary. |
| US-11 – Session start and end | Start creates a session id and begins logging. End freezes the log and shows the summary. |
| US-12 – Stable tool id | Tracking (ByteTrack or BoT-SORT) keeps one track id on a tool for as long as it stays in view. |
| US-13 – Camera and confidence state | If no frame arrives for 2 seconds, the UI shows that the camera is lost. Detections under 0.40 confidence may be drawn and are not written to the log. |

## Module Distribution (3 Students)

| Student | Module | User Stories Covered | Technology |
|---|---|---|---|
| Student A | Surgical tool detection, tracking, and the `tools` message | US-02, US-04, US-12 | Python, YOLOv8n or YOLO11n, OpenCV, Ultralytics tracking, PyTorch |
| Student B | Hand gestures, session log, and event rules | US-03, US-05, US-06, US-07, US-11 | Python, MediaPipe, SQLite |
| Student C | Live view, history, sign-in, and report export | US-01, US-08, US-09, US-10, US-13 | React, FastAPI, WebSocket |

The shared message shape and folder split are in `features.md` and `task_split.md`.
