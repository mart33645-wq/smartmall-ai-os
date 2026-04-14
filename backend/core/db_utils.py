from models.database import SessionLocal, User, Shop, Alert, ParkingSlot, Task, Base, engine
from passlib.context import CryptContext
import datetime

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def seed_database():
    """Seed the database with initial data for a fresh start."""
    db = SessionLocal()
    try:
        # Seed Admin user
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                hashed_password=pwd_context.hash("admin123"),
                role="Admin",
                full_name="Mall Administrator",
                preferences={},
            ))
        if not db.query(User).filter(User.username == "staff").first():
            db.add(User(
                username="staff",
                hashed_password=pwd_context.hash("staff123"),
                role="Staff",
                full_name="Mall Staff",
                preferences={},
            ))
        db.commit()

        # Seed Shops
        if db.query(Shop).count() == 0:
            sample_shops = [
                Shop(name="Apple Store", category="Electronics", floor=1, rent_amount=15000, daily_revenue=8500, visitor_count=1200, performance_score=95.0),
                Shop(name="Zara Fashion", category="Fashion", floor=2, rent_amount=12000, daily_revenue=6200, visitor_count=980, performance_score=87.0),
                Shop(name="McDonald's", category="Dining", floor=1, rent_amount=8000, daily_revenue=4100, visitor_count=2100, performance_score=92.0),
                Shop(name="Novo Cinemas", category="Entertainment", floor=3, rent_amount=20000, daily_revenue=11000, visitor_count=1500, performance_score=88.0),
                Shop(name="Levi's", category="Fashion", floor=2, rent_amount=9000, daily_revenue=3200, visitor_count=450, performance_score=62.0, is_at_risk=True),
                Shop(name="GNC Nutrition", category="Health", floor=1, rent_amount=5000, daily_revenue=1800, visitor_count=180, performance_score=48.0, is_at_risk=True),
                Shop(name="Sephora", category="Beauty", floor=2, rent_amount=10000, daily_revenue=5500, visitor_count=750, performance_score=82.0),
                Shop(name="Starbucks", category="Dining", floor=1, rent_amount=7000, daily_revenue=3900, visitor_count=860, performance_score=89.0),
            ]
            db.add_all(sample_shops)
            db.commit()

        # Seed Parking Spots
        if db.query(ParkingSlot).count() == 0:
            slots = []
            for i in range(1, 61):
                level = 1 if i <= 20 else 2 if i <= 40 else 3
                ptype = "EV" if i % 10 == 0 else "Disabled" if i % 15 == 0 else "Standard"
                is_occ = i % 3 == 0 or i % 5 == 0
                slots.append(ParkingSlot(slot_number=f"P-{i:03d}", level=level, is_occupied=is_occ, type=ptype))
            db.add_all(slots)
            db.commit()

        # Seed Alerts
        if db.query(Alert).count() == 0:
            sample_alerts = [
                Alert(type="CRITICAL", message="Food Court exceeds 85% capacity - fire safety risk", zone="Food Court", is_resolved=False),
                Alert(type="WARNING", message="Parking Level 2 is 78% full - expect overflow in 30min", zone="Parking L2", is_resolved=False),
                Alert(type="INFO", message="Weekend traffic peak predicted: 2x normal load at 18:00", zone="All Zones", is_resolved=False),
                Alert(type="WARNING", message="GNC Nutrition revenue dropped 40% this week", zone="Floor 1", is_resolved=False),
                Alert(type="INFO", message="HVAC optimization saved 12% energy today", zone="HVAC System", is_resolved=True),
            ]
            db.add_all(sample_alerts)
            db.commit()

        # Seed Tasks
        if db.query(Task).count() == 0:
            admin = db.query(User).filter(User.username == "admin").first()
            if admin:
                sample_tasks = [
                    Task(title="Review at-risk shop reports", description="Analyze GNC and Levi's performance data", priority="High", status="In Progress", assigned_to=admin.id, deadline=datetime.datetime.utcnow() + datetime.timedelta(days=1)),
                    Task(title="Negotiate rent renewal for Apple Store", description="Premium performance warrants 5% rent increase", priority="Medium", status="Pending", assigned_to=admin.id, deadline=datetime.datetime.utcnow() + datetime.timedelta(days=7)),
                    Task(title="Deploy new parking sensors", description="Install smart sensors in Level 3 slots", priority="Low", status="Pending", assigned_to=admin.id, deadline=datetime.datetime.utcnow() + datetime.timedelta(days=14)),
                ]
                db.add_all(sample_tasks)
                db.commit()
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    seed_database()
