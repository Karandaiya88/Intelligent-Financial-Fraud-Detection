# 🔌 API Reference

> Part of the [Intelligent Financial Fraud Detection Platform](../README.md) documentation.

Base URL (local): `http://localhost:8000` · Interactive docs: `/docs` (Swagger UI), `/redoc`

> Payloads below are **illustrative**. Final field names must match the implemented schema and the selected dataset.

## Endpoint Summary

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate the single user | Public |
| `POST` | `/api/datasets/upload` | Upload and validate CSV/Excel dataset | 🔒 |
| `GET` | `/api/datasets` | List uploaded dataset metadata | 🔒 |
| `POST` | `/api/models/train` | Train/evaluate selected models | 🔒 |
| `GET` | `/api/models/{id}/metrics` | Retrieve model evaluation results | 🔒 |
| `POST` | `/api/fraud/predict` | Predict a single transaction | 🔒 |
| `POST` | `/api/fraud/bulk-predict` | Score a batch of transactions | 🔒 |
| `GET` | `/api/dashboard/summary` | Aggregate dashboard metrics | 🔒 |
| `POST` | `/api/reports/generate` | Create an exportable report | 🔒 |

## Request Flow

```mermaid
flowchart LR
    A[Login] --> B[Upload dataset]
    B --> C[Train models]
    C --> D[View metrics]
    D --> E[Predict single / bulk]
    E --> F[Dashboard summary]
    F --> G[Generate report]
```

## Authentication

### `POST /api/auth/login`

```json
// Request
{ "username": "analyst", "password": "********" }
```
```json
// 200 Response
{ "access_token": "<token>", "token_type": "bearer" }
```

Send `Authorization: Bearer <token>` on all other endpoints.

## Datasets

### `POST /api/datasets/upload`

`multipart/form-data` with a `file` (CSV/Excel) and `target_column` (e.g. `Class`).

```json
// 201 Response
{
  "id": 1,
  "filename": "creditcard.csv",
  "row_count": 284807,
  "target_column": "Class",
  "column_schema": { "Time": "float64", "Amount": "float64", "Class": "int64" },
  "inspection": { "missing_values": 0, "duplicates": null, "class_balance": { "0": 284315, "1": 492 } }
}
```

### `GET /api/datasets`

Returns a list of dataset metadata objects.

## Models

### `POST /api/models/train`

```json
// Request
{
  "dataset_id": 1,
  "models": ["logistic_regression", "decision_tree", "random_forest"],
  "random_seed": 42,
  "config": { "test_size": 0.2, "class_weight": "balanced" }
}
```
```json
// 202 Response
{ "run_ids": [11, 12, 13], "status": "completed" }
```

### `GET /api/models/{id}/metrics`

```json
{
  "model_run_id": 13,
  "model_name": "random_forest",
  "model_version": "v1",
  "class_counts": { "train": {}, "test": {} },
  "metrics": { "precision": null, "recall": null, "f1": null, "roc_auc": null, "pr_auc": null },
  "confusion_matrix": [[0, 0], [0, 0]]
}
```
*(values are populated by the real run; `null` shown here as placeholders)*

## Prediction

### `POST /api/fraud/predict`

```json
// Request
{ "model_run_id": 13, "features": { "Time": 0, "V1": 0.0, "V2": 0.0, "Amount": 0.0 } }
```
```json
// 200 Response
{
  "transaction_reference": "txn-0001",
  "fraud_probability": 0.00,
  "predicted_label": 0,
  "anomaly_score": 0.00,
  "risk_level": "LOW",
  "disclaimer": "Model estimate for decision support, not proof of fraud."
}
```

### `POST /api/fraud/bulk-predict`

`multipart/form-data` with a CSV/Excel `file` and `model_run_id`. Returns the stored prediction batch summary and a link to results.

## Dashboard and Reports

### `GET /api/dashboard/summary`

Returns transaction counts, predicted-risk distribution, fraud labels (when available) and latest model metrics.

### `POST /api/reports/generate`

```json
{ "report_type": "model_comparison", "format": "xlsx", "model_run_ids": [11, 12, 13] }
```

## Error Format

Invalid files and missing columns must return **clear messages**.

```json
{
  "error": {
    "code": "MISSING_COLUMNS",
    "message": "Required columns missing: ['Amount']",
    "details": { "missing": ["Amount"] }
  }
}
```

| HTTP | Code | Typical cause |
|---|---|---|
| 400 | `INVALID_FILE_TYPE` | Extension not CSV/Excel |
| 400 | `EMPTY_FILE` | No rows |
| 413 | `FILE_TOO_LARGE` | Over size limit |
| 422 | `MISSING_COLUMNS` / `SCHEMA_MISMATCH` | Required columns absent or wrong dtypes |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 404 | `NOT_FOUND` | Unknown dataset or model run |
