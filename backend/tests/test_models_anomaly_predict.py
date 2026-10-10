import numpy as np
import pandas as pd
import pytest
from app.data.validation import ValidationError
from app.ml.anomaly import anomaly_scores, fit_isolation_forest, is_anomaly
from app.ml.clustering import cluster_summary, fit_kmeans
from app.ml.predict import predict_frame
from app.ml.training import load_model, save_run, train_and_compare

FAST = dict(svm_max_train=1200)


@pytest.fixture(scope="module")
def run(df):
    return train_and_compare(df, seed=11, **FAST)


def test_at_least_three_models_with_comparable_metrics(run):
    assert len(run.results) >= 3
    tbl = run.comparison_table()
    for c in ["precision", "recall", "f1", "pr_auc", "roc_auc"]:
        assert tbl[c].notna().all()


def test_same_seed_same_metrics(df, run):
    again = train_and_compare(df, seed=11, models=["logistic_regression", "random_forest"], **FAST)
    for n in again.results:
        assert again.results[n].test_metrics == run.results[n].test_metrics


def test_svm_sample_is_documented(run):
    assert "stratified sample" in run.results["svm"].note


def test_reload_consistency(run, tmp_path):
    save_run(run, str(tmp_path))
    X = run.splits.X_test.head(100)
    for n, r in run.results.items():
        b = load_model(str(tmp_path / f"{n}.joblib"))
        np.testing.assert_allclose(r.pipeline.predict_proba(X), b["pipeline"].predict_proba(X))
    assert (tmp_path / "metadata.json").exists() and (tmp_path / "comparison.csv").exists()


def test_predict_frame_outputs_and_separate_anomaly(run, df):
    best = run.best_model()
    bundle = {"pipeline": run.results[best].pipeline, "threshold": run.results[best].threshold,
              "policy": run.results[best].policy.to_dict()}
    iso = fit_isolation_forest(run.splits.X_train, seed=11)
    out = predict_frame(bundle, run.splits.X_test, anomaly_model=iso)
    assert set(out.columns) == {"fraud_probability", "predicted_label", "risk_level", "anomaly_score", "is_anomaly"}
    assert out["fraud_probability"].between(0, 1).all()
    assert set(out["risk_level"]) <= {"LOW", "MEDIUM", "HIGH"}
    # anomaly flag must not be a copy of the fraud label
    assert not (out["is_anomaly"].astype(int) == out["predicted_label"]).all()


def test_predict_schema_mismatch(run):
    r = run.results["logistic_regression"]
    bundle = {"pipeline": r.pipeline, "threshold": r.threshold, "policy": r.policy.to_dict()}
    with pytest.raises(ValidationError) as e:
        predict_frame(bundle, run.splits.X_test.drop(columns=["V3"]))
    assert e.value.code == "SCHEMA_MISMATCH"


def test_isolation_forest_scores(run):
    iso = fit_isolation_forest(run.splits.X_train, seed=1)
    s = anomaly_scores(iso, run.splits.X_test)
    assert len(s) == len(run.splits.X_test) and is_anomaly(iso, run.splits.X_test).dtype == bool


def test_kmeans_summary(run):
    km = fit_kmeans(run.splits.X_train, k=3)
    tbl = cluster_summary(km, run.splits.X_test, run.splits.y_test)
    assert tbl["size"].sum() == len(run.splits.X_test)
