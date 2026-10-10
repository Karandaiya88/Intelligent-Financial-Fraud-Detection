"""Train, compare, persist (FR-05, FR-12 metadata)."""
from __future__ import annotations
import json
import os
import time
from dataclasses import dataclass, field
from typing import Optional

import joblib
import pandas as pd

from app.data.inspection import fingerprint
from app.data.splitting import Splits, split_data
from .evaluation import evaluate
from .pipelines import MODEL_NAMES, ROLES, build_pipeline
from .policy import RiskPolicy, select_threshold


@dataclass
class ModelResult:
    name: str
    pipeline: object
    threshold: float
    policy: RiskPolicy
    val_metrics: dict
    test_metrics: dict
    train_seconds: float
    train_rows: int
    note: str = ""


@dataclass
class RunResult:
    results: dict
    splits: Splits
    config: dict
    dataset_fingerprint: str
    model_version: str

    def best_model(self, by: str = "pr_auc") -> str:
        """Selected on VALIDATION metrics (never on the test set)."""
        return max(self.results, key=lambda n: self.results[n].val_metrics[by] or 0.0)

    def comparison_table(self) -> pd.DataFrame:
        rows = []
        for n, r in self.results.items():
            m = r.test_metrics
            rows.append({"model": n, "precision": m["precision"], "recall": m["recall"], "f1": m["f1"],
                         "pr_auc": m["pr_auc"], "roc_auc": m["roc_auc"], "threshold": r.threshold,
                         "FP": m["false_positives"], "FN": m["false_negatives"],
                         "train_seconds": round(r.train_seconds, 2), "note": r.note})
        return pd.DataFrame(rows).set_index("model")


def _stratified_sample(X, y, n: int, seed: int):
    if len(X) <= n:
        return X, y
    idx = (pd.DataFrame({"y": y.values}, index=X.index)
           .groupby("y", group_keys=False)
           .apply(lambda g: g.sample(max(1, round(n * len(g) / len(X))), random_state=seed)).index)
    return X.loc[idx], y.loc[idx]


def train_and_compare(df: pd.DataFrame, target: str = "Class", models: Optional[list] = None,
                      seed: int = 42, test_size: float = 0.2, val_size: float = 0.2,
                      svm_max_train: int = 20000, threshold_strategy: str = "max_f1",
                      min_precision: Optional[float] = None) -> RunResult:
    models = models or MODEL_NAMES
    sp = split_data(df, target, seed, test_size, val_size)
    results = {}
    for name in models:
        Xtr, ytr, note = sp.X_train, sp.y_train, ""
        if name == "svm":
            Xtr, ytr = _stratified_sample(sp.X_train, sp.y_train, svm_max_train, seed)
            if len(Xtr) < len(sp.X_train):
                note = f"trained on stratified sample of {len(Xtr)}/{len(sp.X_train)} rows"
        pipe = build_pipeline(name, seed)
        t0 = time.perf_counter()
        pipe.fit(Xtr, ytr)
        secs = time.perf_counter() - t0
        val_scores = pipe.predict_proba(sp.X_val)[:, 1]
        thr = select_threshold(sp.y_val, val_scores, threshold_strategy, min_precision)
        val_m = evaluate(sp.y_val, val_scores, thr)
        test_m = evaluate(sp.y_test, pipe.predict_proba(sp.X_test)[:, 1], thr)  # test used once, after tuning
        results[name] = ModelResult(name, pipe, thr, RiskPolicy.from_threshold(thr),
                                    val_m, test_m, secs, len(Xtr), note)
    fp = fingerprint(df)
    config = {"seed": seed, "test_size": test_size, "val_size": val_size, "models": models,
              "svm_max_train": svm_max_train, "threshold_strategy": threshold_strategy,
              "min_precision": min_precision, "target": target, "class_counts": sp.class_counts()}
    return RunResult(results, sp, config, fp, f"v{fp[:8]}-s{seed}")


def save_run(run: RunResult, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    meta = {"model_version": run.model_version, "dataset_fingerprint": run.dataset_fingerprint,
            "config": run.config, "best_model_by_val_pr_auc": run.best_model(), "models": {}}
    for n, r in run.results.items():
        joblib.dump({"pipeline": r.pipeline, "threshold": r.threshold, "policy": r.policy.to_dict()},
                    os.path.join(out_dir, f"{n}.joblib"))
        meta["models"][n] = {"role": ROLES[n], "threshold": r.threshold, "policy": r.policy.to_dict(),
                             "val_metrics": r.val_metrics, "test_metrics": r.test_metrics,
                             "train_rows": r.train_rows, "note": r.note}
    with open(os.path.join(out_dir, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    run.comparison_table().to_csv(os.path.join(out_dir, "comparison.csv"))
    return out_dir


def load_model(path: str) -> dict:
    return joblib.load(path)
