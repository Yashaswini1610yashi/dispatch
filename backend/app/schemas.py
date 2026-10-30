from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class TechnicianIn(BaseModel):
    name: str
    skills: list[str] = []
    zones: list[str] = []
    latitude: float
    longitude: float
    shift_start: str = "09:00"
    shift_end: str = "17:00"
    available: bool = True
    active: bool = True
    unavailable_periods: list[dict] = []

class TechnicianOut(TechnicianIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class JobIn(BaseModel):
    external_id: str | None = None
    title: str
    required_skills: list[str] = []
    zone: str
    latitude: float
    longitude: float
    duration_minutes: int = Field(gt=0, le=1440)
    priority: int = Field(default=3, ge=1, le=5, description="1=highest, 5=lowest")
    window_start: datetime
    window_end: datetime
    sla_deadline: datetime

class JobOut(BaseModel):
    id: int
    external_id: str
    title: str
    required_skills: list[str]
    zone: str
    latitude: float
    longitude: float
    duration_minutes: int
    priority: int
    window_start: datetime
    window_end: datetime
    sla_deadline: datetime
    status: str
    model_config = ConfigDict(from_attributes=True)

class DisruptionIn(BaseModel):
    type: str
    technician_id: int | None = None
    job_id: int | None = None
    detail: str = ""
