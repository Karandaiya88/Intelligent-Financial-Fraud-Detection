from __future__ import annotations
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.validation import validate_extension
from app.db.models import User
from app.services import dataset_service as svc
from .deps import current_user, get_db

router = APIRouter(prefix="/api/datasets", tags=["datasets"], dependencies=[Depends(current_user)])


@router.post("/upload", status_code=201)
async def upload(file: UploadFile = File(...), target_column: str = Form(settings.target_column),
                 db: Session = Depends(get_db), user: User = Depends(current_user)):
    validate_extension(file.filename or "", settings.allowed_extensions)
    return svc.create_dataset(db, user, file.filename, await file.read(), target_column)


@router.get("")
def list_datasets(db: Session = Depends(get_db)):
    return svc.list_datasets(db)


@router.get("/{dataset_id}")
def dataset_detail(dataset_id: int, db: Session = Depends(get_db)):
    return svc.dataset_out(svc.get_dataset(db, dataset_id), detail=True)
