from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.event_bus import event_bus
from core.realtime import schedule_ws
from models.database import ParkingSlot, User, get_db
from services.event_journal import record_mall_event
from services.parking_stats import build_parking_stats

router = APIRouter()


def slot_to_dict(slot: ParkingSlot) -> dict:
    return {
        "id": slot.id,
        "slot_number": slot.slot_number,
        "level": slot.level or 1,
        "is_occupied": slot.is_occupied,
        "type": slot.type,
    }


@router.get("/")
def list_slots(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    slots = db.query(ParkingSlot).all()
    return [slot_to_dict(s) for s in slots]


@router.get("/stats")
def parking_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return build_parking_stats(db)


@router.post("/{slot_id}/toggle")
def toggle_slot(
    slot_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_occupied = not slot.is_occupied
    db.commit()
    db.refresh(slot)
    stats = build_parking_stats(db)
    routing = "car_entered" if slot.is_occupied else "car_exited"
    event_bus.publish(
        routing,
        {"slot_id": slot.id, "occupied": slot.is_occupied, "user": user.username},
    )
    record_mall_event(db, routing, {"slot_id": slot.id, "occupied": slot.is_occupied})
    if stats["occupancy_pct"] > 90:
        event_bus.publish("parking_full", {"occupancy_pct": stats["occupancy_pct"]})
    schedule_ws(
        background_tasks,
        {"type": "PARKING_UPDATE", "payload": {"slot": slot_to_dict(slot), "stats": stats}},
    )
    return slot_to_dict(slot)
