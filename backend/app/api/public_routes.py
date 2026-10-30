from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import RecruitmentApplication
from pydantic import BaseModel

router = APIRouter(prefix="/api/public")

class ApplicationIn(BaseModel):
    full_name: str
    email: str
    phone: str = ""
    skills: list[str] = []
    zones: list[str] = []
    cover_letter: str = ""

@router.post("/apply", status_code=201)
def apply(payload: ApplicationIn, db: Session = Depends(get_db)):
    app = RecruitmentApplication(**payload.model_dump())
    db.add(app); db.commit(); db.refresh(app)
    return {"id": app.id, "status": app.status, "message": "Application received. We will contact you soon."}
