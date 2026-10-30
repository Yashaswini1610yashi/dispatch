from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import require_role
from app.models.entities import (User, Technician, Service, Job, Booking,
                                  Complaint, RecruitmentApplication, LeaveRequest,
                                  Notification, Invoice, AuditLog)
from pydantic import BaseModel
from datetime import datetime
from uuid import uuid4

router = APIRouter(prefix="/api/admin")
_admin = Depends(require_role("admin"))

class ServiceIn(BaseModel):
    name: str
    description: str = ""
    skill_required: str
    base_price: float = 0.0
    duration_minutes: int = 60

class RecruitmentActionIn(BaseModel):
    action: str  # approve|reject|shortlist

@router.get("/users")
def list_users(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(User).order_by(User.id)).all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name,
             "role": u.role, "active": u.active, "created_at": u.created_at} for u in rows]

@router.patch("/users/{uid}/toggle")
def toggle_user(uid: int, db: Session = Depends(get_db), _=_admin):
    u = db.get(User, uid)
    if not u: raise HTTPException(404, "User not found")
    u.active = not u.active; db.commit()
    return {"id": u.id, "active": u.active}

@router.get("/technicians")
def list_technicians(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(Technician).order_by(Technician.id)).all()
    return [{"id": t.id, "name": t.name, "email": t.email, "skills": t.skills,
             "zones": t.zones, "available": t.available, "active": t.active,
             "rating": t.rating, "total_jobs": t.total_jobs} for t in rows]

@router.patch("/technicians/{tid}")
def update_technician(tid: int, payload: dict, db: Session = Depends(get_db), _=_admin):
    t = db.get(Technician, tid)
    if not t: raise HTTPException(404, "Technician not found")
    allowed = {"name","email","phone","skills","zones","shift_start","shift_end","available","active","latitude","longitude"}
    for k, v in payload.items():
        if k in allowed: setattr(t, k, v)
    db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name, "available": t.available, "active": t.active}

@router.get("/services")
def list_services(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(Service)).all()
    return [{"id": s.id, "name": s.name, "description": s.description,
             "skill_required": s.skill_required, "base_price": s.base_price,
             "duration_minutes": s.duration_minutes, "active": s.active} for s in rows]

@router.post("/services", status_code=201)
def create_service(payload: ServiceIn, db: Session = Depends(get_db), _=_admin):
    if db.scalar(select(Service).where(Service.name == payload.name)):
        raise HTTPException(409, "Service name already exists")
    s = Service(**payload.model_dump()); db.add(s); db.commit(); db.refresh(s)
    return {"id": s.id, "name": s.name}

@router.patch("/services/{sid}")
def update_service(sid: int, payload: dict, db: Session = Depends(get_db), _=_admin):
    s = db.get(Service, sid)
    if not s: raise HTTPException(404, "Service not found")
    allowed = {"name","description","skill_required","base_price","duration_minutes","active"}
    for k, v in payload.items():
        if k in allowed: setattr(s, k, v)
    db.commit()
    return {"id": s.id, "name": s.name, "active": s.active}

@router.get("/jobs")
def list_jobs(status: str | None = None, db: Session = Depends(get_db), _=_admin):
    q = select(Job)
    if status: q = q.where(Job.status == status)
    rows = db.scalars(q.order_by(Job.priority, Job.sla_deadline)).all()
    return [{"id": j.id, "external_id": j.external_id, "title": j.title,
             "zone": j.zone, "priority": j.priority, "status": j.status,
             "required_skills": j.required_skills, "window_start": j.window_start,
             "sla_deadline": j.sla_deadline, "duration_minutes": j.duration_minutes} for j in rows]

@router.get("/bookings")
def list_bookings(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(Booking).order_by(Booking.created_at.desc())).all()
    return [{"id": b.id, "booking_ref": b.booking_ref, "address": b.address,
             "urgency": b.urgency, "status": b.status, "created_at": b.created_at,
             "customer_id": b.customer_id} for b in rows]

@router.get("/complaints")
def list_complaints(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(Complaint).order_by(Complaint.created_at.desc())).all()
    return [{"id": c.id, "subject": c.subject, "description": c.description,
             "status": c.status, "customer_id": c.customer_id,
             "job_id": c.job_id, "created_at": c.created_at} for c in rows]

@router.patch("/complaints/{cid}")
def update_complaint(cid: int, payload: dict, db: Session = Depends(get_db), _=_admin):
    c = db.get(Complaint, cid)
    if not c: raise HTTPException(404, "Complaint not found")
    if "status" in payload: c.status = payload["status"]
    db.commit()
    return {"id": c.id, "status": c.status}

@router.get("/recruitment")
def list_applications(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(RecruitmentApplication).order_by(RecruitmentApplication.created_at.desc())).all()
    return [{"id": r.id, "full_name": r.full_name, "email": r.email,
             "skills": r.skills, "zones": r.zones, "status": r.status,
             "created_at": r.created_at} for r in rows]

@router.post("/recruitment/{rid}/action")
def recruitment_action(rid: int, payload: RecruitmentActionIn, db: Session = Depends(get_db), _=_admin):
    r = db.get(RecruitmentApplication, rid)
    if not r: raise HTTPException(404, "Application not found")
    if payload.action not in ("approve","reject","shortlist"):
        raise HTTPException(422, "Invalid action")
    r.status = payload.action
    if payload.action == "approve":
        tech = Technician(name=r.full_name, email=r.email, phone=r.phone,
                          skills=r.skills, zones=r.zones,
                          latitude=12.97, longitude=77.59,
                          shift_start="09:00", shift_end="17:00", available=True)
        db.add(tech)
    db.commit()
    return {"id": r.id, "status": r.status}

@router.get("/leave-requests")
def list_leave(db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(LeaveRequest).order_by(LeaveRequest.created_at.desc())).all()
    return [{"id": lr.id, "technician_id": lr.technician_id,
             "technician_name": lr.technician.name,
             "start_date": lr.start_date, "end_date": lr.end_date,
             "reason": lr.reason, "status": lr.status} for lr in rows]

@router.patch("/leave-requests/{lid}")
def update_leave(lid: int, payload: dict, db: Session = Depends(get_db), _=_admin):
    lr = db.get(LeaveRequest, lid)
    if not lr: raise HTTPException(404, "Leave request not found")
    if "status" in payload: lr.status = payload["status"]
    db.commit()
    return {"id": lr.id, "status": lr.status}

@router.get("/audit-logs")
def audit_logs(limit: int = 50, db: Session = Depends(get_db), _=_admin):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [{"id": a.id, "action": a.action, "entity_type": a.entity_type,
             "entity_id": a.entity_id, "detail": a.detail, "created_at": a.created_at} for a in rows]

@router.post("/notifications/broadcast")
def broadcast(payload: dict, db: Session = Depends(get_db), _=_admin):
    title = payload.get("title", "Admin notification")
    body = payload.get("body", "")
    role = payload.get("role")
    q = select(User).where(User.active == True)
    if role: q = q.where(User.role == role)
    users = db.scalars(q).all()
    for u in users:
        db.add(Notification(user_id=u.id, title=title, body=body))
    db.commit()
    return {"sent": len(users)}
