from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_token, decode_token, verify_password
from app.data.validation import ValidationError
from app.db.models import RevokedToken, User
from app.schemas import LoginIn
from .deps import bearer, current_user, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise ValidationError("UNAUTHORIZED", "Incorrect username or password.")  # same message for both
    token, exp = create_token(user.username)
    return {"access_token": token, "token_type": "bearer", "expires_at": exp.isoformat()}


@router.post("/logout")
def logout(creds: HTTPAuthorizationCredentials = Depends(bearer), user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    payload = decode_token(creds.credentials)
    db.add(RevokedToken(jti=payload["jti"],
                        expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc)))
    db.commit()
    return {"status": "logged_out"}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return {"username": user.username, "email": user.email}
