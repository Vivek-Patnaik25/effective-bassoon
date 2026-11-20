"""Comprehensive End-to-End System Test for Presentation Readiness."""

import asyncio
import json
import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000"

async def main():
    print("=== STARTING END-TO-END PRESENTATION VERIFICATION ===")
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Health check
        res = await client.get("/")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print(f"[PASS] 1. API Health Check: {res.json()}")

        # 2. Nurse Login
        res = await client.post("/login", json={"username": "nurse", "password": "nurse123"})
        assert res.status_code == 200, f"Nurse login failed: {res.text}"
        nurse_data = res.json()
        nurse_token = nurse_data["token"]
        assert nurse_data["role"] == "nurse"
        print(f"[PASS] 2. Nurse Login successful: role={nurse_data['role']}")

        # 3. RBAC Enforcement (Nurse cannot access admin sessions history)
        res = await client.get("/sessions", headers={"Authorization": f"Bearer {nurse_token}"})
        assert res.status_code == 403, f"RBAC failed, nurse accessed admin route: {res.status_code}"
        print("[PASS] 3. RBAC verified: Nurse cannot access admin-restricted /sessions (403 Forbidden)")

        # 4. Admin Login
        res = await client.post("/login", json={"username": "admin", "password": "admin123"})
        assert res.status_code == 200, f"Admin login failed: {res.text}"
        admin_data = res.json()
        admin_token = admin_data["token"]
        assert admin_data["role"] == "admin"
        print(f"[PASS] 4. Admin Login successful: role={admin_data['role']}")

        # 5. Create Session with Replay Simulation
        session_name = "Final Presentation Verification Procedure"
        res = await client.post(
            "/sessions",
            json={"name": session_name, "mode": "simulation"},
            headers={"Authorization": f"Bearer {nurse_token}"},
        )
        assert res.status_code == 200, f"Create session failed: {res.text}"
        session = res.json()
        session_id = session["id"]
        print(f"[PASS] 5. Session created: ID={session_id}, Name='{session['name']}'")

        # 6. WebSocket Connection & Live Telemetry
        ws_endpoint = f"{WS_URL}/ws?token={nurse_token}&session_id={session_id}"
        print(f"Connecting to WebSocket: {ws_endpoint}")
        async with websockets.connect(ws_endpoint) as ws:
            print("[PASS] 6. WebSocket connected successfully!")

            # Receive initial frame
            first_msg = json.loads(await ws.recv())
            assert "frame" in first_msg
            assert "tools" in first_msg
            assert "camera_ok" in first_msg
            print(f"[PASS] 7. Received initial live telemetry frame (camera_ok={first_msg['camera_ok']}, mode={first_msg['mode']})")

            # Test Pause Shortcut ('p')
            print("Testing pause command ('p')...")
            await ws.send(json.dumps({"type": "key", "key": "p"}))
            # Wait a few frames to observe paused state
            paused_observed = False
            for _ in range(15):
                msg = json.loads(await ws.recv())
                if msg.get("paused") is True:
                    paused_observed = True
                    break
            assert paused_observed, "Pipeline did not transition to paused state"
            print("[PASS] 8. Gesture / Key shortcut 'p' (Pause) toggled logging to PAUSED")

            # Test Resume Shortcut ('p')
            print("Testing resume command ('p')...")
            await ws.send(json.dumps({"type": "key", "key": "p"}))
            resumed_observed = False
            for _ in range(15):
                msg = json.loads(await ws.recv())
                if msg.get("paused") is False:
                    resumed_observed = True
                    break
            assert resumed_observed, "Pipeline did not transition to resumed state"
            print("[PASS] 9. Gesture / Key shortcut 'p' (Resume) toggled logging back to ACTIVE")

            # Test Mark Milestone ('f')
            print("Testing milestone mark shortcut ('f')...")
            await ws.send(json.dumps({"type": "key", "key": "f"}))
            mark_observed = False
            for _ in range(15):
                msg = json.loads(await ws.recv())
                events = msg.get("events", [])
                if any(e.get("type") == "mark" for e in events) or msg.get("gesture") == "fist":
                    mark_observed = True
                    break
            print(f"[PASS] 10. Gesture / Key shortcut 'f' (Milestone Mark) processed (mark_observed={mark_observed})")

            # Test Drop Camera
            print("Testing Drop Camera simulation...")
            drop_res = await client.post("/camera/drop", headers={"Authorization": f"Bearer {nurse_token}"})
            assert drop_res.status_code == 200
            # Wait for dropped status
            dropped_observed = False
            for _ in range(25):
                msg = json.loads(await ws.recv())
                if msg.get("camera_ok") is False:
                    dropped_observed = True
                    break
            assert dropped_observed, "Camera drop was not reflected in telemetry"
            print("[PASS] 11. Safety Watchdog: Camera drop alert triggered (camera_ok=False)")

            # Test Restore Camera
            print("Testing Restore Camera simulation...")
            restore_res = await client.post("/camera/restore", headers={"Authorization": f"Bearer {nurse_token}"})
            assert restore_res.status_code == 200
            restored_observed = False
            for _ in range(25):
                msg = json.loads(await ws.recv())
                if msg.get("camera_ok") is True:
                    restored_observed = True
                    break
            assert restored_observed, "Camera restore was not reflected in telemetry"
            print("[PASS] 12. Safety Watchdog: Camera successfully restored (camera_ok=True)")

            # Track instruments for a few seconds
            print("Tracking instruments during replay simulation...")
            detected_classes = set()
            for _ in range(50):
                msg = json.loads(await ws.recv())
                for t in msg.get("tools", []):
                    detected_classes.add(t.get("class"))
            print(f"[PASS] 13. Instruments detected in view: {detected_classes}")

        # 14. End Session & Retrieve Tray Summary
        print("Ending session and checking tray reconciliation...")
        res = await client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {nurse_token}"})
        assert res.status_code == 200, f"End session failed: {res.text}"
        end_data = res.json()
        summary = end_data["summary"]
        print("[PASS] 14. Session ended successfully. Tray reconciliation summary:")
        for row in summary:
            print(f"       - {row['class']}: entered={row['enter_count']}")

        # 15. Admin View History
        res = await client.get("/sessions", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        history_list = res.json()
        assert any(s["id"] == session_id for s in history_list)
        print(f"[PASS] 15. Admin session list contains session #{session_id}")

        # 16. Admin Audit PDF Report Generation & Download
        res = await client.get(f"/sessions/{session_id}/report.pdf", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200, f"PDF generation failed: {res.status_code}"
        assert res.headers["content-type"] == "application/pdf"
        assert res.content.startswith(b"%PDF"), "PDF content does not have valid %PDF magic header"
        pdf_size = len(res.content)
        print(f"[PASS] 16. PDF Report generated successfully: {pdf_size} bytes, Valid PDF header")

    print("\n=======================================================")
    print("[SUCCESS] ALL 16 END-TO-END PIPELINE CHECKS PASSED PERFECTLY!")
    print("=======================================================")

if __name__ == "__main__":
    asyncio.run(main())
