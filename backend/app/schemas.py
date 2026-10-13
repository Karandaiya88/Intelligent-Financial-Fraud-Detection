"""Request bodies (responses are plain dicts built by the services)."""
from __future__ import annotations
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.core.config import settings
from app.ml.pipelines import MODEL_NAMES

ModelName = Literal["logistic_regression", "decision_tree", "random_forest", "svm", "naive_bayes"]


class LoginIn(BaseModel):
    username: str
    password: str


class TrainIn(BaseModel):
    dataset_id: int
    models: List[ModelName] = Field(default_factory=lambda: list(MODEL_NAMES), min_length=1)
    random_seed: int = settings.random_seed
    test_size: float = Field(0.2, gt=0.0, lt=0.5)
    val_size: float = Field(0.2, gt=0.0, lt=0.5)
    threshold_strategy: Literal["max_f1", "min_precision"] = "max_f1"
    min_precision: Optional[float] = Field(None, ge=0.0, le=1.0)


class PredictIn(BaseModel):
    model_run_id: int
    features: Dict[str, Optional[float]]
    transaction_reference: Optional[str] = None


class ReportIn(BaseModel):
    report_type: Literal["model_comparison", "predictions"]
    format: Literal["csv", "xlsx"] = "xlsx"
    model_run_ids: Optional[List[int]] = None
    model_run_id: Optional[int] = None


class ThresholdIn(BaseModel):
    t_medium: float = Field(ge=0.0, le=1.0)
    t_high: float = Field(ge=0.0, le=1.0)
