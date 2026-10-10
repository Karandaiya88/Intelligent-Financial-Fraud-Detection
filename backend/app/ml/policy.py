"""Threshold selection + LOW/MEDIUM/HIGH risk bands.
Bands are application-level categories (NOT financial standards) and must stay configurable."""
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Optional

import numpy as np
from sklearn.metrics import precision_recall_curve


def select_threshold(y_true, scores, strategy: str = "max_f1",
                     min_precision: Optional[float] = None) -> float:
    """Choose the decision threshold on VALIDATION data.
    max_f1        : maximise F1.
    min_precision : highest recall subject to precision >= min_precision (falls back to max_f1)."""
    prec, rec, thr = precision_recall_curve(y_true, scores)
    prec, rec = prec[:-1], rec[:-1]
    if len(thr) == 0:
        return 0.5
    f1 = 2 * prec * rec / np.maximum(prec + rec, 1e-12)
    if strategy == "min_precision" and min_precision is not None:
        ok = np.where(prec >= min_precision)[0]
        if len(ok):
            return float(thr[ok[np.argmax(rec[ok])]])
    elif strategy not in ("max_f1", "min_precision"):
        raise ValueError("strategy must be 'max_f1' or 'min_precision'")
    return float(thr[int(np.argmax(f1))])


@dataclass
class RiskPolicy:
    t_medium: float
    t_high: float

    def __post_init__(self):
        if not (0.0 <= self.t_medium <= self.t_high <= 1.0):
            raise ValueError("Require 0 <= t_medium <= t_high <= 1")

    @classmethod
    def from_threshold(cls, decision_threshold: float, medium_ratio: float = 0.5) -> "RiskPolicy":
        """Default policy: HIGH at the validated decision threshold; MEDIUM starts at
        medium_ratio * threshold. The ratio is a configurable starting point, tune it in Settings."""
        t = float(min(max(decision_threshold, 0.0), 1.0))
        return cls(t_medium=t * medium_ratio, t_high=t)

    def assign(self, probabilities) -> np.ndarray:
        p = np.asarray(probabilities, dtype=float)
        return np.select([p >= self.t_high, p >= self.t_medium], ["HIGH", "MEDIUM"], default="LOW")

    def to_dict(self) -> dict:
        return asdict(self)
