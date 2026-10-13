from __future__ import annotations
import os

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.data.inspection import fingerprint, inspect
from app.data.validation import ValidationError, read_table, validate_schema, validate_size
from app.db.models import Dataset, User


def dataset_out(ds: Dataset, detail: bool = False) -> dict:
    out = {"id": ds.id, "filename": ds.filename, "row_count": ds.row_count,
           "target_column": ds.target_column, "column_schema": ds.column_schema,
           "uploaded_at": ds.uploaded_at.isoformat(), "fingerprint": ds.fingerprint}
    if detail:
        out["inspection"] = ds.inspection
    else:
        ib = ds.inspection
        out["inspection"] = {k: ib[k] for k in ("missing_values", "duplicates", "class_balance", "fraud_rate")}
    return out


def get_dataset(db: Session, dataset_id: int) -> Dataset:
    ds = db.get(Dataset, dataset_id)
    if ds is None:
        raise ValidationError("NOT_FOUND", f"Dataset {dataset_id} not found.")
    return ds


def create_dataset(db: Session, user: User, filename: str, content: bytes, target: str) -> dict:
    validate_size(len(content), settings.max_upload_mb)
    df = read_table(content, filename)
    validate_schema(df, target)
    info = inspect(df, target)
    ds = Dataset(user_id=user.id, filename=filename, row_count=info["row_count"],
                 column_schema=info["columns"], target_column=target, inspection=info,
                 fingerprint=fingerprint(df))
    db.add(ds)
    db.flush()
    os.makedirs(settings.upload_dir, exist_ok=True)
    ds.file_path = os.path.join(settings.upload_dir, f"dataset_{ds.id}.csv")
    df.to_csv(ds.file_path, index=False)
    db.commit()
    return dataset_out(ds, detail=True)


def list_datasets(db: Session) -> list:
    return [dataset_out(d) for d in db.scalars(select(Dataset).order_by(Dataset.id.desc()))]


def load_frame(ds: Dataset) -> pd.DataFrame:
    return pd.read_csv(ds.file_path)
