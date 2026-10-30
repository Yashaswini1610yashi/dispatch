from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user, require_role
from app.models.entities import User, Technician, Notification
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth")

class RegisterIn(BaseModel):
    email: str
    password: str
    full_name: str = ""
    phone: str = ""
    role: str = "customer"

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str
    technician_id: int | None = None

@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if payload.role not in ("customer", "admin", "technician"):
        raise HTTPException(400, "Invalid role")
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(409, "Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
    )
    db.add(user)
    db.flush()
    if payload.role == "technician":
        tech = Technician(
            name=payload.full_name or payload.email,
            email=payload.email,
            phone=payload.phone,
            skills=[], zones=[], latitude=12.97, longitude=77.59,
            shift_start="09:00", shift_end="17:00", available=True,
        )
        db.add(tech)
        db.flush()
        user.technician_id = tech.id
    db.add(Notification(user_id=user.id, title="Welcome to DispatchGrid", body="Your account has been created."))
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenOut(access_token=token, role=user.role, user_id=user.id, full_name=user.full_name, technician_id=user.technician_id)

@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password")
    if not user.active:
        raise HTTPException(403, "Account is deactivated")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenOut(access_token=token, role=user.role, user_id=user.id, full_name=user.full_name, technician_id=user.technician_id)

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "role": current_user.role,
            "full_name": current_user.full_name, "phone": current_user.phone,
            "technician_id": current_user.technician_id}

@router.patch("/me")
def update_me(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    allowed = {"full_name", "phone"}
    for k, v in payload.items():
        if k in allowed:
            setattr(current_user, k, v)
    db.commit()
    return {"ok": True}
