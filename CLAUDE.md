# CLAUDE.md — Employee Management System

## What this project is
A web-based Employee Management System for a mid-size office company (50–500 employees).
Core modules: Attendance (face recognition), Payroll (fixed + hourly + contract), Leave, Self-service portal.
Built in phases. Read the current phase status below before writing any code.

---

## Current phase status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation — scaffold, auth, employee master, face enrollment | ✅ Complete |
| 2 | Attendance & leave — face check-in, shift, leave module | ✅ Complete |
| 3 | Payroll — salary engine, deductions, payslips | 🔲 Not started |
| 4 | Reports, self-service portal, notifications, onboarding | 🔲 Not started |

**Update this table as you complete phases.**

---

## Tech stack

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI (async)
- **ORM:** SQLAlchemy 2.x (async) with Alembic for migrations
- **Task queue:** Celery + Redis (payroll runs, report generation, notifications)
- **Face recognition:** DeepFace + TensorFlow (enrollment + matching)
- **Auth:** JWT (python-jose), bcrypt for password hashing
- **PDF generation:** WeasyPrint (payslips, reports)

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** TailwindCSS + shadcn/ui
- **State:** Zustand (global), React Query (server state)
- **Camera:** WebRTC via `react-webcam` (check-in kiosk)
- **HTTP:** Axios with interceptor for JWT refresh

### Database & storage
- **Primary DB:** PostgreSQL 15 with `pgvector` extension (face embeddings stored as vectors)
- **Cache / broker:** Redis
- **Object storage:** AWS S3 (raw enrollment photos only, not embeddings)
- **Hosted:** AWS RDS (Postgres) or GCP Cloud SQL — decide before Phase 1 deploy

### Cloud / infra
- **Target:** AWS or GCP (not yet decided — keep infrastructure code behind a config abstraction)
- **Containerisation:** Docker + Docker Compose for local dev; target Kubernetes or Cloud Run for prod
- **Secrets:** Environment variables via `.env` (never hardcode, never commit)
- **CI/CD:** GitHub Actions (to be set up in Phase 1)

---

## Repository structure

```
/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── config.py                # Settings (pydantic-settings)
│   │   ├── database.py              # Async SQLAlchemy engine + session
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── employees.py
│   │   │   │   ├── attendance.py
│   │   │   │   ├── payroll.py
│   │   │   │   ├── leave.py
│   │   │   │   └── reports.py
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── employee.py
│   │   │   ├── attendance.py
│   │   │   ├── payroll.py
│   │   │   └── leave.py
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   │   ├── employee.py
│   │   │   ├── attendance.py
│   │   │   ├── payroll.py
│   │   │   └── leave.py
│   │   ├── services/                # Business logic — keep fat, keep testable
│   │   │   ├── face_service.py      # DeepFace enrollment + matching
│   │   │   ├── payroll_service.py   # Salary computation engine
│   │   │   ├── attendance_service.py
│   │   │   └── leave_service.py
│   │   └── utils/
│   │       ├── auth.py              # JWT helpers
│   │       ├── storage.py           # S3 abstraction
│   │       └── pdf.py               # WeasyPrint helpers
│   ├── workers/
│   │   ├── celery_app.py
│   │   ├── payroll_tasks.py
│   │   └── notification_tasks.py
│   ├── migrations/                  # Alembic
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Employees.tsx
│   │   │   ├── Attendance.tsx
│   │   │   ├── Payroll.tsx
│   │   │   ├── Leave.tsx
│   │   │   └── CheckinKiosk.tsx     # Camera check-in UI (fullscreen)
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn primitives
│   │   │   └── app/                 # app-specific components
│   │   ├── api/                     # Axios service layer (one file per domain)
│   │   │   ├── employees.ts
│   │   │   ├── attendance.ts
│   │   │   └── payroll.ts
│   │   ├── store/                   # Zustand stores
│   │   └── lib/
│   │       └── axios.ts             # Axios instance with JWT interceptor
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml               # Local dev: api + frontend + postgres + redis
├── .env.example                     # All env vars documented, no real values
├── .github/
│   └── workflows/
│       └── ci.yml
└── CLAUDE.md                        # ← this file
```

---

## Naming conventions

### Python (backend)
- Files and modules: `snake_case`
- Classes: `PascalCase`
- Functions and variables: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Pydantic schemas: suffix with `Schema`, `CreateSchema`, `UpdateSchema`, `ResponseSchema`
  - e.g. `EmployeeCreateSchema`, `AttendanceResponseSchema`
- SQLAlchemy models: no suffix, singular noun — `Employee`, `AttendanceLog`, `PayrollRun`
- API routes: plural nouns — `/employees`, `/attendance-logs`, `/payroll-runs`

### TypeScript (frontend)
- Components: `PascalCase` files and exports
- Hooks: `useCamelCase`
- API functions: `camelCase` — `getEmployees()`, `submitCheckin()`
- Types/interfaces: `PascalCase` with `I` prefix for interfaces — `IEmployee`, `IAttendanceLog`

