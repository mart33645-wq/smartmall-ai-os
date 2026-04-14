from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.websocket_manager import manager
from models.database import Alert, ParkingSlot, Shop, Task, User, get_db

router = APIRouter()


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops_count = db.query(Shop).count()
    active_alerts = db.query(Alert).filter(Alert.is_resolved == False).count()
    occupied_slots = db.query(ParkingSlot).filter(ParkingSlot.is_occupied == True).count()
    pending_tasks = db.query(Task).filter(Task.status != "Completed").count()

    tick = datetime.utcnow().minute % 6
    cpu_usage = 28 + tick * 5
    memory_usage = 44 + min(24, pending_tasks * 3)
    request_rate = 180 + shops_count * 12 + active_alerts * 9
    active_services = 4 + (1 if manager.active_connections else 0) + (1 if pending_tasks else 0)

    logs = [
        {
            "level": "INFO",
            "service": "shop-engine",
            "message": f"{shops_count} shops synchronized successfully.",
        },
        {
            "level": "INFO",
            "service": "parking-core",
            "message": f"{occupied_slots} slots currently occupied.",
        },
        {
            "level": "WARNING" if active_alerts else "INFO",
            "service": "alert-hub",
            "message": (
                f"{active_alerts} unresolved alerts require review."
                if active_alerts
                else "No unresolved alerts at the moment."
            ),
        },
    ]

    services = [
        {"name": "Auth Service", "latency_pct": 99.8},
        {"name": "Shop Engine", "latency_pct": 98.9},
        {"name": "AI Pipeline", "latency_pct": 97.4},
        {"name": "Database", "latency_pct": 99.3},
    ]

    return {
        "cpu_usage": f"{cpu_usage}%",
        "memory_usage": f"{memory_usage}%",
        "request_rate": f"{request_rate} req/min",
        "active_containers": active_services,
        "websocket_clients": len(manager.active_connections),
        "logs": logs,
        "services": services,
    }
