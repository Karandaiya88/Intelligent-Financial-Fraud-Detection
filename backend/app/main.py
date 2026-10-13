"""FastAPI entrypoint. Run: uvicorn app.main:app --reload"""
from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api import auth, dashboard, datasets, fraud, models, reports
from app.core.config import settings
from app.core.security import hash_password
from app.data.validation import ValidationError
from app.db import models as _models  # noqa: F401  (register tables)
from app.db.models import User
from app.db.session import Base, SessionLocal, engine

log = logging.getLogger("fraud")

STATUS = {"UNAUTHORIZED": 401, "NOT_FOUND": 404, "INVALID_FILE_TYPE": 400, "EMPTY_FILE": 400,
          "UNREADABLE_FILE": 400, "FILE_TOO_LARGE": 413, "TOO_MANY_ROWS": 413}


def seed_admin() -> None:
    """Single-user app: create the analyst account from env vars if no user exists."""
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            return
        if not (settings.admin_username and settings.admin_password):
            log.warning("No user exists and ADMIN_USERNAME/ADMIN_PASSWORD are not set. "
                        "Run: python -m scripts.create_user")
            return
        db.add(User(username=settings.admin_username, email=settings.admin_email or None,
                    password_hash=hash_password(settings.admin_password)))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    for d in (settings.upload_dir, settings.model_dir, settings.report_dir):
        os.makedirs(d, exist_ok=True)
    if settings.secret_key == "dev-only-change-me":
        log.warning("SECRET_KEY is the development default. Set a strong value in .env.")
    Base.metadata.create_all(engine)
    seed_admin()
    yield


app = FastAPI(title="Intelligent Financial Fraud Detection Platform", version="1.0.0",
              description="Academic decision-support prototype. Predictions are model estimates, "
                          "not proof of fraud.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(ValidationError)
async def validation_error_handler(_: Request, exc: ValidationError):
    return JSONResponse(status_code=STATUS.get(exc.code, 422), content=exc.to_dict())


for r in (auth.router, datasets.router, models.router, fraud.router, dashboard.router, reports.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
