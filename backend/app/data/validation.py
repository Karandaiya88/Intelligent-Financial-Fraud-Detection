"""Upload + schema validation (FR-02). Errors carry a stable code for the API."""
from __future__ import annotations
import io
import os
from typing import Iterable, Optional

import pandas as pd

ULB_FEATURES = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]


class ValidationError(Exception):
    def __init__(self, code: str, message: str, details: Optional[dict] = None):
        super().__init__(message)
        self.code, self.message, self.details = code, message, details or {}

    def to_dict(self) -> dict:
        return {"error": {"code": self.code, "message": self.message, "details": self.details}}


def validate_extension(filename: str, allowed: Iterable[str] = (".csv", ".xlsx")) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in set(allowed):
        raise ValidationError("INVALID_FILE_TYPE", f"Unsupported file type '{ext}'.", {"allowed": sorted(allowed)})
    return ext


def validate_size(n_bytes: int, max_mb: int) -> None:
    if n_bytes > max_mb * 1024 * 1024:
        raise ValidationError("FILE_TOO_LARGE", f"File exceeds {max_mb} MB limit.", {"max_mb": max_mb})


def read_table(content: bytes, filename: str) -> pd.DataFrame:
    ext = validate_extension(filename, (".csv", ".xlsx", ".xls"))
    if not content:
        raise ValidationError("EMPTY_FILE", "The uploaded file is empty.")
    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except pd.errors.EmptyDataError:
        raise ValidationError("EMPTY_FILE", "The uploaded file has no data.")
    except Exception as exc:  # unreadable / corrupt file
        raise ValidationError("UNREADABLE_FILE", f"Could not parse file: {exc}")
    return df


def validate_schema(df: pd.DataFrame, target: str = "Class",
                    required: Optional[list] = None) -> None:
    """Required columns, numeric dtypes, binary target."""
    if df is None or df.empty:
        raise ValidationError("EMPTY_FILE", "Dataset has no rows.")
    required = (ULB_FEATURES if required is None else required) + [target]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValidationError("MISSING_COLUMNS", f"Required columns missing: {missing}", {"missing": missing})
    bad = [c for c in required if not pd.api.types.is_numeric_dtype(df[c])]
    if bad:
        raise ValidationError("SCHEMA_MISMATCH", f"Non-numeric columns: {bad}", {"columns": bad})
    values = set(df[target].dropna().unique().tolist())
    if not values <= {0, 1} or df[target].isna().any():
        raise ValidationError("INVALID_TARGET", f"Target '{target}' must contain only 0/1 values.",
                              {"found": sorted(map(str, values))})
    if len(values) < 2:
        raise ValidationError("SINGLE_CLASS", "Target contains a single class; cannot train.")
