export type Risk = "LOW" | "MEDIUM" | "HIGH";
export type ModelName = "logistic_regression" | "decision_tree" | "random_forest" | "svm" | "naive_bayes";

export interface Metrics {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  pr_auc: number | null;
  roc_auc: number | null;
  confusion_matrix: number[][];
  class_counts: Record<string, number>;
  false_positives: number;
  false_negatives: number;
}

export interface RiskPolicy {
  t_medium: number;
  t_high: number;
}

export interface ModelRun {
  model_run_id: number;
  dataset_id: number;
  model_name: ModelName;
  model_version: string;
  is_best: boolean;
  created_at: string;
  config: Record<string, any>;
  metrics: { validation: Metrics; test: Metrics; train_seconds: number; train_rows: number };
  risk_policy: RiskPolicy | null;
}

export interface Inspection {
  row_count?: number;
  column_count?: number;
  columns?: Record<string, string>;
  missing_values: Record<string, number>;
  duplicates: number;
  class_balance: Record<string, number>;
  fraud_rate: number;
  preview?: Record<string, number | string | null>[];
}

export interface Dataset {
  id: number;
  filename: string;
  row_count: number;
  target_column: string;
  column_schema: Record<string, string>;
  uploaded_at: string;
  fingerprint: string;
  inspection: Inspection;
}

export interface Signal {
  feature: string;
  value: number | null;
  z_score: number;
  contribution?: number;
}

export interface Explanation {
  method: string;
  note: string;
  top_features: Signal[];
}

export interface Prediction {
  id: number;
  model_run_id: number;
  transaction_reference: string;
  fraud_probability: number;
  predicted_label: number;
  anomaly_score: number | null;
  is_anomaly: boolean | null;
  risk_level: Risk;
  created_at: string;
  features?: Record<string, number | null>;
  explanation?: Explanation;
  disclaimer?: string;
}

export interface PredictionPage {
  total: number;
  limit: number;
  offset: number;
  items: Prediction[];
}

export interface BulkResult {
  model_run_id: number;
  total: number;
  risk_distribution: Record<Risk, number>;
  predicted_fraud: number;
  anomalies: number;
  disclaimer: string;
  preview: Prediction[];
}

export interface DashboardSummary {
  datasets: number;
  model_runs: number;
  latest_dataset: { id: number; filename: string; row_count: number; class_balance: Record<string, number>; fraud_rate: number } | null;
  transactions_scored: number;
  risk_distribution: Record<Risk, number>;
  predicted_fraud: number;
  anomalies: number;
  model_status: { trained: boolean; best_model_run_id: number | null; best_model: string | null };
  model_metrics: { model_run_id: number; model: string; is_best: boolean; precision: number; recall: number; f1: number; pr_auc: number | null; roc_auc: number | null }[];
  disclaimer: string;
}

export interface ReportItem {
  id: number;
  report_type: string;
  filename: string;
  generated_at: string;
  download_url: string;
}

export interface TrainResponse {
  status: string;
  run_ids: number[];
  best_model_run_id: number | null;
  runs: ModelRun[];
}
