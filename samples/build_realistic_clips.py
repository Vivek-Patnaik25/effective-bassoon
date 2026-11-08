"""Generate realistic surgical tray and surgeon gesture demonstration clips."""

import json
from pathlib import Path
import cv2
import numpy as np

TRAY_IMG_PATH = Path(r"C:\Users\thevi\.gemini\antigravity\brain\2c7d900e-f6a7-4ed8-a7e8-93cc5241dbbe\surgical_instruments_overhead_flatlay_1794150879250.jpg")
HAND_IMG_PATH = Path(r"C:\Users\thevi\.gemini\antigravity\brain\2c7d900e-f6a7-4ed8-a7e8-93cc5241dbbe\hand_gesture_webcam_1794151011451.jpg")

OUT_DIR = Path("samples")
OUT_DIR.mkdir(parents=True, exist_ok=True)

WIDTH = 640
HEIGHT = 360
FPS = 15
TOTAL_FRAMES = 300  # 20 seconds


def build_tray_clip():
    base = cv2.imread(str(TRAY_IMG_PATH))
    if base is None:
        raise FileNotFoundError(f"Missing {TRAY_IMG_PATH}")
    base = cv2.resize(base, (WIDTH, HEIGHT))

    # Scalpel is located roughly at x: 270..305, y: 75..295 in 640x360 coordinates
    # Let's define the tool bounding boxes on the 640x360 tray:
    # 1. curved_mayo_scissor: [120, 70, 105, 230]
    # 2. scalpel: [270, 80, 32, 210]
    # 3. straight_mayo_scissor: [335, 75, 115, 225]
    # 4. straight_dissection_clamp: [485, 95, 35, 200]

    tools_full = [
        {"track_id": 1, "class": "curved_mayo_scissor", "conf": 0.88, "bbox": [120, 70, 105, 230], "loggable": True},
        {"track_id": 2, "class": "scalpel", "conf": 0.94, "bbox": [270, 80, 32, 210], "loggable": True},
        {"track_id": 3, "class": "straight_mayo_scissor", "conf": 0.85, "bbox": [335, 75, 115, 225], "loggable": True},
        {"track_id": 4, "class": "straight_dissection_clamp", "conf": 0.91, "bbox": [485, 95, 35, 200], "loggable": True},
    ]

    tools_without_scalpel = [t for t in tools_full if t["class"] != "scalpel"]

    # Cut out the empty blue cloth from adjacent area to cover the scalpel when removed
    empty_cloth = base[75:300, 230:262].copy()

    # Base tray with scalpel removed (empty slot)
    tray_missing = base.copy()
    tray_missing[80:290, 270:302] = cv2.resize(empty_cloth, (32, 210))

    # Glove patch to simulate surgeon/nurse hand picking up scalpel
    # Generate a smooth blue surgical glove contour
    glove_color = (220, 160, 50)  # BGR medical blue/cyan

    out_path = OUT_DIR / "clinical_bench.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, FPS, (WIDTH, HEIGHT))

    labels_path = OUT_DIR / "bench_labels.jsonl"
    label_lines = []

    for i in range(TOTAL_FRAMES):
        # 0..75: all tools present
        if i < 75:
            frame = base.copy()
            active_tools = tools_full
        # 75..105: hand enters and lifts scalpel
        elif 75 <= i < 105:
            t = (i - 75) / 30.0  # 0.0 to 1.0
            frame = tray_missing.copy()
            # Draw scalpel lifting upwards
            sy = int(80 - t * 120)
            sx = int(270 + t * 20)
            # Paste scalpel crop at new lifted position if within frame
            scalpel_crop = base[80:290, 270:302].copy()
            if sy > -200:
                y_end = min(HEIGHT, sy + 210)
                if y_end > 0 and sy < HEIGHT:
                    crop_h = y_end - max(0, sy)
                    frame[max(0, sy):y_end, sx:sx+32] = scalpel_crop[:crop_h, :]
            # Draw gloved arm entering from top
            arm_y = int(-100 + t * 220)
            cv2.ellipse(frame, (sx + 16, arm_y), (40, 110), 0, 0, 360, glove_color, -1)
            cv2.circle(frame, (sx + 16, arm_y + 80), 22, (200, 140, 40), -1)
            active_tools = tools_full if t < 0.6 else tools_without_scalpel
        # 105..195: scalpel is away (3 tools on tray)
        elif 105 <= i < 195:
            frame = tray_missing.copy()
            active_tools = tools_without_scalpel
        # 195..225: hand brings scalpel back
        elif 195 <= i < 225:
            t = (i - 195) / 30.0  # 0.0 to 1.0
            frame = tray_missing.copy()
            sy = int(-40 + t * 120)
            sx = int(290 - t * 20)
            scalpel_crop = base[80:290, 270:302].copy()
            y_start = max(0, sy)
            y_end = min(HEIGHT, sy + 210)
            if y_end > y_start:
                crop_h = y_end - y_start
                frame[y_start:y_end, sx:sx+32] = scalpel_crop[:crop_h, :]
            arm_y = int(120 - t * 220)
            cv2.ellipse(frame, (sx + 16, arm_y + 100), (40, 110), 0, 0, 360, glove_color, -1)
            active_tools = tools_without_scalpel if t < 0.8 else tools_full
        # 225..300: all tools returned
        else:
            frame = base.copy()
            active_tools = tools_full

        writer.write(frame)
        label_lines.append(json.dumps({"tools": active_tools}))

    writer.release()
    labels_path.write_text("\n".join(label_lines) + "\n", encoding="utf-8")
    print(f"Created {out_path} ({TOTAL_FRAMES} frames) and {labels_path}")


def build_hand_clip():
    hand_img = cv2.imread(str(HAND_IMG_PATH))
    if hand_img is None:
        raise FileNotFoundError(f"Missing {HAND_IMG_PATH}")
    hand_img = cv2.resize(hand_img, (WIDTH, HEIGHT))

    # Base resting frame: crop out hand and replace with blurred torso/background
    # Hand is in upper chest/center area (x: 240..420, y: 70..270)
    resting = hand_img.copy()
    # Mask out hand by inpainting / blending with nearby shoulder/torso
    torso_patch = cv2.blur(hand_img[180:330, 80:240], (25, 25))
    torso_patch = cv2.resize(torso_patch, (200, 220))
    resting[70:290, 230:430] = torso_patch

    out_path = OUT_DIR / "surgeon_clip.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, FPS, (WIDTH, HEIGHT))

    for i in range(TOTAL_FRAMES):
        # 0..110: resting (no hand gesture)
        if i < 110:
            frame = resting.copy()
        # 110..130: hand raises up
        elif 110 <= i < 130:
            alpha = (i - 110) / 20.0
            frame = cv2.addWeighted(hand_img, alpha, resting, 1.0 - alpha, 0)
        # 130..190: full open palm gesture held steady (triggers PAUSE / TRAY HOLD)
        elif 130 <= i < 190:
            frame = hand_img.copy()
        # 190..210: hand lowers back down
        elif 190 <= i < 210:
            alpha = (i - 190) / 20.0
            frame = cv2.addWeighted(resting, alpha, hand_img, 1.0 - alpha, 0)
        # 210..300: resting
        else:
            frame = resting.copy()

        writer.write(frame)

    writer.release()
    print(f"Created {out_path} ({TOTAL_FRAMES} frames)")


if __name__ == "__main__":
    build_tray_clip()
    build_hand_clip()
