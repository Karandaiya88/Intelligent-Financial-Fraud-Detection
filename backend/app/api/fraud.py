from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.validation import read_table, validate_extension, validate_size
from app.schemas import PredictIn
from app.services import scoring_service as svc
from .deps import current_user, get_db

router = APIRouter(prefix="/api/fraud", tags=["fraud"], dependencies=[Depends(current_user)])


@router.post("/predict")
def predict(body: PredictIn, db: Session = Depends(get_db)):
    return svc.predict_single(db, body.model_run_id, body.features, body.transaction_reference)


@router.post("/bulk-predict")
async def bulk_predict(model_run_id: int = Form(...), file: UploadFile = File(...),
                       db: Session = Depends(get_db)):
    validate_extension(file.filename or "", settings.allowed_extensions)
    content = await file.read()
    validate_size(len(content), settings.max_upload_mb)
    return svc.predict_bulk(db, model_run_id, read_table(content, file.filename))


@router.get("/predictions")
def predictions(model_run_id: Optional[int] = None, risk_level: Optional[str] = Query(None, pattern="(?i)^(low|medium|high)$"),
                is_anomaly: Optional[bool] = None, min_probability: Optional[float] = Query(None, ge=0, le=1),
                q: Optional[str] = None, limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                db: Session = Depends(get_db)):
    return svc.query_predictions(db, model_run_id, risk_level, is_anomaly, min_probability, q, limit, offset)


@router.get("/predictions/{prediction_id}")
def prediction_detail(prediction_id: int, db: Session = Depends(get_db)):
    return svc.prediction_detail(db, prediction_id)
