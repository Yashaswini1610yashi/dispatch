# Architecture

```text
React + TypeScript Operations Dashboard
                 |
              HTTP/JSON
                 |
             FastAPI API
                 |
      +----------+-----------+
      |          |           |
  Job/Tech   Scheduler   Recovery/Audit
  Services    Service      Services
      |          |           |
      +----------+-----------+
                 |
          SQLAlchemy ORM
                 |
        SQLite (local) / PostgreSQL
```

The scheduler is a domain service, not UI logic. All scheduling decisions are persisted as assignments and run-history records. The frontend reads actual API/database data. The current app is an admin-oriented demonstrator; the next step is to add separate customer and technician route groups with server-enforced role permissions.
