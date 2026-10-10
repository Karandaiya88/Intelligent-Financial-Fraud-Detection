"""Stratified train / validation / test split. Test stays isolated until final report."""
from __future__ import annotations
from dataclasses import dataclass

import pandas as pd
from sklearn.model_selection import train_test_split

from .validation import ValidationError


@dataclass
class Splits:
    X_train: pd.DataFrame
    X_val: pd.DataFrame
    X_test: pd.DataFrame
    y_train: pd.Series
    y_val: pd.Series
    y_test: pd.Series
    seed: int

    def class_counts(self) -> dict:
        f = lambda y: {str(k): int(v) for k, v in y.value_counts().sort_index().items()}
        return {"train": f(self.y_train), "val": f(self.y_val), "test": f(self.y_test)}


def split_data(df: pd.DataFrame, target: str = "Class", seed: int = 42,
               test_size: float = 0.2, val_size: float = 0.2) -> Splits:
    X, y = df.drop(columns=[target]), df[target].astype(int)
    try:
        X_tmp, X_test, y_tmp, y_test = train_test_split(
            X, y, test_size=test_size, stratify=y, random_state=seed)
        X_train, X_val, y_train, y_val = train_test_split(
            X_tmp, y_tmp, test_size=val_size / (1 - test_size), stratify=y_tmp, random_state=seed)
    except ValueError as exc:
        raise ValidationError("INSUFFICIENT_CLASS_SAMPLES",
                              f"Too few samples per class for a stratified 3-way split: {exc}")
    return Splits(X_train, X_val, X_test, y_train, y_val, y_test, seed)
