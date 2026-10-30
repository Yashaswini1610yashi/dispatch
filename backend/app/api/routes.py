from datetime import datetime
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_role, get_current_user
from app.models.entities import Technician, Job, Assignment, ScheduleRun, AuditLog, User
from app.schemas import TechnicianIn, TechnicianOut, JobIn, JobOut, DisruptionIn
from app.services.scheduler import schedule

router = APIRouter(prefix="/api")
_admin = Depends(require_role("admin"))

@router.get("/health")
def health(): return {"status": "ok", "service": "DispatchGrid API"}

@router.post("/technicians", response_model=TechnicianOut, status_code=201)
def create_technician(payload: TechnicianIn, db: Session = Depends(get_db), _=_admin):
    obj = Technician(**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/technicians", response_model=list[TechnicianOut])
def list_technicians(db: Session = Depends(get_db)):
    return db.scalars(select(Technician).order_by(Technician.id)).all()

@router.patch("/technicians/{technician_id}", response_model=TechnicianOut)
def update_technician(technician_id: int, payload: dict, db: Session = Depends(get_db), _=_admin):
    obj = db.get(Technician, technician_id)
    if not obj: raise HTTPException(404, "Technician not found")
    allowed = set(TechnicianIn.model_fields)
    for k, v in payload.items():
        if k not in allowed: raise HTTPException(422, f"Unknown technician field: {k}")
        setattr(obj, k, v)
    db.commit(); db.refresh(obj); return obj

@router.post("/jobs", response_model=JobOut, status_code=201)
def create_job(payload: JobIn, db: Session = Depends(get_db),
               idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
               _=_admin):
    if payload.window_end <= payload.window_start: raise HTTPException(422, "window_end must be after window_start")
    if payload.sla_deadline < payload.window_start: raise HTTPException(422, "SLA deadline cannot precede the job window")
    key = idempotency_key
    if key:
        existing = db.scalar(select(Job).where(Job.idempotency_key == key))
        if existing: return existing
    ext = payload.external_id or f"DG-{uuid4().hex[:10].upper()}"
    if db.scalar(select(Job).where(Job.external_id == ext)): raise HTTPException(409, "A job with this external_id already exists")
    obj = Job(**payload.model_dump(exclude={"external_id"}), external_id=ext, idempotency_key=key)
    db.add(obj); db.commit(); db.refresh(obj); return obj

@router.get("/jobs", response_model=list[JobOut])
def list_jobs(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Job)
    if status: q = q.where(Job.status == status)
    return db.scalars(q.order_by(Job.priority, Job.sla_deadline)).all()

@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(Job, job_id)
    if not job: raise HTTPException(404, "Job not found")
    a = db.scalar(select(Assignment).where(Assignment.job_id == job.id))
    return {"job": JobOut.model_validate(job), "assignment": _assignment(a),
            "explanation": a.explanation if a else _explain_unassigned(job)}

def _assignment(a):
    if not a: return None
    return {"id": a.id, "technician_id": a.technician_id,
            "technician_name": a.technician.name if a.technician else None,
            "start_at": a.start_at, "end_at": a.end_at,
            "travel_minutes": a.travel_minutes, "status": a.status}

def _explain_unassigned(job):
    if job.status == "unassigned":
        return "No feasible technician/time slot was found. Run history contains specific constraint diagnostics."
    return "Not scheduled yet."

@router.post("/schedule/run")
def run_schedule(db: Session = Depends(get_db), _=_admin):
    run = schedule(db)
    return _run_out(run)

@router.post("/schedule/recover")
def recover(payload: DisruptionIn, db: Session = Depends(get_db), _=_admin):
    if payload.type not in {"technician_unavailable","urgent_job","duration_changed","job_cancelled","early_finish","late_finish"}:
        raise HTTPException(422, "Unsupported disruption type")
    detail = payload.model_dump()
    if payload.type == "technician_unavailable" and payload.technician_id:
        tech = db.get(Technician, payload.technician_id)
        if not tech: raise HTTPException(404, "Technician not found")
        tech.available = False
        for a in db.scalars(select(Assignment).where(Assignment.technician_id == tech.id, Assignment.status == "assigned")):
            job = db.get(Job, a.job_id)
            if job and job.status == "assigned": job.status = "pending"; a.status = "superseded"
    elif payload.type == "job_cancelled" and payload.job_id:
        job = db.get(Job, payload.job_id)
        if not job: raise HTTPException(404, "Job not found")
        if job.status in ("in_progress", "completed"): raise HTTPException(409, "Cannot cancel an in-progress or completed job")
        job.status = "cancelled"
        a = db.scalar(select(Assignment).where(Assignment.job_id == job.id))
        if a: a.status = "cancelled"
    elif payload.type == "duration_changed" and payload.job_id:
        job = db.get(Job, payload.job_id)
        if not job: raise HTTPException(404, "Job not found")
        minutes = int(payload.detail)
        if minutes <= 0: raise HTTPException(422, "detail must contain a positive duration in minutes")
        job.duration_minutes = minutes
        a = db.scalar(select(Assignment).where(Assignment.job_id == job.id))
        if a and job.status == "assigned": job.status = "pending"; a.status = "superseded"
    db.add(AuditLog(action="disruption", entity_type="operation", entity_id=str(payload.type), detail=detail))
    db.commit()
    run = schedule(db)
    return {"disruption": detail, "recovery": _run_out(run)}

@router.get("/schedule/current")
def current_schedule(db: Session = Depends(get_db)):
    rows = db.scalars(select(Assignment).where(Assignment.status.in_(["assigned","in_progress"])).order_by(Assignment.start_at)).all()
    return [_assignment(x) | {"job_id": x.job.external_id, "job_title": x.job.title, "zone": x.job.zone} for x in rows]

@router.get("/schedule/runs")
def run_history(db: Session = Depends(get_db)):
    rows = db.scalars(select(ScheduleRun).order_by(ScheduleRun.created_at.desc())).all()
    return [_run_out(x) for x in rows]

@router.get("/schedule/runs/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.scalar(select(ScheduleRun).where(ScheduleRun.run_id == run_id))
    if not run: raise HTTPException(404, "Schedule run not found")
    return _run_out(run)

def _run_out(r):
    return {"run_id": r.run_id, "created_at": r.created_at, "objective_score": r.objective_score,
            "jobs_considered": r.jobs_considered, "jobs_assigned": r.jobs_assigned,
            "unassigned": r.unassigned, "changes": r.changes, "metrics": r.metrics}

@router.get("/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    jobs = db.scalars(select(Job)).all()
    techs = db.scalars(select(Technician)).all()
    return {"jobs_total": len(jobs), "pending": sum(j.status == "pending" for j in jobs),
            "assigned": sum(j.status == "assigned" for j in jobs),
            "in_progress": sum(j.status == "in_progress" for j in jobs),
            "completed": sum(j.status == "completed" for j in jobs),
            "unassigned": sum(j.status == "unassigned" for j in jobs),
            "technicians_total": len(techs),
            "technicians_available": sum(t.available and t.active for t in techs),
            "technicians_unavailable": sum((not t.available) or (not t.active) for t in techs)}
