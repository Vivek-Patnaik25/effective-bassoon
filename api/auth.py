"""Sign-in tokens for the nurse and admin roles."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from events.db import check_password

bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def secret() -> str:
    return os.environ.get("JWT_SECRET", "theatre-demo-secret-change-before-any-real-use")


def create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, secret(), algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Sign-in expired") from exc


def authenticate(db, username: str, password: str) -> dict:
    user = db.user_by_name(username.strip())
    if user is None or not check_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"username": user["username"], "role": user["role"]}


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    payload = decode_token(credentials.credentials)
    return {"username": payload["sub"], "role": payload["role"]}


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user
