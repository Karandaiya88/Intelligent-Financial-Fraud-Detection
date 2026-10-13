"""Dataset inspection summary (FR-03)."""
from __future__ import annotations
import hashlib
import pandas as pd


def _json_safe(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.astype(object).where(frame.notna(), None)


def inspect(df: pd.DataFrame, target: str = "Class", preview_rows: int = 5) -> dict:
    counts = df[target].value_counts().sort_index()
    n = len(df)
    return {
        "row_count": int(n),
        "column_count": int(df.shape[1]),
        "columns": {c: str(t) for c, t in df.dtypes.items()},
        "missing_values": {c: int(v) for c, v in df.isna().sum().items() if v > 0},
        "duplicates": int(df.duplicated().sum()),
        "class_balance": {str(k): int(v) for k, v in counts.items()},
        "fraud_rate": float(counts.get(1, 0) / n) if n else 0.0,
        "preview": _json_safe(df.head(preview_rows)).to_dict(orient="records"),
    }


def fingerprint(df: pd.DataFrame) -> str:
    """Deterministic content hash recorded with each model run (reproducibility)."""
    h = pd.util.hash_pandas_object(df, index=False).values
    return hashlib.sha256(h.tobytes() + ",".join(df.columns).encode()).hexdigest()
