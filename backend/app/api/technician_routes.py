from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.entities import User, Technician, Job, Assignment, LeaveRequest, Notification
from pydantic import BaseModel

router = APIRouter(prefix="/api/technician")

def _require_tech(u: User = Depends(require_role("technician", "admin"))):
    return u

def _get_tech(current_user: User, db: Session) -> Technician:
    if not current_user.technician_id:
        raise HTTPException(404, "No technician profile linked to this account")
    t = db.get(Technician, current_user.technician_id)
    if not t: raise HTTPException(404, "Technician profile not found")
    return t

class LeaveIn(BaseModel):
    start_date: datetime
    end_date: datetime
    reason: str = ""

class StatusUpdateIn(BaseModel):
    status: str  # in_progress|completed

@router.get("/profile")
def get_profile(current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    return {"id": t.id, "name": t.name, "email": t.email, "phone": t.phone,
            "skills": t.skills, "zones": t.zones, "available": t.available,
            "shift_start": t.shift_start, "shift_end": t.shift_end,
            "rating": t.rating, "total_jobs": t.total_jobs}

@router.patch("/availability")
def set_availability(payload: dict, current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    if "available" in payload:
        t.available = bool(payload["available"])
    db.commit()
    return {"available": t.available}

@router.get("/assignments")
def my_assignments(current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    rows = db.scalars(
        select(Assignment).where(
            Assignment.technician_id == t.id,
            Assignment.status.in_(["assigned", "in_progress"])
        ).order_by(Assignment.start_at)
    ).all()
    return [{"id": a.id, "job_id": a.job_id, "job_external_id": a.job.external_id,
             "job_title": a.job.title, "zone": a.job.zone,
             "required_skills": a.job.required_skills,
             "start_at": a.start_at, "end_at": a.end_at,
             "travel_minutes": a.travel_minutes, "status": a.status,
             "latitude": a.job.latitude, "longitude": a.job.longitude} for a in rows]

@router.get("/history")
def my_history(current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    rows = db.scalars(
        select(Assignment).where(
            Assignment.technician_id == t.id,
            Assignment.status.in_(["completed", "cancelled", "superseded"])
        ).order_by(Assignment.start_at.desc())
    ).all()
    return [{"id": a.id, "job_external_id": a.job.external_id,
             "job_title": a.job.title, "start_at": a.start_at,
             "end_at": a.end_at, "status": a.status} for a in rows]

@router.post("/assignments/{aid}/status")
def update_job_status(aid: int, payload: StatusUpdateIn,
                      current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    a = db.get(Assignment, aid)
    if not a or a.technician_id != t.id:
        raise HTTPException(404, "Assignment not found")
    valid_transitions = {
        "assigned": ["in_progress"],
        "in_progress": ["completed"],
    }
    if payload.status not in valid_transitions.get(a.status, []):
        raise HTTPException(409, f"Cannot transition from {a.status} to {payload.status}")
    a.status = payload.status
    job = db.get(Job, a.job_id)
    if job:
        job.status = payload.status
        if payload.status == "completed":
            t.total_jobs = (t.total_jobs or 0) + 1
    db.commit()
    return {"assignment_id": a.id, "status": a.status}

@router.post("/leave", status_code=201)
def request_leave(payload: LeaveIn, current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    lr = LeaveRequest(technician_id=t.id, start_date=payload.start_date,
                      end_date=payload.end_date, reason=payload.reason)
    db.add(lr); db.commit(); db.refresh(lr)
    return {"id": lr.id, "status": lr.status}

@router.get("/leave")
def my_leave(current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    rows = db.scalars(select(LeaveRequest).where(LeaveRequest.technician_id == t.id)).all()
    return [{"id": lr.id, "start_date": lr.start_date, "end_date": lr.end_date,
             "reason": lr.reason, "status": lr.status} for lr in rows]

@router.get("/notifications")
def tech_notifications(current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    ).all()
    return [{"id": n.id, "title": n.title, "body": n.body,
             "read": n.read, "created_at": n.created_at} for n in rows]

@router.post("/emergency")
def report_emergency(payload: dict, current_user: User = Depends(_require_tech), db: Session = Depends(get_db)):
    t = _get_tech(current_user, db)
    msg = payload.get("message", "Emergency reported")
    db.add(Notification(user_id=current_user.id, title="Emergency reported",
                        body=f"Tech {t.name}: {msg}"))
    db.commit()
    return {"ok": True, "message": "Emergency reported to admin"}
