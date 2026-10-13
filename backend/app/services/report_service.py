from __future__ import annotations
import os
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.validation import ValidationError
from app.db.models import ModelRun, Prediction, Report
from app.schemas import ReportIn
from .model_service import get_run, latest_batch

NOTE = ("Academic decision-support output. Predicted probabilities are model estimates, not proof of "
        "fraud. Anomaly scores flag unusual records, not confirmed fraud.")


def _comparison_frame(db: Session, ids) -> pd.DataFrame:
    runs = [get_run(db, i) for i in ids] if ids else latest_batch(db)
    if not runs:
        raise ValidationError("NOT_FOUND", "No model runs available for a report.")
    rows = []
    for r in runs:
        t, v = r.metrics_json["test"], r.metrics_json["validation"]
        rows.append({"model_run_id": r.id, "model": r.model_name, "version": r.model_version,
                     "selected_best_on_validation": r.is_best, "threshold": t["threshold"],
                     "test_precision": t["precision"], "test_recall": t["recall"], "test_f1": t["f1"],
                     "test_pr_auc": t["pr_auc"], "test_roc_auc": t["roc_auc"],
                     "false_positives": t["false_positives"], "false_negatives": t["false_negatives"],
                     "test_class_0": t["class_counts"]["0"], "test_class_1": t["class_counts"]["1"],
                     "validation_pr_auc": v["pr_auc"], "seed": r.config.get("seed"),
                     "note": r.config.get("note", "")})
    return pd.DataFrame(rows)


def _predictions_frame(db: Session, run_id) -> pd.DataFrame:
    if run_id is None:
        raise ValidationError("MISSING_FIELD", "model_run_id is required for a predictions report.")
    get_run(db, run_id)
    rows = db.scalars(select(Prediction).where(Prediction.model_run_id == run_id)
                      .order_by(Prediction.fraud_probability.desc())).all()
    return pd.DataFrame([{"transaction_reference": p.transaction_reference,
                          "fraud_probability": p.fraud_probability, "predicted_label": p.predicted_label,
                          "risk_level": p.risk_level, "anomaly_score": p.anomaly_score,
                          "is_anomaly": p.is_anomaly} for p in rows])


def generate(db: Session, body: ReportIn) -> dict:
    frame = (_comparison_frame(db, body.model_run_ids) if body.report_type == "model_comparison"
             else _predictions_frame(db, body.model_run_id))
    os.makedirs(settings.report_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    path = os.path.join(settings.report_dir, f"{body.report_type}_{stamp}.{body.format}")
    if body.format == "csv":
        frame.to_csv(path, index=False)
    else:
        with pd.ExcelWriter(path, engine="xlsxwriter") as xw:
            frame.to_excel(xw, sheet_name="Data", index=False)
            pd.DataFrame({"Notes": [NOTE]}).to_excel(xw, sheet_name="Notes", index=False)
            xw.sheets["Data"].freeze_panes(1, 0)
            xw.sheets["Data"].set_column(0, max(len(frame.columns) - 1, 0), 18)
            xw.sheets["Notes"].set_column(0, 0, 110)
    rep = Report(report_type=body.report_type, file_reference=path)
    db.add(rep)
    db.commit()
    return report_out(rep)


def report_out(r: Report) -> dict:
    return {"id": r.id, "report_type": r.report_type, "filename": os.path.basename(r.file_reference),
            "generated_at": r.generated_at.isoformat(), "download_url": f"/api/reports/{r.id}/download"}


def list_reports(db: Session) -> list:
    return [report_out(r) for r in db.scalars(select(Report).order_by(Report.id.desc()))]


def get_report(db: Session, report_id: int) -> Report:
    r = db.get(Report, report_id)
    if r is None or not os.path.exists(r.file_reference):
        raise ValidationError("NOT_FOUND", f"Report {report_id} not found.")
    return r
