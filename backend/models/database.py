from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
import datetime

from core.config import (
    DATABASE_URL,
    DEFAULT_POSTGRES_URL,
    USE_SQLITE,
    SMARTMALL_TESTING,
    SQLITE_DATABASE_URL,
)


def _create_engine():
    if USE_SQLITE or SMARTMALL_TESTING:
        url = SQLITE_DATABASE_URL
        print(f"Using SQLite ({url})")
        return create_engine(
            url,
            connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
        )
    primary = DATABASE_URL or DEFAULT_POSTGRES_URL
    eng = create_engine(primary, connect_args={"connect_timeout": 3}, pool_pre_ping=True)
    try:
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Connected to PostgreSQL")
        return eng
    except Exception as exc:
        print(f"!!! PostgreSQL not available ({exc}). Falling back to SQLite for local demo !!!")
        eng.dispose()
        return create_engine(
            SQLITE_DATABASE_URL,
            connect_args={"check_same_thread": False},
        )


engine = _create_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String)  # Admin, Staff
    full_name = Column(String)
    preferences = Column(JSON, nullable=True)


class Shop(Base):
    __tablename__ = "shops"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String)
    floor = Column(Integer)
    rent_amount = Column(Float)
    is_at_risk = Column(Boolean, default=False)
    daily_revenue = Column(Float, default=0.0)
    visitor_count = Column(Integer, default=0)
    performance_score = Column(Float, default=100.0)
    owner_id = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)  # CRITICAL, WARNING, INFO, SUCCESS
    message = Column(String)
    zone = Column(String)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    priority = Column(String)  # High, Medium, Low
    status = Column(String)  # Pending, In Progress, Completed
    assigned_to = Column(Integer, ForeignKey("users.id"))
    deadline = Column(DateTime)


class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(String, unique=True)
    level = Column(Integer, default=1)
    is_occupied = Column(Boolean, default=False)
    type = Column(String)  # Standard, EV, Disabled
    occupancy_data = Column(JSON)


class MallEvent(Base):
    __tablename__ = "mall_events"
    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True)
    payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
