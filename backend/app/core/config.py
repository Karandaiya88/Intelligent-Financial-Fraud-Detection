from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")  # backend/.env
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    random_seed: int = int(os.getenv("RANDOM_SEED", "42"))
    test_size: float = 0.2
    val_size: float = 0.2
    target_column: str = "Class"
    svm_max_train: int = 20000  # documented SVM sample cap (training-cost risk)

    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "100"))
    max_bulk_rows: int = int(os.getenv("MAX_BULK_ROWS", "50000"))
    allowed_extensions: tuple = tuple(
        "." + e.strip() for e in os.getenv("ALLOWED_EXTENSIONS", "csv,xlsx").split(","))

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./fraud.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-only-change-me")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    admin_username: str = os.getenv("ADMIN_USERNAME", "")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "")
    admin_email: str = os.getenv("ADMIN_EMAIL", "")
    cors_origins: tuple = tuple(
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip())
    artifacts_dir: str = os.getenv("ARTIFACTS_DIR", "./artifacts")

    @property
    def upload_dir(self) -> str:
        return os.path.join(self.artifacts_dir, "uploads")

    @property
    def model_dir(self) -> str:
        return os.path.join(self.artifacts_dir, "models")

    @property
    def report_dir(self) -> str:
        return os.path.join(self.artifacts_dir, "reports")


settings = Settings()
