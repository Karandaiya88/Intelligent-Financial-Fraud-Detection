"""Single/batch scoring using the SAME saved pipeline as training (FR-07)."""
from __future__ import annotations
from typing import Optional

import pandas as pd

from app.data.validation import ValidationError
from .anomaly import anomaly_scores, is_anomaly
from .policy import RiskPolicy


def predict_frame(bundle: dict, df: pd.DataFrame, anomaly_model=None) -> pd.DataFrame:
    pipe, thr = bundle["pipeline"], bundle["threshold"]
    policy = RiskPolicy(**bundle["policy"])
    expected = list(pipe.feature_names_in_)
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValidationError("SCHEMA_MISMATCH", f"Missing feature columns: {missing}", {"missing": missing})
    X = df[expected]  # enforce training column order
    proba = pipe.predict_proba(X)[:, 1]
    out = pd.DataFrame({"fraud_probability": proba,
                        "predicted_label": (proba >= thr).astype(int),
                        "risk_level": policy.assign(proba)}, index=df.index)
    if anomaly_model is not None:  # separate signal, never merged into the fraud label
        out["anomaly_score"] = anomaly_scores(anomaly_model, X)
        out["is_anomaly"] = is_anomaly(anomaly_model, X)
    return out
