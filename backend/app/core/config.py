"""Central, environment-driven settings (no secrets in code)."""
from __future__ import annotations
import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Settings:
    random_seed: int = int(os.getenv("RANDOM_SEED", "42"))
    test_size: float = 0.2
    val_size: float = 0.2
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "100"))
    allowed_extensions: tuple = tuple(
        "." + e.strip() for e in os.getenv("ALLOWED_EXTENSIONS", "csv,xlsx").split(",")
    )
    model_dir: str = os.getenv("MODEL_DIR", "./artifacts/models")
    target_column: str = "Class"
    svm_max_train: int = 20000  # documented SVM sample cap (training-cost risk)


settings = Settings()
