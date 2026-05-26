# MyWarden — Employee Management System

A web-based Employee Management System for mid-size companies (50–500 employees).
Built with FastAPI, React, PostgreSQL, and face recognition powered by DeepFace.

---

## Features

- **Authentication** — JWT-based login with role-based access control
- **Employee Master** — full employee profiles with department and role management
- **Attendance** — face recognition check-in/check-out with WebRTC camera kiosk
- **Leave Management** — apply, approve, and track leave requests
- **Payroll Engine** — supports fixed, hourly, and contract employees with configurable deductions
- **Reports** — attendance summaries and payslip PDF generation
- **Self-Service Portal** — employees can view their own payslips, attendance, and apply for leave

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.x (async) |
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| Database | PostgreSQL 15 with pgvector |
| Face Recognition | DeepFace + TensorFlow (Facenet512) |
| Task Queue | Celery + Redis (Phase 3+) |
| Object Storage | AWS S3 / MinIO (local dev) |
| Auth | JWT (python-jose), bcrypt |
| PDF | WeasyPrint |

---

## Project Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — scaffold, auth, employee master, face enrollment | Not started |
| 2 | Attendance & leave — face check-in, shift, leave module | Not started |
| 3 | Payroll — salary engine, deductions, payslips | Not started |
| 4 | Reports, self-service portal, notifications, onboarding | Not started |

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15 with pgvector extension
- Docker Desktop *(optional — for the Docker-based setup)*

---

## Running Locally

### Option A — Docker Compose (recommended)

```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env: set a strong SECRET_KEY

# 2. Start all services
docker compose up --build

# 3. Run database migrations (in a second terminal)
docker compose exec api alembic upgrade head
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |
| MinIO Console | http://localhost:9001 |

---

### Option B — Without Docker (bare metal)

**1. Set up PostgreSQL**

Install PostgreSQL 15, then create the database:

```sql
CREATE USER mywarden WITH PASSWORD 'mywarden';
CREATE DATABASE mywarden OWNER mywarden;
\c mywarden
CREATE EXTENSION IF NOT EXISTS vector;
```

**2. Configure environment**

```bash
cp .env.example .env
```

Edit `.env`:
```
DATABASE_URL=postgresql+asyncpg://mywarden:mywarden@localhost:5432/mywarden
SECRET_KEY=your-random-secret-key-at-least-32-chars
S3_ENDPOINT_URL=        # leave blank to skip MinIO for now
```

**3. Backend**

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**4. Frontend** *(open a second terminal)*

```bash
cd frontend
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Frontend | http://localhost:5173 |

> **Tip:** Redis, MinIO, and TensorFlow/DeepFace are not required for Phase 1. You can comment them out of `requirements.txt` to speed up the initial install.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async connection string |
| `SECRET_KEY` | JWT signing key — generate with `openssl rand -hex 32` |
| `REDIS_URL` | Redis connection (Phase 3+) |
| `AWS_ACCESS_KEY_ID` | AWS or MinIO access key |
| `AWS_SECRET_ACCESS_KEY` | AWS or MinIO secret key |
| `S3_BUCKET_NAME` | Bucket for face enrollment photos |
| `S3_ENDPOINT_URL` | Set to MinIO URL for local dev; leave blank for real AWS |
| `DEEPFACE_MODEL` | Face recognition model (default: `Facenet512`) |
| `FACE_MATCH_THRESHOLD` | Cosine similarity threshold (default: `0.80`) |

---

## Repository Structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── config.py        # Settings (pydantic-settings)
│   │   ├── database.py      # Async SQLAlchemy engine + session
│   │   ├── api/v1/          # Route handlers
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic
│   │   └── utils/           # Auth, storage, PDF helpers
│   ├── workers/             # Celery tasks (Phase 3+)
│   ├── migrations/          # Alembic migrations
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── pages/           # Route-level React components
│   │   ├── components/      # Reusable UI components
│   │   ├── api/             # Axios service layer
│   │   ├── store/           # Zustand global state
│   │   └── lib/             # Axios instance with JWT interceptor
│   └── public/
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                # Project blueprint and conventions
```

---

## API Overview

All routes are prefixed `/api/v1/`. Protected routes require `Authorization: Bearer <token>`.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/employees` | List employees |
| POST | `/api/v1/employees` | Create employee |
| GET | `/api/v1/attendance-logs` | List attendance records |
| POST | `/api/v1/attendance-logs` | Record check-in/out |
| GET | `/api/v1/payroll-runs` | List payroll runs |
| GET | `/api/v1/leave` | List leave requests |
| POST | `/api/v1/leave` | Submit leave request |
| GET | `/health` | Health check |

Full interactive docs available at **http://localhost:8000/docs**.

---

## Roles & Permissions

| Role | Access |
|------|--------|
| `super_admin` | Full system access including config |
| `hr_admin` | All employee, attendance, payroll, leave operations |
| `manager` | View and approve for their department only |
| `employee` | Own payslips, attendance, leave |

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

---

## Deployment

The production target is **Railway** (API) + **Vercel** (frontend) + **Supabase** (PostgreSQL).

1. Push to `main` branch on GitHub
2. Railway auto-builds from `backend/Dockerfile` (~2 min)
3. Vercel auto-deploys the frontend
4. Set all environment variables in the Railway and Vercel dashboards

Estimated production cost: ~$5–15/month.
