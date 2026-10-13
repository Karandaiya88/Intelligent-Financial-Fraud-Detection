from __future__ import annotations
import uuid
from typing import Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data.validation import ValidationError
from app.db.models import ModelRun, Prediction
from app.ml.predict import feature_signals, predict_frame
from .model_service import get_run, load_anomaly, load_bundle

DISCLAIMER = "Model estimate for decision support, not proof of fraud."


def prediction_out(p: Prediction, features: bool = False, signals: Optional[dict] = None) -> dict:
    out = {"id": p.id, "model_run_id": p.model_run_id, "transaction_reference": p.transaction_reference,
           "fraud_probability": p.fraud_probability, "predicted_label": p.predicted_label,
           "anomaly_score": p.anomaly_score, "is_anomaly": p.is_anomaly, "risk_level": p.risk_level,
           "created_at": p.created_at.isoformat()}
    if features:
        out["features"] = p.features
        out["explanation"] = signals
        out["disclaimer"] = DISCLAIMER
    return out


def score_frame(db: Session, run: ModelRun, df: pd.DataFrame, refs: Optional[list] = None) -> list:
    bundle = load_bundle(run)
    target = run.config.get("target", "Class")
    df = df.drop(columns=[c for c in (target, "transaction_reference") if c in df.columns])
    out = predict_frame(bundle, df, anomaly_model=load_anomaly(run))
    cols = list(bundle["pipeline"].feature_names_in_)
    feats = df[cols].astype(object).where(df[cols].notna(), None).to_dict("records")
    refs = refs or [f"row-{i + 1}" for i in range(len(df))]
    rows = [Prediction(model_run_id=run.id, transaction_reference=str(refs[i]),
                       fraud_probability=float(o.fraud_probability), predicted_label=int(o.predicted_label),
                       anomaly_score=float(o.anomaly_score), is_anomaly=bool(o.is_anomaly),
                       risk_level=str(o.risk_level), features=feats[i])
            for i, o in enumerate(out.itertuples(index=False))]
    db.add_all(rows)
    db.commit()
    return rows


def predict_single(db: Session, run_id: int, features: dict, reference: Optional[str]) -> dict:
    run = get_run(db, run_id)
    ref = reference or f"txn-{uuid.uuid4().hex[:8]}"
    row = score_frame(db, run, pd.DataFrame([features]), [ref])[0]
    sig = feature_signals(load_bundle(run)["pipeline"], row.features)
    return prediction_out(row, features=True, signals=sig)


def predict_bulk(db: Session, run_id: int, df: pd.DataFrame) -> dict:
    from app.core.config import settings
    run = get_run(db, run_id)
    if len(df) > settings.max_bulk_rows:
        raise ValidationError("TOO_MANY_ROWS", f"Batch exceeds {settings.max_bulk_rows} rows.",
                              {"max_rows": settings.max_bulk_rows})
    refs = df["transaction_reference"].astype(str).tolist() if "transaction_reference" in df.columns else None
    rows = score_frame(db, run, df, refs)
    dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    for r in rows:
        dist[r.risk_level] += 1
    return {"model_run_id": run.id, "total": len(rows), "risk_distribution": dist,
            "predicted_fraud": sum(r.predicted_label for r in rows),
            "anomalies": sum(1 for r in rows if r.is_anomaly), "disclaimer": DISCLAIMER,
            "preview": [prediction_out(r) for r in rows[:20]]}


def query_predictions(db: Session, model_run_id=None, risk_level=None, is_anomaly=None,
                      min_probability=None, q=None, limit=50, offset=0) -> dict:
    from sqlalchemy import func
    stmt = select(Prediction)
    if model_run_id is not None: stmt = stmt.where(Prediction.model_run_id == model_run_id)
    if risk_level: stmt = stmt.where(Prediction.risk_level == risk_level.upper())
    if is_anomaly is not None: stmt = stmt.where(Prediction.is_anomaly == is_anomaly)
    if min_probability is not None: stmt = stmt.where(Prediction.fraud_probability >= min_probability)
    if q: stmt = stmt.where(Prediction.transaction_reference.contains(q))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(Prediction.fraud_probability.desc(), Prediction.id)
                       .limit(limit).offset(offset)).all()
    return {"total": total, "limit": limit, "offset": offset, "items": [prediction_out(p) for p in items]}


def prediction_detail(db: Session, prediction_id: int) -> dict:
    p = db.get(Prediction, prediction_id)
    if p is None:
        raise ValidationError("NOT_FOUND", f"Prediction {prediction_id} not found.")
    run = get_run(db, p.model_run_id)
    sig = feature_signals(load_bundle(run)["pipeline"], p.features or {})
    return prediction_out(p, features=True, signals=sig)
