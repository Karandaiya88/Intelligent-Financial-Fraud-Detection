"""Isolation Forest (FR-08). Output is an ANOMALY signal, never a fraud label."""
from __future__ import annotations
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def fit_isolation_forest(X_train, seed: int = 42, n_estimators: int = 200,
                         contamination="auto") -> Pipeline:
    """Fitted on training features only (labels are not used)."""
    pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("iforest", IsolationForest(n_estimators=n_estimators, contamination=contamination,
                                    random_state=seed, n_jobs=-1)),
    ])
    return pipe.fit(X_train)


def anomaly_scores(model: Pipeline, X) -> np.ndarray:
    """Higher = more unusual."""
    Xt = model[:-1].transform(X)
    return -model.named_steps["iforest"].score_samples(Xt)


def is_anomaly(model: Pipeline, X) -> np.ndarray:
    Xt = model[:-1].transform(X)
    return model.named_steps["iforest"].predict(Xt) == -1
