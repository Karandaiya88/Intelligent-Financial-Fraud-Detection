# 🏗️ System Architecture

> Part of the [Intelligent Financial Fraud Detection Platform](../README.md) documentation.

**Contents:** [Overview](#overview) · [Components](#components) · [Data flow](#data-flow) · [Prediction sequence](#prediction-sequence) · [Training sequence](#training-sequence) · [Module boundaries](#module-boundaries) · [Design decisions](#design-decisions) · [Security](#security)

---

## Overview

A single-user web application: a **Next.js** dashboard talks to a **FastAPI** backend over REST/JSON. The backend validates data, runs the scikit-learn pipeline, applies a threshold policy, and persists results to **PostgreSQL**.

<div align="center">
<img src="../assets/architecture.svg" alt="System architecture" width="85%"/>
</div>

## Components

| Component | Responsibility | Technology |
|---|---|---|
| Dashboard | Forms, tables, charts, investigation views | Next.js, TypeScript, Tailwind, Recharts |
| API layer | Auth, routing, request validation, error mapping | FastAPI |
| Data layer | Schema validation, cleaning, feature preparation | Pandas, NumPy |
| ML layer | Training, evaluation, prediction, clustering, anomaly detection | scikit-learn |
| Policy layer | Threshold policy and risk bands (LOW / MEDIUM / HIGH) | Python module, configurable |
| Explanation layer | Feature-contribution signals where supported | SHAP *(optional)* |
| Persistence | Dataset metadata, model runs, predictions, reports | PostgreSQL, SQLAlchemy |
| Export | CSV / Excel reports | XlsxWriter / openpyxl |

## Data Flow

```mermaid
flowchart LR
    U([Analyst]) --> UI[Next.js Dashboard]
    UI -- REST/JSON --> API[FastAPI]
    API --> V[Validation & Processing]
    V --> ML[ML Pipeline]
    ML --> P[Threshold Policy]
    P --> E[Explanations]
    API --> DB[(PostgreSQL)]
    ML --> DB
    P --> DB
    DB --> R[Report Export]
    R --> UI
    classDef box fill:#ecfdf5,stroke:#059669,color:#064e3b;
    class V,ML,P,E box;
```

## Prediction Sequence

```mermaid
sequenceDiagram
    autonumber
    actor A as Analyst
    participant UI as Next.js
    participant API as FastAPI
    participant PL as Saved Pipeline
    participant POL as Threshold Policy
    participant DB as PostgreSQL

    A->>UI: Submit transaction(s)
    UI->>API: POST /api/fraud/predict (or bulk-predict)
    API->>API: Validate schema against selected dataset
    API->>PL: Load model + preprocessing (same artifact as training)
    PL-->>API: fraud_probability, predicted_label
    API->>POL: Map probability to risk band
    POL-->>API: risk_level
    API->>DB: Store prediction + model_run reference
    API-->>UI: JSON result (probability, label, anomaly_score, risk_level)
    UI-->>A: Render in Transaction Analysis view
```

## Training Sequence

```mermaid
sequenceDiagram
    autonumber
    actor A as Analyst
    participant API as FastAPI
    participant DATA as Data Layer
    participant ML as ML Layer
    participant DB as PostgreSQL

    A->>API: POST /api/models/train {dataset_id, models[], config}
    API->>DATA: Load dataset + validate target column
    DATA->>DATA: Stratified train / validation / test split (seeded)
    DATA-->>ML: Train + validation sets (test isolated)
    loop each selected model
        ML->>ML: Fit Pipeline(preprocess → classifier) on train only
        ML->>ML: Tune + select threshold on validation
    end
    ML-->>API: Metrics, model artifacts, version
    API->>DB: Save model_runs (config, metrics_json, seed, version)
    API-->>A: Run ID + summary
```

## Module Boundaries

The PRD requires UI, API, data processing and ML training code to stay in **separate modules**.

```mermaid
flowchart TB
    subgraph Frontend
      F1[pages / routes]
      F2[components]
      F3[API client]
    end
    subgraph Backend
      B1[api/ routers]
      B2[data/ validation + preprocessing]
      B3[ml/ train · evaluate · anomaly · policy]
      B4[db/ models + sessions]
      B5[reports/ exporters]
    end
    F3 --> B1
    B1 --> B2 --> B3
    B1 --> B4
    B3 --> B4
    B4 --> B5
```

Rules of thumb:

- Routers contain **no ML logic**; they call services.
- ML code has **no HTTP or database imports** (keeps it testable in notebooks).
- Preprocessing lives **inside** the persisted scikit-learn `Pipeline`, so training and serving cannot drift.

## Design Decisions

| Decision | Rationale |
|---|---|
| Separate supervised and anomaly outputs | An anomaly is not a fraud label; mixing them would overclaim |
| Persist the full pipeline (preprocess + model) | Guarantees identical transforms at prediction time; supports reload-consistency tests |
| Configurable risk thresholds | Risk bands are application-level categories, not financial standards |
| Record seed, config, dataset version per run | Reproducibility requirement |
| Single user role | Initial scope excludes customer, admin and manager roles |

## Security

- Hash passwords (e.g. bcrypt/argon2); never store plaintext.
- Validate upload extension, size, columns and dtypes before processing.
- Keep secrets in **environment variables**, never in source control.
- Avoid exposing raw sensitive data; store only what the schema needs.
- Protect all non-login endpoints with token/session authentication.
