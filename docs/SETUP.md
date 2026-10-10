# ⚙️ Setup & Deployment

> Part of the [Intelligent Financial Fraud Detection Platform](../README.md) documentation.

> Commands and file names are a **recommended starting point**; adjust them to the final project layout.

## Prerequisites

| Tool | Version (suggested) | Purpose |
|---|---|---|
| Python | 3.11+ | Backend and ML |
| Node.js | 20 LTS+ | Next.js frontend |
| PostgreSQL | 15+ | Persistence |
| Git | any recent | Version control |
| Docker + Compose | optional | Repeatable packaging |
| Kaggle account | n/a | Download the ULB dataset |

## Environment Variables

Create `.env` from `.env.example`. **Never commit `.env`.**

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://user:pass@localhost:5432/frauddb` | SQLAlchemy connection |
| `SECRET_KEY` | *(long random string)* | Token signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Session length |
| `MAX_UPLOAD_MB` | `100` | Upload size limit |
| `ALLOWED_EXTENSIONS` | `csv,xlsx` | Upload validation |
| `MODEL_DIR` | `./artifacts/models` | Saved pipelines |
| `RANDOM_SEED` | `42` | Reproducibility |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend → API |

## Local Development

```mermaid
flowchart LR
    A[Clone repo] --> B[Create .env]
    B --> C[Start PostgreSQL]
    C --> D[Install backend deps]
    D --> E[Run migrations]
    E --> F[Start FastAPI]
    F --> G[Install frontend deps]
    G --> H[Start Next.js]
    H --> I[Open localhost:3000]
```

```bash
# 1. Database (example using Docker)
docker run --name fraud-db -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=frauddb -p 5432:5432 -d postgres:15

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

| Service | URL |
|---|---|
| Frontend | <http://localhost:3000> |
| API | <http://localhost:8000> |
| API docs | <http://localhost:8000/docs> |

## Dataset Download

1. Sign in to Kaggle and accept the dataset terms.
2. Download from <https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud>.
3. Upload `creditcard.csv` through **Dataset Management** (or use it in the notebooks).

## Suggested `requirements.txt`

```text
fastapi
uvicorn[standard]
pandas
numpy
scikit-learn
joblib
sqlalchemy
alembic
psycopg[binary]
python-multipart
passlib[bcrypt]
python-jose[cryptography]
openpyxl
XlsxWriter
shap        # optional
pytest
```

Pin exact versions once the environment is working, and record them for reproducibility.

## Docker (optional)

```yaml
# docker-compose.yml (illustrative)
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: frauddb
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
  api:
    build: ./backend
    env_file: .env
    depends_on: [db]
    ports: ["8000:8000"]
  web:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on: [api]
    ports: ["3000:3000"]
volumes:
  pgdata:
```

```mermaid
flowchart LR
    Browser --> web[web :3000]
    web --> api[api :8000]
    api --> db[(db :5432)]
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `connection refused` on DB | PostgreSQL not running / wrong URL | Check container and `DATABASE_URL` |
| 401 on every call | Missing/expired token | Log in again |
| Upload rejected | Extension, size or columns | Read the error message; check schema |
| SVM training very slow | Full dataset size | Use the documented sample/config |
| CORS error in browser | API not allowing frontend origin | Configure allowed origins in FastAPI |
