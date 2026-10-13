# Backend: Fraud Detection API

FastAPI service + scikit-learn ML pipeline + PostgreSQL persistence for the
**Intelligent Financial Fraud Detection Platform** (academic decision-support prototype).

## Layout

```text
backend/
├── app/
│   ├── main.py            # FastAPI app, error handling, CORS, startup (tables + analyst account)
│   ├── schemas.py         # request bodies
│   ├── api/               # thin routers: auth, datasets, models, fraud, dashboard, reports
│   ├── services/          # business logic (datasets, training, scoring, reports, dashboard)
│   ├── data/              # upload validation, inspection, stratified splitting
│   ├── ml/                # pipelines, evaluation, threshold/risk policy, anomaly, clustering, predict
│   ├── db/                # SQLAlchemy models + session
│   └── core/              # settings (env), security (bcrypt + JWT)
├── scripts/               # train_compare CLI, synthetic data, create_user
├── tests/                 # 43 tests (ML + API)
├── Dockerfile
├── requirements.txt
└── .env.example
```

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # edit values; export them or use your shell/IDE
uvicorn app.main:app --reload                          # http://localhost:8000/docs
```

Tables are created automatically on startup. The single analyst account is created from
`ADMIN_USERNAME` / `ADMIN_PASSWORD` on first start, or with `python -m scripts.create_user`.
For quick local runs without PostgreSQL, set `DATABASE_URL=sqlite:///./fraud.db`.

## Typical flow

1. `POST /api/auth/login` → bearer token
2. `POST /api/datasets/upload` (CSV/Excel with `Time, V1..V28, Amount, Class`)
3. `POST /api/models/train` → compares the selected models; Isolation Forest is trained separately
4. `GET /api/models/{id}/metrics`
5. `POST /api/fraud/predict` or `/api/fraud/bulk-predict`
6. `GET /api/dashboard/summary`, `GET /api/fraud/predictions`
7. `POST /api/reports/generate` → `GET /api/reports/{id}/download`

## Tests

```bash
python -m pytest -q
```

## Notes

- Test data is **synthetic**; use the real Kaggle ULB `creditcard.csv` for actual results.
- SVM trains on a documented stratified sample (`svm_max_train`, default 20,000 rows).
- Risk bands (LOW/MEDIUM/HIGH) are configurable per model run: `PUT /api/models/{id}/policy`.
- Explanations are lightweight feature signals (standardized deviation / linear contribution),
  not SHAP. Features are anonymized, so no merchant/device/location claims are made.
- Predictions are model estimates for decision support, not proof of fraud.
