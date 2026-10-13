import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="fraud_test_")
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "ARTIFACTS_DIR": f"{_tmp}/artifacts",
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
    "ADMIN_USERNAME": "analyst",
    "ADMIN_PASSWORD": "S3cure-test-pass",
    "MAX_UPLOAD_MB": "5",
    "MAX_BULK_ROWS": "1000",
})

import pytest  # noqa: E402
from scripts.make_synthetic import make_synthetic  # noqa: E402


@pytest.fixture(scope="session")
def df():
    return make_synthetic(n=4000, fraud_rate=0.05, seed=7)
