import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import datetime, timedelta
import random
from app.core.database import Base, engine, SessionLocal
from app.core.auth import hash_password
from app.models.entities import (User, Technician, Service, Job, Booking,
                                  Notification, Invoice, RecruitmentApplication)

random.seed(42)
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Services ──────────────────────────────────────────────────────────────────
if db.query(Service).count() == 0:
    services_data = [
        ("Plumbing Repair", "Fix leaks, pipes, drains", "plumbing", 80.0, 60),
        ("Electrical Repair", "Wiring, outlets, panels", "electrical", 100.0, 90),
        ("HVAC Service", "AC and heating maintenance", "hvac", 120.0, 120),
        ("Appliance Repair", "Washing machines, fridges", "appliance", 70.0, 60),
        ("Deep Cleaning", "Full home deep clean", "cleaning", 60.0, 180),
        ("Painting", "Interior and exterior painting", "painting", 90.0, 240),
    ]
    for name, desc, skill, price, dur in services_data:
        db.add(Service(name=name, description=desc, skill_required=skill,
                       base_price=price, duration_minutes=dur))
    db.commit()
    print("[OK] Services seeded")

# ── Demo Users ─────────────────────────────────────────────────────────────────
if db.query(User).count() == 0:
    # Admin
    admin = User(email="admin@dispatchgrid.com",
                 hashed_password=hash_password("admin123"),
                 full_name="Operations Admin", role="admin", phone="555-0100")
    db.add(admin)

    # Customer
    customer = User(email="customer@example.com",
                    hashed_password=hash_password("customer123"),
                    full_name="Jane Customer", role="customer", phone="555-0200")
    db.add(customer)
    db.flush()

    db.add(Notification(user_id=customer.id, title="Welcome to DispatchGrid",
                        body="Book your first service today!"))
    db.commit()
    print("[OK] Demo users seeded")
    print("  admin@dispatchgrid.com / admin123")
    print("  customer@example.com  / customer123")

# ── Technicians ────────────────────────────────────────────────────────────────
if db.query(Technician).count() == 0:
    skill_pool = ["plumbing", "electrical", "hvac", "appliance", "cleaning", "painting"]
    zones = ["north", "south", "east", "west", "central"]
    tech_names = [
        "Alice Morgan", "Bob Chen", "Carlos Rivera", "Diana Patel", "Ethan Brooks",
        "Fatima Hassan", "George Kim", "Hannah Lee", "Ivan Petrov", "Julia Santos",
        "Kevin Okafor", "Laura Müller", "Marcus Johnson", "Nina Sharma", "Oscar Tran",
        "Priya Nair", "Quinn Walsh", "Rachel Green", "Samuel Adeyemi", "Tina Zhao"
    ]
    tech_users = []
    for i, tname in enumerate(tech_names):
        skills = random.sample(skill_pool, k=random.randint(1, 3))
        tech_zones = random.sample(zones, k=random.randint(2, 4))
        tech = Technician(
            name=tname,
            email=f"tech{i+1:02d}@dispatchgrid.com",
            phone=f"555-{1000+i}",
            skills=skills, zones=tech_zones,
            latitude=12.90 + random.random() * 0.20,
            longitude=77.50 + random.random() * 0.22,
            shift_start="09:00", shift_end="18:00",
            available=(i % 7 != 0),
            unavailable_periods=[]
        )
        db.add(tech)
        db.flush()
        # Create user account for each technician
        u = User(email=f"tech{i+1:02d}@dispatchgrid.com",
                 hashed_password=hash_password("tech123"),
                 full_name=tname, role="technician",
                 technician_id=tech.id)
        db.add(u)
        tech_users.append((tech, u))
    db.commit()
    print("[OK] 20 technicians seeded (tech01..tech20@dispatchgrid.com / tech123)")

# ── Jobs ───────────────────────────────────────────────────────────────────────
if db.query(Job).count() == 0:
    skill_pool = ["plumbing", "electrical", "hvac", "appliance", "cleaning", "painting"]
    zones = ["north", "south", "east", "west", "central"]
    now = datetime.now().replace(second=0, microsecond=0)
    for i in range(100):
        start = now + timedelta(days=random.randint(1, 5), hours=random.randint(0, 7))
        duration = random.choice([30, 45, 60, 90, 120])
        skills = [random.choice(skill_pool)]
        # Deliberately impossible cases for explainability testing
        if i in (96, 97):
            skills = ["specialist_certification_not_seeded"]
        zone = random.choice(zones)
        db.add(Job(
            external_id=f"DG-SEED-{i+1:03d}",
            title=f"Service request {i+1}",
            required_skills=skills, zone=zone,
            latitude=12.90 + random.random() * 0.20,
            longitude=77.50 + random.random() * 0.22,
            duration_minutes=duration,
            priority=random.randint(1, 5),
            window_start=start,
            window_end=start + timedelta(hours=random.randint(2, 6)),
            sla_deadline=start + timedelta(hours=random.randint(3, 7)),
            status="pending"
        ))
    db.commit()
    print("[OK] 100 jobs seeded")

# ── Sample recruitment applications ───────────────────────────────────────────
if db.query(RecruitmentApplication).count() == 0:
    for i in range(3):
        db.add(RecruitmentApplication(
            full_name=f"Applicant {i+1}",
            email=f"applicant{i+1}@example.com",
            phone=f"555-900{i}",
            skills=random.sample(["plumbing","electrical","hvac"], 2),
            zones=random.sample(["north","south","central"], 2),
            cover_letter="I am experienced and eager to join the team."
        ))
    db.commit()
    print("[OK] Sample recruitment applications seeded")

db.close()
print("\nSeed complete. Demo credentials:")
print("  Admin    : admin@dispatchgrid.com / admin123")
print("  Customer : customer@example.com  / customer123")
print("  Technician: tech01@dispatchgrid.com / tech123  (tech01–tech20)")
