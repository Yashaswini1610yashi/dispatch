from datetime import datetime, timedelta
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.database import Base
from app.models.entities import Technician, Job, Assignment
from app.services.scheduler import schedule

engine=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
TestingSession=sessionmaker(bind=engine,autoflush=False)
Base.metadata.create_all(engine)

def reset_db():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)

def test_scheduler_respects_skill_zone_and_no_overlap():
    reset_db(); db=TestingSession(); now=datetime(2030,1,1,10,0)
    t=Technician(name="T1",skills=["plumbing"],zones=["north"],latitude=12.0,longitude=77.0,shift_start="09:00",shift_end="17:00",available=True,unavailable_periods=[])
    db.add(t); db.flush()
    for i in range(2):
        db.add(Job(external_id=f"J{i}",title="Pipe repair",required_skills=["plumbing"],zone="north",latitude=12.001,longitude=77.001,duration_minutes=60,priority=1,window_start=now+timedelta(minutes=i*30),window_end=now+timedelta(hours=4),sla_deadline=now+timedelta(hours=5),status="pending"))
    db.commit(); schedule(db)
    rows=db.scalars(select(Assignment)).all()
    assert len(rows) == 2
    ordered=sorted(rows,key=lambda x:x.start_at)
    assert ordered[0].end_at <= ordered[1].start_at
    db.close()

def test_missing_skill_is_explained():
    reset_db(); db=TestingSession(); now=datetime(2030,1,1,10,0)
    db.add(Technician(name="T1",skills=["electrical"],zones=["north"],latitude=12,longitude=77,shift_start="09:00",shift_end="17:00",available=True,unavailable_periods=[]))
    db.add(Job(external_id="JX",title="Pipe repair",required_skills=["plumbing"],zone="north",latitude=12,longitude=77,duration_minutes=60,priority=1,window_start=now,window_end=now+timedelta(hours=3),sla_deadline=now+timedelta(hours=4),status="pending"))
    db.commit(); run=schedule(db)
    assert run.unassigned[0]["reasons"] == ["no technician has all required skills"]
    db.close()
