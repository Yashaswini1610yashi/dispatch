from datetime import datetime, timedelta
from math import radians, sin, cos, asin, sqrt
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.entities import Job, Technician, Assignment, ScheduleRun, AuditLog

ACTIVE_JOB_STATES = {"assigned", "in_progress"}

def haversine_km(a_lat, a_lon, b_lat, b_lon):
    r = 6371.0
    dlat, dlon = radians(b_lat-a_lat), radians(b_lon-a_lon)
    x = sin(dlat/2)**2 + cos(radians(a_lat))*cos(radians(b_lat))*sin(dlon/2)**2
    return 2*r*asin(sqrt(x))

def travel_minutes(a_lat, a_lon, b_lat, b_lon):
    # Transparent demo estimate: straight-line distance * 1.35 road factor at 25 km/h.
    return max(0, int(haversine_km(a_lat,a_lon,b_lat,b_lon) * 1.35 / 25 * 60 + 0.999))

def _clock(dt):
    return dt.hour * 60 + dt.minute

def _shift_bounds(job, tech):
    start = job.window_start.replace(hour=int(tech.shift_start[:2]), minute=int(tech.shift_start[3:]), second=0, microsecond=0)
    end = job.window_start.replace(hour=int(tech.shift_end[:2]), minute=int(tech.shift_end[3:]), second=0, microsecond=0)
    if end <= start: end += timedelta(days=1)
    return start, end

def _overlap(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end

def _unavailable(tech, start, end):
    for period in tech.unavailable_periods or []:
        try:
            ps, pe = datetime.fromisoformat(period["start"]), datetime.fromisoformat(period["end"])
            if _overlap(start, end, ps, pe): return True
        except (KeyError, ValueError, TypeError):
            continue
    return False

def schedule(db: Session, reoptimise: bool = False):
    jobs = db.scalars(select(Job).where(Job.status.in_(["pending", "unassigned"])).order_by(Job.priority.asc(), Job.sla_deadline.asc())).all()
    techs = db.scalars(select(Technician).where(Technician.active.is_(True))).all()
    old = {a.job_id: a for a in db.scalars(select(Assignment)).all()}
    slots = {t.id: [] for t in techs}
    for a in db.scalars(select(Assignment).where(Assignment.status.in_(list(ACTIVE_JOB_STATES)))):
        slots.setdefault(a.technician_id, []).append((a.start_at, a.end_at, a.job_id, a.travel_minutes))
    assigned, unassigned, changes, total_score, total_travel = 0, [], [], 0.0, 0
    for job in jobs:
        candidates = []
        for tech in techs:
            reasons = []
            if not tech.available: reasons.append("technician marked unavailable")
            missing = sorted(set(job.required_skills) - set(tech.skills or []))
            if missing: reasons.append("missing skills: " + ", ".join(missing))
            if job.zone not in (tech.zones or []): reasons.append("outside technician service zones")
            if reasons: continue
            shift_start, shift_end = _shift_bounds(job, tech)
            earliest = max(job.window_start, shift_start)
            latest_end = min(job.window_end, job.sla_deadline, shift_end)
            if earliest + timedelta(minutes=job.duration_minutes) > latest_end: continue
            existing = sorted(slots.get(tech.id, []), key=lambda x: x[0])
            # Append after the technician's latest committed/planned work. This conservative
            # insertion policy is intentionally simple and guarantees no overlap.
            previous_end, prev_lat, prev_lon = earliest, tech.latitude, tech.longitude
            if existing:
                last = existing[-1]
                previous_end = last[1]
                previous_job = db.get(Job, last[2])
                if previous_job:
                    prev_lat, prev_lon = previous_job.latitude, previous_job.longitude
            tr = travel_minutes(prev_lat, prev_lon, job.latitude, job.longitude)
            start = max(earliest, previous_end + timedelta(minutes=tr))
            end = start + timedelta(minutes=job.duration_minutes)
            found = (start, end, tr, len(existing)) if end <= latest_end and not _unavailable(tech, start, end) else None
            if found:
                start, end, tr, idx = found
                # Lower is better: travel + preference for retaining a prior assignment.
                change_cost = 0 if job.id in old and old[job.id].technician_id == tech.id else 30
                cost = tr * 10 + change_cost + len(existing) * 5 + (job.priority - 1) * 2
                candidates.append((cost, tech, start, end, tr, idx))
        if not candidates:
            reasons = _diagnose(job, techs)
            unassigned.append({"job_id": job.external_id, "reasons": reasons, "classification": "cannot_assign" if any(x.startswith("no technician") for x in reasons) else "currently_infeasible"})
            job.status = "unassigned"
            continue
        cost, tech, start, end, tr, idx = min(candidates, key=lambda x: (x[0], x[2], x[1].id))
        prior = old.get(job.id)
        if prior:
            if prior.technician_id != tech.id or prior.start_at != start:
                changes.append({"job_id": job.external_id, "from_technician_id": prior.technician_id, "to_technician_id": tech.id, "reason": "lower-cost feasible insertion"})
            prior.technician_id, prior.start_at, prior.end_at, prior.travel_minutes = tech.id, start, end, tr
            prior.status, prior.explanation = "assigned", f"Selected by hard-constraint validation and lowest weighted cost ({cost:.1f})."
        else:
            db.add(Assignment(job_id=job.id, technician_id=tech.id, start_at=start, end_at=end, travel_minutes=tr, explanation=f"Selected by hard-constraint validation and lowest weighted cost ({cost:.1f})."))
        job.status = "assigned"
        slots[tech.id].insert(idx, (start, end, job.id, tr))
        assigned += 1; total_score += cost; total_travel += tr
    run = ScheduleRun(run_id=str(uuid4()), objective_score=total_score, jobs_considered=len(jobs), jobs_assigned=assigned, changes=changes, unassigned=unassigned, metrics={"estimated_travel_minutes": total_travel, "assigned_rate": round(assigned/len(jobs), 3) if jobs else 1.0})
    db.add(run)
    db.add(AuditLog(action="schedule_run", entity_type="schedule", entity_id=run.run_id, detail={"assigned": assigned, "unassigned": len(unassigned), "changes": changes}))
    db.commit(); db.refresh(run)
    return run

def _diagnose(job, techs):
    active = [t for t in techs if t.active]
    if not active: return ["no technician resources are registered and active"]
    skill = [t for t in active if set(job.required_skills).issubset(set(t.skills or []))]
    if not skill: return ["no technician has all required skills"]
    zone = [t for t in skill if job.zone in (t.zones or [])]
    if not zone: return ["no technician is eligible for this service zone"]
    available = [t for t in zone if t.available]
    if not available: return ["all otherwise eligible technicians are currently unavailable"]
    return ["no feasible time slot after considering shifts, existing jobs, travel time, time window and SLA"]
