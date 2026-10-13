from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Optional

import joblib
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.validation import ValidationError
from app.db.models import ModelRun
from app.ml.anomaly import fit_isolation_forest
from app.ml.policy import RiskPolicy
from app.ml.training import load_model, save_run, train_and_compare
from app.schemas import TrainIn
from .dataset_service import get_dataset, load_frame

_cache: dict = {}


def run_out(r: ModelRun) -> dict:
    return {"model_run_id": r.id, "dataset_id": r.dataset_id, "model_name": r.model_name,
            "model_version": r.model_version, "is_best": r.is_best,
            "created_at": r.created_at.isoformat(), "config": r.config,
            "metrics": r.metrics_json,
            "risk_policy": r.config.get("risk_policy")}


def get_run(db: Session, run_id: int) -> ModelRun:
    r = db.get(ModelRun, run_id)
    if r is None:
        raise ValidationError("NOT_FOUND", f"Model run {run_id} not found.")
    return r


def train(db: Session, body: TrainIn) -> list:
    ds = get_dataset(db, body.dataset_id)
    df = load_frame(ds)
    run = train_and_compare(df, ds.target_column, list(body.models), seed=body.random_seed,
                            test_size=body.test_size, val_size=body.val_size,
                            svm_max_train=settings.svm_max_train,
                            threshold_strategy=body.threshold_strategy, min_precision=body.min_precision)
    iso = fit_isolation_forest(run.splits.X_train, seed=body.random_seed)  # separate anomaly signal
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    batch = f"ds{ds.id}_{run.model_version}_{stamp}"
    out_dir = os.path.join(settings.model_dir, batch)
    save_run(run, out_dir)
    anomaly_path = os.path.join(out_dir, "anomaly.joblib")
    joblib.dump(iso, anomaly_path)
    best = run.best_model()
    rows = []
    for name, r in run.results.items():
        cfg = {**run.config, "batch": batch, "anomaly_path": anomaly_path,
               "dataset_fingerprint": run.dataset_fingerprint, "note": r.note,
               "decision_threshold": r.threshold, "risk_policy": r.policy.to_dict()}
        rows.append(ModelRun(dataset_id=ds.id, model_name=name, config=cfg,
                             metrics_json={"validation": r.val_metrics, "test": r.test_metrics,
                                           "train_seconds": round(r.train_seconds, 3),
                                           "train_rows": r.train_rows},
                             model_version=run.model_version,
                             artifact_path=os.path.join(out_dir, f"{name}.joblib"),
                             is_best=(name == best)))
    db.add_all(rows)
    db.commit()
    return rows


def list_runs(db: Session) -> list:
    return [run_out(r) for r in db.scalars(select(ModelRun).order_by(ModelRun.id.desc()))]


def latest_batch(db: Session) -> list:
    last = db.scalars(select(ModelRun).order_by(ModelRun.id.desc()).limit(1)).first()
    if last is None:
        return []
    recent = db.scalars(select(ModelRun).order_by(ModelRun.id.desc()).limit(50)).all()
    return [r for r in recent if r.config.get("batch") == last.config.get("batch")][::-1]


def update_policy(db: Session, run: ModelRun, t_medium: float, t_high: float) -> ModelRun:
    try:
        policy = RiskPolicy(t_medium, t_high)
    except ValueError as exc:
        raise ValidationError("INVALID_POLICY", str(exc))
    run.config = {**run.config, "risk_policy": policy.to_dict()}  # reassign so JSON change is tracked
    db.commit()
    return run


def load_bundle(run: ModelRun) -> dict:
    if run.artifact_path not in _cache:
        _cache[run.artifact_path] = load_model(run.artifact_path)
    bundle = dict(_cache[run.artifact_path])
    bundle["policy"] = run.config.get("risk_policy", bundle["policy"])  # honours Settings overrides
    return bundle


def load_anomaly(run: ModelRun):
    path = run.config.get("anomaly_path")
    if not path or not os.path.exists(path):
        return None
    if path not in _cache:
        _cache[path] = joblib.load(path)
    return _cache[path]
