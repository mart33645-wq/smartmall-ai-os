from sqlalchemy.orm import Session

from models.database import MallEvent


def record_mall_event(db: Session, event_type: str, payload: dict) -> None:
    db.add(MallEvent(event_type=event_type, payload=payload or {}))
    db.commit()