---

## Database conventions
- All tables use UUID primary keys (`uuid_generate_v4()`)
- Every table has `created_at` and `updated_at` timestamps (auto-managed)
- Soft deletes: use `is_active: bool` — never hard delete employee records
- Face embeddings: stored in `employees.face_embedding` as `vector(512)` using pgvector
- Raw enrollment photos: stored in S3, key pattern `enrollments/{employee_id}/{timestamp}.jpg`
- Foreign keys: always name as `{table_singular}_id` — e.g. `employee_id`, `department_id`

---

## API conventions
- All routes prefixed `/api/v1/`
- Auth: `Authorization: Bearer <token>` header on every protected route
- Responses always return `{ data: ..., message: "..." }` wrapper
- Errors always return `{ error: "...", detail: "..." }` with appropriate HTTP status
- Pagination: `?page=1&limit=20` on all list endpoints
- Date/time: always UTC in DB and API; frontend converts to IST for display

---

## Roles & permissions

| Role | Access |
|------|--------|
| `super_admin` | Everything including system config |
| `hr_admin` | All employee, attendance, payroll, leave operations |
| `manager` | View/approve attendance and leave for their department only |
| `employee` | Self-service: own payslips, own attendance, apply leave |

Implement role check as a FastAPI dependency: `Depends(require_role("hr_admin"))`.

---

## Face recognition specifics
- **Model:** DeepFace with `Facenet512` model (512-dim embeddings) — consistent with prior TF experience
- **Liveness:** Before matching, run a motion/blink check using TensorFlow (frame delta analysis)
- **Matching threshold:** Cosine similarity ≥ 0.80 = match (tune after testing on real faces)
- **Inference:** Run in a `BackgroundTask` or dedicated worker — never block the API response
- **Enrollment:** Capture 8–10 frames, average the embeddings, store the mean vector
- **Fallback:** If recognition fails 3 times → offer OTP fallback → flag for HR review

---

## Payroll engine rules
- Employee types: `FULL_TIME` (fixed monthly), `HOURLY` (attendance-linked), `CONTRACT` (milestone or daily rate)
- Salary computation runs as a Celery task triggered by HR
- Deduction rules are stored in a `deduction_rules` config table (not hardcoded) — makes statutory compliance pluggable
- Payroll states: `DRAFT → APPROVED → PROCESSED → PAID`
- Never overwrite a processed payroll run — create a new revision

---

## Environment variables (see .env.example)
```
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=...              # JWT signing key
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
DEEPFACE_MODEL=Facenet512
FACE_MATCH_THRESHOLD=0.80
```

---

## Deployment architecture

### Local development — Docker Compose
Run everything locally with a single `docker compose up`. Never touch the cloud during development.

| Service | Image | Notes |
|---------|-------|-------|
| `api` | `./backend/Dockerfile` | FastAPI, hot reload via volume mount |
| `db` | `pgvector/pgvector:pg15` | PostgreSQL with pgvector pre-installed |
| `minio` | `minio/minio` | Local S3 clone — same API, zero cost |

> **Redis + Celery added in Phase 3 only.** Use FastAPI `BackgroundTasks` for anything async in Phase 1 and 2.

### Production — Railway + Supabase
No VMs, no SSH, no server management. Git push → auto deploy.

| What | Where | Notes |
|------|-------|-------|
| FastAPI API | Railway service | Deploys from Dockerfile |
| React frontend | Vercel (free) | Connect GitHub repo, auto-deploys |
| PostgreSQL | Supabase (free tier) | pgvector enabled, 500 MB included |
| Face photos (S3) | AWS S3 | ~5 GB free first year |
| Redis + Celery worker | Railway (Phase 3 only) | Add when building payroll engine |

**Estimated production cost: ~$5–15/month** depending on Railway usage.

### How to deploy
1. Push to `main` branch on GitHub
2. Railway picks up the change and rebuilds the Docker image (~2 min)
3. Zero-downtime swap to the new container
4. Check logs in Railway dashboard if anything fails

### Environment variables are the only thing that changes between environments
- Local: values in `.env` file (never committed)
- Production: set in Railway dashboard and Vercel dashboard
- Code never references environment names — only reads `os.getenv("DATABASE_URL")` etc.

---

## How to work with Claude Code on this project

1. **Always read this file first** at the start of a session before writing any code.
2. **Work in this order** for each new module: DB model → Alembic migration → Pydantic schemas → service layer → API route → frontend API call → React component.
3. **Write tests alongside code** — use `pytest` + `httpx` for API tests, `pytest-asyncio` for async.
4. **Update the phase table above** when a phase is complete.
5. **Never generate .env files with real secrets** — only update `.env.example`.
6. **When in doubt about a design decision**, add a `# TODO: decision needed —` comment and move on rather than guessing.
