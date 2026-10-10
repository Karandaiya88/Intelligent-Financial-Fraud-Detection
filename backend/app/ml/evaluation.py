"""Imbalance-aware metrics (FR-06). Accuracy is intentionally NOT the headline metric."""
from __future__ import annotations
import numpy as np
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)


def evaluate(y_true, scores, threshold: float = 0.5) -> dict:
    y_true = np.asarray(y_true).astype(int)
    scores = np.asarray(scores, dtype=float)
    y_pred = (scores >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    two_classes = len(np.unique(y_true)) == 2
    return {
        "threshold": float(threshold),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "pr_auc": float(average_precision_score(y_true, scores)) if two_classes else None,
        "roc_auc": float(roc_auc_score(y_true, scores)) if two_classes else None,
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "class_counts": {"0": int((y_true == 0).sum()), "1": int((y_true == 1).sum())},
        "false_positives": int(fp),
        "false_negatives": int(fn),
    }
