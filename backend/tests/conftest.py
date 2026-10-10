import pytest
from scripts.make_synthetic import make_synthetic


@pytest.fixture(scope="session")
def df():
    return make_synthetic(n=4000, fraud_rate=0.05, seed=7)
