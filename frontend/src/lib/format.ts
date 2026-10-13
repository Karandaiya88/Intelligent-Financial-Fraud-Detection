export const num = (v: number | null | undefined, digits = 3): string =>
  v === null || v === undefined || Number.isNaN(v) ? "–" : v.toFixed(digits);

export const pct = (v: number | null | undefined, digits = 2): string =>
  v === null || v === undefined ? "–" : `${(v * 100).toFixed(digits)}%`;

export const int = (v: number | null | undefined): string =>
  v === null || v === undefined ? "–" : v.toLocaleString("en-US");

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export const MODEL_LABELS: Record<string, string> = {
  logistic_regression: "Logistic Regression",
  decision_tree: "Decision Tree",
  random_forest: "Random Forest",
  svm: "SVM",
  naive_bayes: "Naive Bayes",
};

export const MODEL_ROLES: Record<string, string> = {
  logistic_regression: "Baseline classifier",
  decision_tree: "Interpretable classifier (depth-limited)",
  random_forest: "Primary candidate",
  svm: "Comparison classifier (trained on a stratified sample)",
  naive_bayes: "Benchmark classifier",
};

export const ULB_FEATURES = ["Time", ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`), "Amount"];
