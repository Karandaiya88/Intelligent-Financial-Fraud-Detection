"""K-Means exploratory segmentation. Clusters are NOT fraud labels."""
from __future__ import annotations
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def fit_kmeans(X_train, k: int = 4, seed: int = 42) -> Pipeline:
    return Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("kmeans", KMeans(n_clusters=k, n_init=10, random_state=seed)),
    ]).fit(X_train)


def cluster_summary(model: Pipeline, X, y=None) -> pd.DataFrame:
    """Cluster sizes (and observed label mix if labels are given, for exploration only)."""
    labels = model.predict(X)
    out = pd.DataFrame({"cluster": labels})
    if y is not None:
        out["label"] = list(y)
        return out.groupby("cluster").agg(size=("label", "size"), labeled_fraud=("label", "sum"))
    return out.groupby("cluster").size().rename("size").to_frame()
