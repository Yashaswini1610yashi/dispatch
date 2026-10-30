# DispatchGrid — Intelligent Workforce Scheduling & Recovery Engine

A runnable full-stack hackathon implementation focused on the company's core evaluation: explainable scheduling, constraint safety, disruption recovery, persistent data, audit history, and a functional operations dashboard.

## Stack
- Frontend: React + TypeScript + Vite + Recharts + Lucide
- Backend: Python + FastAPI + SQLAlchemy + Pydantic
- Database: SQLite by default; PostgreSQL supported through `DATABASE_URL`
- Tests: Pytest
- API docs: FastAPI Swagger at `/docs`

No paid external API is required for the core scheduling demonstration.

## Run

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m scripts.seed
uvicorn app.main:app --reload
```

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. API documentation: `http://localhost:8000/docs`.

### 3. Tests
```bash
cd backend
pytest -q
```

## Company problem statement coverage

| Requirement | Implementation |
|---|---|
| Create/list jobs and technicians | FastAPI CRUD endpoints for create/list; technician patch |
| Job fields, priority, skills, zone, duration, window, SLA | SQLAlchemy models + Pydantic validation |
| Job states | pending, assigned, in_progress, completed, cancelled, unassigned fields; recovery guards cancellation for in-progress/completed |
| Scheduling constraints | Skills, availability, shifts, zones, windows, SLA, existing assignments, travel estimates |
| No overlapping assignments | Insertion feasibility checks + unique assignment-per-job constraint |
| Feasible/infeasible/unassignable | Persisted unassigned classification and actionable diagnostics |
| Optimisation | Deterministic weighted insertion cost; retain assignment preference; workload and travel cost |
| Disruption recovery | Technician unavailable, cancellation and duration change operations; preserves completed/in-progress work |
| Explainability/audit | Run ID, timestamp, score, counts, reasons, changes, metrics, audit log |
| Dashboard | Functional admin operations overview, job/technician lists, schedule view, recovery action |
| Persistent storage | SQLAlchemy SQLite/PostgreSQL |
| Idempotency | `Idempotency-Key` header on job creation |
| Seed data | 20 technicians and 100 jobs, including impossible-skill cases |
| Tests | Scheduler no-overlap and missing-skill explanation tests |
| API examples | Swagger UI and endpoint docs |

## Scheduling method
Jobs are processed by priority ascending (1 is highest), then SLA deadline. Candidates failing skills, service zone, availability, time window, SLA, shift, travel or existing-job checks are rejected before scoring. The remaining feasible insertion positions are scored deterministically:

`cost = 10 × added_travel_minutes + 30 × technician_change + 5 × existing_job_count + 2 × (priority - 1)`

The lowest-cost feasible candidate is selected. This is a heuristic, not a claim of global optimality. Straight-line Haversine distance is converted to a transparent travel estimate using a 1.35 road factor and 25 km/h. Replace with a self-hosted OSRM/Valhalla instance for road routing in a production-like demo.

## Reliability and limitations to disclose

- Unique external job IDs, unique idempotency keys and one-assignment-per-job constraints protect against duplicate records. The scheduler currently runs synchronously in the API process. Before deploying multiple workers, add a PostgreSQL advisory lock or locked scheduler-run row, retry handling and explicit failed-run state. Database constraints remain the final integrity boundary.
- SQLite is suitable for local demonstration; PostgreSQL is recommended for shared concurrent use.
- This repository is the working scheduling-engine and operations-dashboard foundation. The customer/technician portals, authentication/RBAC, AI assistant, payment flows, GPS ingestion/WebSocket tracking and recruitment workflows are not falsely represented as complete. They are listed in `docs/ROADMAP.md` for the next implementation increment.
- No live GPS data is fabricated. Tracking must require technician consent and an active authorised assignment.

## Project structure
See `docs/ARCHITECTURE.md` and `docs/DATABASE.md`.
