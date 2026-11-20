import asyncio
import json
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

async def main():
    print("=== TESTING DEMO PRESENTATION MODE (tool_tray.mp4 + surgeon_view.mp4) ===")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # Login nurse
        res = await client.post("/login", json={"username": "nurse", "password": "nurse123"})
        assert res.status_code == 200
        nurse_token = res.json()["token"]
        print("[PASS] Nurse login OK")

        # Create session in 'demo' mode
        res = await client.post(
            "/sessions",
            json={"name": "Laparoscopic Cholecystectomy (Demo Presentation)", "mode": "demo"},
            headers={"Authorization": f"Bearer {nurse_token}"},
        )
        assert res.status_code == 200, f"Failed to create session: {res.text}"
        session = res.json()
        session_id = session["id"]
        print(f"[PASS] Demo session created: ID={session_id}, Name='{session['name']}'")

        # Connect to websocket
        ws_url = f"{WS_URL}/ws?token={nurse_token}&session_id={session_id}"
        async with websockets.connect(ws_url) as ws:
            print("[PASS] WebSocket connected")

            # Collect 20 telemetry frames
            detected_classes = set()
            has_hand_frame = False
            has_tool_frame = False

            for i in range(20):
                msg = json.loads(await ws.recv())
                if msg.get("frame"):
                    has_tool_frame = True
                if msg.get("hand_frame"):
                    has_hand_frame = True
                for t in msg.get("tools", []):
                    detected_classes.add(t.get("class"))
                if i % 5 == 0:
                    print(f"  Frame {i}: mode={msg.get('mode')}, tools={len(msg.get('tools', []))}, hand_camera={msg.get('hand_camera')}, gesture={msg.get('gesture_raw')}")

            print(f"[PASS] Received live telemetry frames:")
            print(f"       - CH-01 (tool_tray.mp4) frame present: {has_tool_frame}")
            print(f"       - CH-02 (surgeon_view.mp4) hand frame present: {has_hand_frame}")
            print(f"       - Detected tool classes: {detected_classes}")

            assert has_tool_frame, "CH-01 frame was not streamed"
            assert has_hand_frame, "CH-02 hand frame was not streamed"
            assert len(detected_classes) > 0, "No tools detected in tool_tray.mp4"

        # End session
        res = await client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {nurse_token}"})
        assert res.status_code == 200
        summary = res.json()["summary"]
        print("[PASS] Demo session ended cleanly. Summary:")
        for row in summary:
            print(f"       - {row['class']}: entered={row['enter_count']}")

    print("\n=======================================================")
    print("[SUCCESS] DEMO PRESENTATION PIPELINE VERIFIED PERFECTLY!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
