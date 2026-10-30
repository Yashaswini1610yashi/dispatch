# Database schema

- `technicians`: skills, service zones, coordinates, shift bounds, availability, unavailable periods.
- `jobs`: unique external ID, requested skills, zone, coordinates, duration, priority, time window, SLA, state, idempotency key.
- `assignments`: job/technician foreign keys, scheduled start/end, travel estimate, state and explanation. Unique constraint on `job_id` prevents multiple confirmed assignment rows for one job.
- `schedule_runs`: unique run ID, timestamp, objective score, counts, changes, unassigned explanations and metrics.
- `audit_logs`: action, entity, structured detail and timestamp.

SQLAlchemy models create the schema at application startup for the hackathon. Add Alembic migration history before production use.
