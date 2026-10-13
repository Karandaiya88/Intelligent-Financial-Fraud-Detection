"""Single/batch scoring using the SAME saved pipeline as training (FR-07)."""
from __future__ import annotations
from typing import Optional

import numpy as np
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


def feature_signals(pipe, row: dict, top_k: int = 5) -> dict:
    """Lightweight explanation signal: features with the largest standardized deviation from the
    TRAINING mean. For Logistic Regression the linear contribution (coef * z) is added.
    This is NOT SHAP and not a causal explanation; features are anonymized (V1-V28)."""
    cols = list(pipe.feature_names_in_)
    frame = pd.DataFrame([{c: row.get(c) for c in cols}], columns=cols).astype(float)
    z = pipe.named_steps["scale"].transform(pipe.named_steps["impute"].transform(frame))[0]
    clf = pipe.named_steps["clf"]
    contrib = clf.coef_[0] * z if hasattr(clf, "coef_") else None
    order = np.argsort(-np.abs(contrib if contrib is not None else z))[:top_k]
    items = []
    for i in order:
        item = {"feature": cols[i], "value": None if pd.isna(frame.iloc[0, i]) else float(frame.iloc[0, i]),
                "z_score": float(z[i])}
        if contrib is not None:
            item["contribution"] = float(contrib[i])
        items.append(item)
    return {"method": "linear_contribution" if contrib is not None else "standardized_deviation",
            "note": "Explanation signal only; features are anonymized and this is not proof of fraud.",
            "top_features": items}
