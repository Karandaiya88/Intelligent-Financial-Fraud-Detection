import numpy as np
from app.data.splitting import split_data
from app.ml.pipelines import build_pipeline


def test_split_is_stratified_and_disjoint(df):
    sp = split_data(df, seed=1)
    rate = df["Class"].mean()
    for y in (sp.y_train, sp.y_val, sp.y_test):
        assert abs(y.mean() - rate) < 0.01
    assert not (set(sp.X_train.index) & set(sp.X_test.index))
    assert not (set(sp.X_train.index) & set(sp.X_val.index))
    assert not (set(sp.X_val.index) & set(sp.X_test.index))
    assert len(sp.X_train) + len(sp.X_val) + len(sp.X_test) == len(df)


def test_split_reproducible(df):
    a, b = split_data(df, seed=3), split_data(df, seed=3)
    assert a.X_test.index.equals(b.X_test.index)


def test_scaler_fit_on_train_only(df):
    sp = split_data(df, seed=1)
    pipe = build_pipeline("logistic_regression").fit(sp.X_train, sp.y_train)
    scaler = pipe.named_steps["scale"]
    assert np.allclose(scaler.mean_, sp.X_train.mean().values)
    all_mean = np.vstack([sp.X_train, sp.X_test]).mean(axis=0)
    assert not np.allclose(scaler.mean_, all_mean)
