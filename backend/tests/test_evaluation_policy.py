import numpy as np
import pytest
from app.ml.evaluation import evaluate
from app.ml.policy import RiskPolicy, select_threshold


def test_metrics_match_hand_calculation():
    y = [0, 0, 0, 0, 1, 1, 1, 0]
    s = [0.1, 0.2, 0.7, 0.3, 0.9, 0.6, 0.2, 0.1]
    m = evaluate(y, s, 0.5)
    # preds: 0 0 1 0 1 1 0 0 -> TP=2 FP=1 FN=1 TN=4
    assert m["confusion_matrix"] == [[4, 1], [1, 2]]
    assert m["precision"] == pytest.approx(2 / 3)
    assert m["recall"] == pytest.approx(2 / 3)
    assert m["f1"] == pytest.approx(2 / 3)
    assert m["class_counts"] == {"0": 5, "1": 3}


def test_accuracy_trap_is_visible():
    y = np.array([0] * 998 + [1] * 2)
    m = evaluate(y, np.zeros(1000), 0.5)
    assert m["recall"] == 0.0 and m["false_negatives"] == 2   # 99.8% 'accurate', catches nothing


def test_threshold_in_range_and_max_f1():
    y = [0, 0, 0, 1, 1, 0, 1, 0]
    s = [0.1, 0.2, 0.3, 0.8, 0.7, 0.4, 0.9, 0.35]
    t = select_threshold(y, s)
    assert 0.0 <= t <= 1.0
    assert evaluate(y, s, t)["f1"] == pytest.approx(1.0)


def test_min_precision_strategy():
    y = [0, 0, 1, 1, 0, 1]
    s = [0.1, 0.5, 0.6, 0.9, 0.7, 0.8]
    t = select_threshold(y, s, "min_precision", min_precision=1.0)
    assert evaluate(y, s, t)["precision"] == 1.0


def test_risk_policy_bands_and_validation():
    p = RiskPolicy(t_medium=0.2, t_high=0.6)
    assert list(p.assign([0.05, 0.2, 0.59, 0.6, 0.99])) == ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]
    with pytest.raises(ValueError):
        RiskPolicy(0.8, 0.3)
