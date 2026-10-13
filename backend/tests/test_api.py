import io
import openpyxl
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/login", json={"username": "analyst", "password": "S3cure-test-pass"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def csv_bytes(df):
    return df.to_csv(index=False).encode()


def err(r):
    return r.json()["error"]["code"]


# ---------- auth ----------
def test_protected_endpoints_need_token(client):
    for path in ("/api/datasets", "/api/dashboard/summary", "/api/models", "/api/reports"):
        r = client.get(path)
        assert r.status_code == 401 and err(r) == "UNAUTHORIZED"


def test_login_wrong_password(client):
    r = client.post("/api/auth/login", json={"username": "analyst", "password": "nope"})
    assert r.status_code == 401 and err(r) == "UNAUTHORIZED"


def test_logout_revokes_token(client):
    tok = client.post("/api/auth/login", json={"username": "analyst", "password": "S3cure-test-pass"}).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/auth/me", headers=h).status_code == 200
    assert client.post("/api/auth/logout", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401


def test_password_is_hashed():
    from sqlalchemy import select
    from app.db.models import User
    from app.db.session import SessionLocal
    with SessionLocal() as db:
        u = db.scalar(select(User))
        assert u.password_hash != "S3cure-test-pass" and u.password_hash.startswith("$2")


# ---------- datasets: invalid inputs ----------
def test_upload_wrong_extension(client, auth):
    r = client.post("/api/datasets/upload", headers=auth, files={"file": ("a.txt", b"x", "text/plain")})
    assert r.status_code == 400 and err(r) == "INVALID_FILE_TYPE"


def test_upload_empty_file(client, auth):
    r = client.post("/api/datasets/upload", headers=auth, files={"file": ("a.csv", b"", "text/csv")})
    assert r.status_code == 400 and err(r) == "EMPTY_FILE"


def test_upload_missing_columns(client, auth, df):
    r = client.post("/api/datasets/upload", headers=auth,
                    files={"file": ("a.csv", csv_bytes(df.drop(columns=["Amount"])), "text/csv")})
    assert r.status_code == 422 and err(r) == "MISSING_COLUMNS"
    assert r.json()["error"]["details"]["missing"] == ["Amount"]


def test_upload_too_large(client, auth):
    r = client.post("/api/datasets/upload", headers=auth,
                    files={"file": ("a.csv", b"a,b\n" + b"1,2\n" * 2_000_000, "text/csv")})
    assert r.status_code == 413 and err(r) == "FILE_TOO_LARGE"


def test_unknown_dataset_and_model(client, auth):
    assert client.get("/api/datasets/9999", headers=auth).status_code == 404
    assert client.get("/api/models/9999/metrics", headers=auth).status_code == 404
    assert client.post("/api/models/train", headers=auth, json={"dataset_id": 9999}).status_code == 404


# ---------- end-to-end workflow ----------
@pytest.fixture(scope="module")
def flow(client, auth, df):
    up = client.post("/api/datasets/upload", headers=auth, files={"file": ("creditcard_synth.csv", csv_bytes(df), "text/csv")})
    assert up.status_code == 201, up.text
    ds = up.json()
    tr = client.post("/api/models/train", headers=auth, json={
        "dataset_id": ds["id"], "models": ["logistic_regression", "random_forest", "naive_bayes"], "random_seed": 5})
    assert tr.status_code == 201, tr.text
    return {"ds": ds, "train": tr.json()}


def test_upload_inspection(flow, df):
    ins = flow["ds"]["inspection"]
    assert flow["ds"]["row_count"] == len(df)
    assert ins["class_balance"] == {"0": int((df.Class == 0).sum()), "1": int((df.Class == 1).sum())}
    assert ins["duplicates"] == 0 and len(ins["preview"]) == 5


def test_train_and_metrics(client, auth, flow):
    t = flow["train"]
    assert len(t["run_ids"]) == 3 and t["best_model_run_id"] in t["run_ids"]
    m = client.get(f"/api/models/{t['run_ids'][0]}/metrics", headers=auth).json()
    for k in ("precision", "recall", "f1", "pr_auc", "roc_auc", "confusion_matrix", "class_counts"):
        assert k in m["metrics"]["test"]
    assert m["config"]["seed"] == 5 and m["model_version"]


def test_single_prediction(client, auth, flow, df):
    rid = flow["train"]["best_model_run_id"]
    row = df.drop(columns=["Class"]).iloc[0].to_dict()
    r = client.post("/api/fraud/predict", headers=auth, json={"model_run_id": rid, "features": row, "transaction_reference": "t-1"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert 0 <= j["fraud_probability"] <= 1 and j["risk_level"] in {"LOW", "MEDIUM", "HIGH"}
    assert j["anomaly_score"] is not None and "not proof of fraud" in j["disclaimer"]
    assert len(j["explanation"]["top_features"]) == 5


def test_single_prediction_schema_mismatch(client, auth, flow, df):
    rid = flow["train"]["best_model_run_id"]
    row = df.drop(columns=["Class", "V3"]).iloc[0].to_dict()
    r = client.post("/api/fraud/predict", headers=auth, json={"model_run_id": rid, "features": row})
    assert r.status_code == 422 and err(r) == "SCHEMA_MISMATCH"


def test_bulk_prediction_and_transaction_analysis(client, auth, flow, df):
    rid = flow["train"]["best_model_run_id"]
    batch = df.drop(columns=["Class"]).head(300)
    r = client.post("/api/fraud/bulk-predict", headers=auth, data={"model_run_id": rid},
                    files={"file": ("batch.csv", csv_bytes(batch), "text/csv")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["total"] == 300 and sum(j["risk_distribution"].values()) == 300
    lst = client.get("/api/fraud/predictions", headers=auth, params={"model_run_id": rid, "limit": 10}).json()
    assert lst["total"] >= 300 and len(lst["items"]) == 10
    probs = [i["fraud_probability"] for i in lst["items"]]
    assert probs == sorted(probs, reverse=True)
    high = client.get("/api/fraud/predictions", headers=auth, params={"risk_level": "high", "limit": 500}).json()
    assert all(i["risk_level"] == "HIGH" for i in high["items"])
    d = client.get(f"/api/fraud/predictions/{lst['items'][0]['id']}", headers=auth).json()
    assert "features" in d and d["explanation"]["top_features"]


def test_bulk_too_many_rows(client, auth, flow, df):
    rid = flow["train"]["best_model_run_id"]
    r = client.post("/api/fraud/bulk-predict", headers=auth, data={"model_run_id": rid},
                    files={"file": ("big.csv", csv_bytes(df.drop(columns=["Class"]).head(1500)), "text/csv")})
    assert r.status_code == 413 and err(r) == "TOO_MANY_ROWS"


def test_configurable_risk_policy(client, auth, flow, df):
    rid = flow["train"]["run_ids"][0]
    assert client.put(f"/api/models/{rid}/policy", headers=auth, json={"t_medium": 0.8, "t_high": 0.3}).status_code == 422
    ok = client.put(f"/api/models/{rid}/policy", headers=auth, json={"t_medium": 0.0, "t_high": 0.0})
    assert ok.status_code == 200
    row = df.drop(columns=["Class"]).iloc[1].to_dict()
    j = client.post("/api/fraud/predict", headers=auth, json={"model_run_id": rid, "features": row}).json()
    assert j["risk_level"] == "HIGH"   # threshold 0 -> everything HIGH proves the policy is honoured


def test_dashboard_summary(client, auth, flow):
    s = client.get("/api/dashboard/summary", headers=auth).json()
    assert s["datasets"] >= 1 and s["model_runs"] >= 3 and s["transactions_scored"] >= 300
    assert sum(s["risk_distribution"].values()) == s["transactions_scored"]
    assert s["model_status"]["trained"] and len(s["model_metrics"]) == 3
    assert "decision-support" in s["disclaimer"]


def test_reports_csv_and_xlsx(client, auth, flow):
    rid = flow["train"]["best_model_run_id"]
    for body, ext in (({"report_type": "model_comparison", "format": "csv"}, "csv"),
                      ({"report_type": "model_comparison", "format": "xlsx"}, "xlsx"),
                      ({"report_type": "predictions", "format": "xlsx", "model_run_id": rid}, "xlsx")):
        g = client.post("/api/reports/generate", headers=auth, json=body)
        assert g.status_code == 201, g.text
        dl = client.get(g.json()["download_url"], headers=auth)
        assert dl.status_code == 200
        if ext == "csv":
            frame = pd.read_csv(io.BytesIO(dl.content))
            assert {"test_precision", "test_recall", "test_pr_auc"} <= set(frame.columns) and len(frame) == 3
        else:
            wb = openpyxl.load_workbook(io.BytesIO(dl.content))
            assert wb.sheetnames == ["Data", "Notes"]
    assert client.post("/api/reports/generate", headers=auth, json={"report_type": "predictions"}).status_code == 422
    assert len(client.get("/api/reports", headers=auth).json()) >= 3


def test_history_persists_after_restart(flow, auth):
    with TestClient(app) as fresh:   # new lifespan = simulated app restart
        r = fresh.post("/api/auth/login", json={"username": "analyst", "password": "S3cure-test-pass"})
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        assert any(d["id"] == flow["ds"]["id"] for d in fresh.get("/api/datasets", headers=h).json())
        assert len(fresh.get("/api/models", headers=h).json()) >= 3
