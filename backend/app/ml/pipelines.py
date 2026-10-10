"""Model registry. Preprocessing lives INSIDE the Pipeline so it is fitted on training data only
and is saved/reloaded together with the model (no train/serve drift)."""
from __future__ import annotations
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.naive_bayes import GaussianNB

MODEL_NAMES = ["logistic_regression", "decision_tree", "random_forest", "svm", "naive_bayes"]

ROLES = {
    "logistic_regression": "Baseline supervised classifier",
    "decision_tree": "Interpretable classifier (depth-limited)",
    "random_forest": "Primary candidate classifier",
    "svm": "Comparison classifier (trained on documented sample)",
    "naive_bayes": "Benchmark classifier",
}


def _classifier(name: str, seed: int):
    if name == "logistic_regression":
        return LogisticRegression(class_weight="balanced", max_iter=1000, random_state=seed)
    if name == "decision_tree":
        return DecisionTreeClassifier(max_depth=6, class_weight="balanced", random_state=seed)
    if name == "random_forest":
        return RandomForestClassifier(n_estimators=200, class_weight="balanced_subsample",
                                      n_jobs=-1, random_state=seed)
    if name == "svm":
        # probability=True -> Platt scaling, so every model exposes fraud_probability
        return SVC(kernel="rbf", class_weight="balanced", probability=True, random_state=seed)
    if name == "naive_bayes":
        return GaussianNB()
    raise ValueError(f"Unknown model '{name}'. Choose from {MODEL_NAMES}")


def build_pipeline(name: str, seed: int = 42) -> Pipeline:
    return Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("clf", _classifier(name, seed)),
    ])
