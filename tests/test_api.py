from fastapi.testclient import TestClient

from api.main import app, get_db


def test_roles_history_and_pdf():
    with TestClient(app) as client:
        denied = client.post("/login", json={"username": "nurse", "password": "wrong"})
        assert denied.status_code == 401

        nurse = client.post("/login", json={"username": "nurse", "password": "nurse123"})
        assert nurse.status_code == 200
        nurse_token = nurse.json()["token"]
        assert nurse.json()["role"] == "nurse"

        hidden = client.get("/sessions", headers=_auth(nurse_token))
        assert hidden.status_code == 403

        admin = client.post("/login", json={"username": "admin", "password": "admin123"})
        admin_token = admin.json()["token"]
        created = client.post(
            "/sessions",
            json={"name": "Tray check"},
            headers=_auth(admin_token),
        )
        assert created.status_code == 200
        session_id = created.json()["id"]

        database = get_db()
        database.add_event(session_id, "tool_enter", "scalpel", 1)
        database.add_event(session_id, "mark", None, None)

        blocked = client.get(
            f"/sessions/{session_id}/report.pdf",
            headers=_auth(nurse_token),
        )
        assert blocked.status_code == 403

        ended = client.post(f"/sessions/{session_id}/end", headers=_auth(admin_token))
        assert ended.status_code == 200
        summary_map = {row["class"]: row["enter_count"] for row in ended.json()["summary"]}
        assert summary_map["scalpel"] == 1
        assert summary_map["straight_dissection_clamp"] == 0
        assert summary_map["straight_mayo_scissor"] == 0
        assert summary_map["curved_mayo_scissor"] == 0

        listed = client.get("/sessions", headers=_auth(admin_token))
        assert listed.status_code == 200
        assert listed.json()[0]["name"] == "Tray check"

        pdf = client.get(
            f"/sessions/{session_id}/report.pdf",
            headers=_auth(admin_token),
        )
        assert pdf.status_code == 200
        assert pdf.headers["content-type"] == "application/pdf"
        assert pdf.content.startswith(b"%PDF")
        assert b"Scalpel" in pdf.content or b"scalpel" in pdf.content


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
