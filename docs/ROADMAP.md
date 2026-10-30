# Next implementation roadmap

## Priority 1 — required core hardening
- Add PostgreSQL advisory lock / locked scheduler-run row and concurrent integration tests.
- Add job state-transition endpoint with explicit transition matrix.
- Add update/cancel job endpoints and technician full CRUD.
- Add schedule-run status (`running`, `succeeded`, `failed`) and recovery from interrupted runs.
- Batch-load jobs/technicians to remove scheduler N+1 queries.
- Expand tests for SLA, shift, zone, travel, in-progress protection, duplicate requests and concurrent scheduler calls.

## Priority 2 — three connected role experiences
- Customer registration/login, profile, saved addresses, booking, activity, payment, feedback and complaints.
- Technician login, availability, offers, accept/decline, schedule, attendance, emergency and leave requests.
- Server-side RBAC and tenant/customer data isolation; do not trust frontend route guards alone.

## Priority 3 — AI and location
- LLM assistant with structured extraction, deterministic safety checks and active-service retrieval.
- Technician GPS consent and tracking-session lifecycle.
- WebSocket location stream and Leaflet customer/admin maps.
- Road routing through a self-hosted OSRM/Valhalla service; avoid reliance on paid APIs.

## Priority 4 — business operations
- Dynamic service catalogue, recruitment, notifications, invoices/payments, technician earnings, complaints, reviews, analytics and reporting.
