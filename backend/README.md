# DispatchGrid Backend

## Run locally

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

Open `http://localhost:8000/docs` for interactive API documentation.

## Tests

```bash
pytest -q
```

## Database

SQLite is the zero-setup local default. Set `DATABASE_URL` to a PostgreSQL connection string for a shared deployment. SQLAlchemy creates the initial schema on startup; the schema is represented by models in `app/models/entities.py`. For production, add Alembic migrations before evolving the schema.

## Scheduling notes

The scheduler orders jobs by priority (1 is highest) and SLA deadline, validates skills, zones, availability, shifts, time windows, SLA and existing assignments, then tries feasible insertion positions. Candidate cost is deterministic: estimated travel minutes × 10 + 30 for changing a prior technician + 5 per existing assignment + 2 × (priority - 1). Lowest cost wins. Travel is a transparent straight-line Haversine estimate multiplied by a 1.35 road factor at 25 km/h; replace with a self-hosted OSRM/Valhalla routing engine for road-accurate estimates. This heuristic is not globally optimal; approximate worst-case search is O(J × T × (A+1) × S), where J jobs, T technicians, A average existing assignments and S diagnostic DB lookups. Indexes and batched loading should be added for larger deployments.

Unassigned classifications distinguish `currently_infeasible` (temporary availability/time constraints) from `cannot_assign` (no matching skill/resource). Run records persist timestamp, objective score, considered/assigned counts, unassigned reasons, changes and metrics.

## Reliability notes

`Idempotency-Key` makes retried job creation return the original job. Unique constraints protect external job IDs and one assignment per job. The current local implementation relies on database uniqueness plus transaction commits; for multi-worker PostgreSQL deployment, implement a PostgreSQL advisory lock or a dedicated scheduler-run lock row with `SELECT ... FOR UPDATE` around the scheduling transaction. Failed runs should be marked failed in a run-status table in the production version; current API errors leave the last committed schedule intact. Do not deploy this hackathon baseline as a safety-critical dispatch service without additional concurrency and failure-recovery testing.
