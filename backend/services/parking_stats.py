import random
from sqlalchemy.orm import Session

from models.database import ParkingSlot


def build_parking_stats(db: Session) -> dict:
    all_slots = db.query(ParkingSlot).all()
    occupied = [s for s in all_slots if s.is_occupied]
    ev_slots = [s for s in all_slots if s.type == "EV"]
    ev_occupied = [s for s in ev_slots if s.is_occupied]
    pct = round(len(occupied) / len(all_slots) * 100, 1) if all_slots else 0
    return {
        "total": len(all_slots),
        "occupied": len(occupied),
        "available": len(all_slots) - len(occupied),
        "occupancy_pct": pct,
        "ev_total": len(ev_slots),
        "ev_occupied": len(ev_occupied),
        "prediction_next_hour": round(min(100, pct + random.uniform(5, 15)), 1),
        "status": "CRITICAL" if pct > 90 else ("WARNING" if pct > 75 else "NORMAL"),
    }
