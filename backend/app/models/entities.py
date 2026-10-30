from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, Boolean, ForeignKey, JSON, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="customer")  # customer|admin|technician
    full_name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id"), nullable=True)
    technician: Mapped["Technician | None"] = relationship(foreign_keys=[technician_id])


class Technician(Base):
    __tablename__ = "technicians"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), default="")
    phone: Mapped[str] = mapped_column(String(30), default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    zones: Mapped[list] = mapped_column(JSON, default=list)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    shift_start: Mapped[str] = mapped_column(String(5), default="09:00")
    shift_end: Mapped[str] = mapped_column(String(5), default="17:00")
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    unavailable_periods: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    rating: Mapped[float] = mapped_column(Float, default=5.0)
    total_jobs: Mapped[int] = mapped_column(Integer, default=0)


class Service(Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    skill_required: Mapped[str] = mapped_column(String(80))
    base_price: Mapped[float] = mapped_column(Float, default=0.0)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(primary_key=True)
    booking_ref: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    address: Mapped[str] = mapped_column(Text, default="")
    latitude: Mapped[float] = mapped_column(Float, default=0.0)
    longitude: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    urgency: Mapped[str] = mapped_column(String(20), default="normal")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    customer: Mapped["User"] = relationship(foreign_keys=[customer_id])
    jobs: Mapped[list["Job"]] = relationship(back_populates="booking")


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    zone: Mapped[str] = mapped_column(String(80))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    priority: Mapped[int] = mapped_column(Integer, default=3)
    window_start: Mapped[datetime] = mapped_column(DateTime)
    window_end: Mapped[datetime] = mapped_column(DateTime)
    sla_deadline: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    booking: Mapped["Booking | None"] = relationship(back_populates="jobs")
    customer: Mapped["User | None"] = relationship(foreign_keys=[customer_id])


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("job_id", name="uq_assignment_job"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    technician_id: Mapped[int] = mapped_column(ForeignKey("technicians.id"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    travel_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="assigned")
    explanation: Mapped[str] = mapped_column(Text, default="")
    technician: Mapped[Technician] = relationship()
    job: Mapped[Job] = relationship()


class ScheduleRun(Base):
    __tablename__ = "schedule_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(40), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    objective_score: Mapped[float] = mapped_column(Float, default=0)
    jobs_considered: Mapped[int] = mapped_column(Integer, default=0)
    jobs_assigned: Mapped[int] = mapped_column(Integer, default=0)
    changes: Mapped[list] = mapped_column(JSON, default=list)
    unassigned: Mapped[list] = mapped_column(JSON, default=list)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(60))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    user: Mapped["User"] = relationship()


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    customer: Mapped["User"] = relationship()


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    technician_id: Mapped[int] = mapped_column(ForeignKey("technicians.id"))
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    technician: Mapped["Technician"] = relationship()


class RecruitmentApplication(Base):
    __tablename__ = "recruitment_applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str] = mapped_column(String(30), default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    zones: Mapped[list] = mapped_column(JSON, default=list)
    cover_letter: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_ref: Mapped[str] = mapped_column(String(40), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="unpaid")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    customer: Mapped["User"] = relationship()
