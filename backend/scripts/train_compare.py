"""CLI: train + compare models on a CSV, save artifacts.
Usage: python -m scripts.train_compare --data path/creditcard.csv --out artifacts/models"""
import argparse
import pandas as pd

from app.core.config import settings
from app.data.inspection import inspect
from app.data.validation import ValidationError, validate_schema
from app.ml.pipelines import MODEL_NAMES
from app.ml.training import save_run, train_and_compare


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default=settings.model_dir)
    ap.add_argument("--models", nargs="+", default=MODEL_NAMES, choices=MODEL_NAMES)
    ap.add_argument("--seed", type=int, default=settings.random_seed)
    a = ap.parse_args()

    df = pd.read_csv(a.data)
    try:
        validate_schema(df, settings.target_column)
    except ValidationError as e:
        raise SystemExit(f"[{e.code}] {e.message}")
    info = inspect(df, settings.target_column)
    print(f"rows={info['row_count']}  class_balance={info['class_balance']}  "
          f"fraud_rate={info['fraud_rate']:.4%}  duplicates={info['duplicates']}")

    run = train_and_compare(df, settings.target_column, a.models, seed=a.seed,
                            svm_max_train=settings.svm_max_train)
    pd.set_option("display.width", 200)
    print(run.comparison_table().round(4).to_string())
    print("best on validation PR-AUC:", run.best_model())
    print("saved to", save_run(run, a.out))


if __name__ == "__main__":
    main()
