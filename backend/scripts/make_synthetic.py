"""Generate SYNTHETIC data with the ULB schema (Time, V1-V28, Amount, Class).
For tests/demos only. It is NOT real transaction data and results on it mean nothing."""
import argparse
import numpy as np
import pandas as pd
from sklearn.datasets import make_classification


def make_synthetic(n=20000, fraud_rate=0.02, seed=42) -> pd.DataFrame:
    X, y = make_classification(n_samples=n, n_features=28, n_informative=10, n_redundant=4,
                               weights=[1 - fraud_rate, fraud_rate], class_sep=1.2,
                               flip_y=0.0, random_state=seed)
    rng = np.random.default_rng(seed)
    df = pd.DataFrame(X, columns=[f"V{i}" for i in range(1, 29)])
    df.insert(0, "Time", np.sort(rng.uniform(0, 172800, n)))
    df["Amount"] = rng.lognormal(3.0, 1.2, n).round(2)
    df["Class"] = y
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=20000)
    ap.add_argument("--fraud-rate", type=float, default=0.02)
    ap.add_argument("--out", default="data/synthetic.csv")
    a = ap.parse_args()
    import os; os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    make_synthetic(a.rows, a.fraud_rate).to_csv(a.out, index=False)
    print(f"wrote {a.out}")
