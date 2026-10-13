from __future__ import annotations
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.data.validation import ValidationError
from app.db.models import RevokedToken, User
from app.db.session import SessionLocal

bearer = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer),
                 db: Session = Depends(get_db)) -> User:
    if creds is None:
        raise ValidationError("UNAUTHORIZED", "Authentication required.")
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise ValidationError("UNAUTHORIZED", "Invalid or expired token.")
    if db.get(RevokedToken, payload["jti"]) is not None:
        raise ValidationError("UNAUTHORIZED", "Token has been logged out.")
    user = db.scalar(select(User).where(User.username == payload["sub"]))
    if user is None:
        raise ValidationError("UNAUTHORIZED", "Unknown user.")
    return user
