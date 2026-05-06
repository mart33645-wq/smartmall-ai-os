import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from core.cache import response_cache, _cached_set  # noqa: F401
from core.deps import get_current_user
from core.event_bus import event_bus
from core.realtime import schedule_ws
from models.database import ParkingSlot, User, get_db
from services.event_journal import record_mall_event
from services.parking_stats import build_parking_stats

router = APIRouter()
logger = logging.getLogger(__name__)

_SLOTS_TTL = 4   # seconds – cached list of all slots (read-heavy)
_STATS_TTL = 4   # seconds – parking stats summary


def slot_to_dict(slot: ParkingSlot) -> dict:
    return {
        "id": slot.id,
        "slot_number": slot.slot_number,
        "level": slot.level or 1,
        "is_occupied": slot.is_occupied,
        "type": slot.type,
    }


def clear_parking_caches() -> None:
    # Keep parking reads and dashboard aggregates fresh after writes.
    from core.cache import _lock, _store

    with _lock:
        _store.pop("parking_list_slots", None)
        _store.pop("parking_stats", None)
        _store.pop("analytics_overview", None)


def safe_side_effect(name: str, action) -> None:
    try:
        action()
    except Exception:
        logger.exception("Parking side effect failed: %s", name)


@router.get("/")
def list_slots(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    with response_cache("parking_list_slots", ttl=_SLOTS_TTL) as c:
        if c.hit:
            return c.value
        slots = db.query(ParkingSlot).all()
        result = [slot_to_dict(s) for s in slots]
        c.store(result)
        return result


@router.get("/stats")
def parking_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    with response_cache("parking_stats", ttl=_STATS_TTL) as c:
        if c.hit:
            return c.value
        result = build_parking_stats(db)
        c.store(result)
        return result


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
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(slot)
    stats = build_parking_stats(db)
    clear_parking_caches()

    routing = "car_entered" if slot.is_occupied else "car_exited"
    payload = {"slot_id": slot.id, "occupied": slot.is_occupied, "user": user.username}

    safe_side_effect("event_bus.publish", lambda: event_bus.publish(routing, payload))
    safe_side_effect(
        "record_mall_event",
        lambda: record_mall_event(db, routing, {"slot_id": slot.id, "occupied": slot.is_occupied}),
    )
    if stats["occupancy_pct"] > 90:
        safe_side_effect(
            "event_bus.publish_parking_full",
            lambda: event_bus.publish("parking_full", {"occupancy_pct": stats["occupancy_pct"]}),
        )
    safe_side_effect(
        "schedule_ws",
        lambda: schedule_ws(
            background_tasks,
            {"type": "PARKING_UPDATE", "payload": {"slot": slot_to_dict(slot), "stats": stats}},
        ),
    )
    return slot_to_dict(slot)
