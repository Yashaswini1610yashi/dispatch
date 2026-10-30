from datetime import datetime, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.entities import User, Service, Booking, Job, Assignment, Notification, Complaint, Invoice
from pydantic import BaseModel

router = APIRouter(prefix="/api/customer")

def _require_customer(u: User = Depends(require_role("customer", "admin"))):
    return u

class BookingIn(BaseModel):
    address: str
    latitude: float = 12.97
    longitude: float = 77.59
    notes: str = ""
    urgency: str = "normal"
    services: list[dict]  # [{service_id, notes}]

class ComplaintIn(BaseModel):
    subject: str
    description: str = ""
    job_id: int | None = None

@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    rows = db.scalars(select(Service).where(Service.active == True)).all()
    return [{"id": s.id, "name": s.name, "description": s.description,
             "skill_required": s.skill_required, "base_price": s.base_price,
             "duration_minutes": s.duration_minutes} for s in rows]

@router.post("/bookings", status_code=201)
def create_booking(payload: BookingIn, current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    if not payload.services:
        raise HTTPException(422, "At least one service required")
    ref = f"BK-{uuid4().hex[:10].upper()}"
    booking = Booking(
        booking_ref=ref, customer_id=current_user.id,
        address=payload.address, latitude=payload.latitude, longitude=payload.longitude,
        notes=payload.notes, urgency=payload.urgency, status="pending"
    )
    db.add(booking)
    db.flush()
    priority_map = {"urgent": 1, "high": 2, "normal": 3, "low": 4}
    priority = priority_map.get(payload.urgency, 3)
    now = datetime.utcnow()
    for svc_req in payload.services:
        svc = db.get(Service, svc_req.get("service_id"))
        if not svc:
            raise HTTPException(404, f"Service {svc_req.get('service_id')} not found")
        ext = f"DG-{uuid4().hex[:10].upper()}"
        job = Job(
            external_id=ext,
            title=f"{svc.name} – {payload.address[:40]}",
            required_skills=[svc.skill_required],
            zone="central",
            latitude=payload.latitude, longitude=payload.longitude,
            duration_minutes=svc.duration_minutes,
            priority=priority,
            window_start=now + timedelta(hours=1),
            window_end=now + timedelta(hours=8),
            sla_deadline=now + timedelta(hours=24),
            status="pending",
            booking_id=booking.id,
            customer_id=current_user.id,
        )
        db.add(job)
    db.add(Notification(user_id=current_user.id, title="Booking confirmed",
                        body=f"Your booking {ref} has been received and is being scheduled."))
    db.commit()
    db.refresh(booking)
    return {"booking_ref": booking.booking_ref, "id": booking.id, "status": booking.status}

@router.get("/bookings")
def list_bookings(current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    bookings = db.scalars(select(Booking).where(Booking.customer_id == current_user.id).order_by(Booking.created_at.desc())).all()
    result = []
    for b in bookings:
        jobs = db.scalars(select(Job).where(Job.booking_id == b.id)).all()
        result.append({
            "id": b.id, "booking_ref": b.booking_ref, "address": b.address,
            "urgency": b.urgency, "status": b.status, "created_at": b.created_at,
            "jobs": [{"id": j.id, "external_id": j.external_id, "title": j.title,
                      "status": j.status, "required_skills": j.required_skills} for j in jobs]
        })
    return result

@router.get("/bookings/{booking_id}")
def get_booking(booking_id: int, current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b or b.customer_id != current_user.id:
        raise HTTPException(404, "Booking not found")
    jobs = db.scalars(select(Job).where(Job.booking_id == b.id)).all()
    job_details = []
    for j in jobs:
        a = db.scalar(select(Assignment).where(Assignment.job_id == j.id, Assignment.status.in_(["assigned","in_progress"])))
        job_details.append({
            "id": j.id, "external_id": j.external_id, "title": j.title,
            "status": j.status, "required_skills": j.required_skills,
            "window_start": j.window_start, "window_end": j.window_end,
            "assignment": {"technician_name": a.technician.name, "start_at": a.start_at, "end_at": a.end_at} if a else None
        })
    return {"id": b.id, "booking_ref": b.booking_ref, "address": b.address,
            "urgency": b.urgency, "status": b.status, "created_at": b.created_at, "jobs": job_details}

@router.get("/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())).all()
    return [{"id": n.id, "title": n.title, "body": n.body, "read": n.read, "created_at": n.created_at} for n in rows]

@router.post("/notifications/{nid}/read")
def mark_read(nid: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n and n.user_id == current_user.id:
        n.read = True; db.commit()
    return {"ok": True}

@router.post("/complaints", status_code=201)
def create_complaint(payload: ComplaintIn, current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    c = Complaint(customer_id=current_user.id, subject=payload.subject,
                  description=payload.description, job_id=payload.job_id)
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "status": c.status}

@router.get("/complaints")
def list_complaints(current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    rows = db.scalars(select(Complaint).where(Complaint.customer_id == current_user.id)).all()
    return [{"id": c.id, "subject": c.subject, "status": c.status, "created_at": c.created_at} for c in rows]

@router.get("/invoices")
def list_invoices(current_user: User = Depends(_require_customer), db: Session = Depends(get_db)):
    rows = db.scalars(select(Invoice).where(Invoice.customer_id == current_user.id)).all()
    return [{"id": i.id, "invoice_ref": i.invoice_ref, "amount": i.amount,
             "status": i.status, "created_at": i.created_at} for i in rows]
