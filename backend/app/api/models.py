from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas import ThresholdIn, TrainIn
from app.services import model_service as svc
from .deps import current_user, get_db

router = APIRouter(prefix="/api/models", tags=["models"], dependencies=[Depends(current_user)])


@router.post("/train", status_code=201)
def train(body: TrainIn, db: Session = Depends(get_db)):
    runs = svc.train(db, body)
    best = next((r.id for r in runs if r.is_best), None)
    return {"status": "completed", "run_ids": [r.id for r in runs], "best_model_run_id": best,
            "runs": [svc.run_out(r) for r in runs]}


@router.get("")
def list_runs(db: Session = Depends(get_db)):
    return svc.list_runs(db)


@router.get("/{run_id}/metrics")
def metrics(run_id: int, db: Session = Depends(get_db)):
    return svc.run_out(svc.get_run(db, run_id))


@router.put("/{run_id}/policy")
def set_policy(run_id: int, body: ThresholdIn, db: Session = Depends(get_db)):
    """Settings page: configurable LOW/MEDIUM/HIGH risk thresholds for a model run."""
    run = svc.update_policy(db, svc.get_run(db, run_id), body.t_medium, body.t_high)
    return {"model_run_id": run.id, "risk_policy": run.config["risk_policy"]}
