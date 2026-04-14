import datetime

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.event_bus import event_bus
from core.realtime import schedule_ws
from models.database import Alert, User, get_db
from services.event_journal import record_mall_event

router = APIRouter()


def alert_to_dict(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "type": alert.type,
        "message": alert.message,
        "zone": alert.zone,
        "is_resolved": alert.is_resolved,
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
    }


@router.get("/")
def list_alerts(
    resolved: bool = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Alert)
    if resolved is not None:
        query = query.filter(Alert.is_resolved == resolved)
    return [alert_to_dict(a) for a in query.order_by(Alert.created_at.desc()).all()]


@router.post("/")
def create_alert(
    background_tasks: BackgroundTasks,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = Alert(
        type=data.get("type", "INFO"),
        message=data["message"],
        zone=data.get("zone", "General"),
        is_resolved=False,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    event_bus.publish("alert_triggered", {"alert_id": alert.id, "type": alert.type, "zone": alert.zone})
    record_mall_event(
        db,
        "alert_triggered",
        {"alert_id": alert.id, "type": alert.type, "by": user.username},
    )
    schedule_ws(background_tasks, {"type": "ALERT", "payload": alert_to_dict(alert)})
    return alert_to_dict(alert)


@router.patch("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_resolved = True
    db.commit()
    schedule_ws(background_tasks, {"type": "ALERT_RESOLVED", "payload": {"id": alert_id}})
    return alert_to_dict(alert)


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    schedule_ws(background_tasks, {"type": "ALERT_DELETED", "payload": {"id": alert_id}})
    return {"message": "Alert deleted"}
