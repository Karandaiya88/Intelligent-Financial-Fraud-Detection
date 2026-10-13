from __future__ import annotations
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Dataset, ModelRun, Prediction
from .model_service import latest_batch


def summary(db: Session) -> dict:
    total = db.scalar(select(func.count(Prediction.id))) or 0
    dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    for level, n in db.execute(select(Prediction.risk_level, func.count()).group_by(Prediction.risk_level)):
        dist[level] = n
    ds = db.scalars(select(Dataset).order_by(Dataset.id.desc()).limit(1)).first()
    batch = latest_batch(db)
    best = next((r for r in batch if r.is_best), None)
    return {
        "datasets": db.scalar(select(func.count(Dataset.id))) or 0,
        "model_runs": db.scalar(select(func.count(ModelRun.id))) or 0,
        "latest_dataset": None if ds is None else {
            "id": ds.id, "filename": ds.filename, "row_count": ds.row_count,
            "class_balance": ds.inspection.get("class_balance"), "fraud_rate": ds.inspection.get("fraud_rate")},
        "transactions_scored": total,
        "risk_distribution": dist,
        "predicted_fraud": db.scalar(select(func.count()).where(Prediction.predicted_label == 1)) or 0,
        "anomalies": db.scalar(select(func.count()).where(Prediction.is_anomaly.is_(True))) or 0,
        "model_status": {"trained": bool(batch), "best_model_run_id": best.id if best else None,
                         "best_model": best.model_name if best else None},
        "model_metrics": [{"model_run_id": r.id, "model": r.model_name, "is_best": r.is_best,
                           **{k: r.metrics_json["test"][k] for k in ("precision", "recall", "f1", "pr_auc", "roc_auc")}}
                          for r in batch],
        "disclaimer": "Predictions are decision-support estimates, not proof of fraud.",
    }
