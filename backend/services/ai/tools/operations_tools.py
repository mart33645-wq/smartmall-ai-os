"""AI tool implementations — Task, Alert, Parking management tools."""
from __future__ import annotations

import datetime
from typing import Any

from sqlalchemy.orm import Session

from models.database import Task, Alert, ParkingSlot
from services.task_management import TaskManagementService
from services.parking_stats import build_parking_stats


# ── TASK TOOLS ────────────────────────────────────────────────────────────────

def create_task(
    db: Session,
    title: str,
    description: str = "",
    priority: str = "Medium",
    assigned_to: int | None = None,
    deadline_days: int = 7,
) -> dict[str, Any]:
    """Create a new task."""
    try:
        deadline = (
            datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=deadline_days)
        ).replace(tzinfo=None).isoformat()
        task = TaskManagementService(db).create_task({
            "title": title.strip(),
            "description": description,
            "priority": priority,
            "status": "Pending",
            "assigned_to": assigned_to,
            "deadline": deadline,
        })
        return {"success": True, "task": task}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def complete_tasks(
    db: Session,
    task_ids: list[int] | None = None,
    all_pending: bool = False,
) -> dict[str, Any]:
    """Complete specific tasks or all pending tasks."""
    query = db.query(Task).filter(Task.status != "Completed")
    if task_ids:
        query = query.filter(Task.id.in_(task_ids))
    elif not all_pending:
        return {"success": False, "error": "Provide task_ids or set all_pending=true"}
    tasks = query.all()
    for t in tasks:
        t.status = "Completed"
    db.commit()
    return {"success": True, "completed_count": len(tasks)}


def start_tasks(db: Session, task_ids: list[int] | None = None, limit: int = 10) -> dict[str, Any]:
    """Move pending tasks to In Progress."""
    query = db.query(Task).filter(Task.status == "Pending")
    if task_ids:
        query = query.filter(Task.id.in_(task_ids))
    else:
        query = query.limit(limit)
    tasks = query.all()
    for t in tasks:
        t.status = "In Progress"
    db.commit()
    return {"success": True, "started_count": len(tasks)}


def list_tasks(
    db: Session,
    status: str | None = None,
    priority: str | None = None,
) -> dict[str, Any]:
    """List tasks with optional status/priority filters."""
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    tasks = query.order_by(Task.priority.desc()).limit(50).all()
    return {
        "success": True,
        "count": len(tasks),
        "tasks": [
            {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority}
            for t in tasks
        ],
    }


# ── ALERT TOOLS ───────────────────────────────────────────────────────────────

def list_alerts(db: Session, unresolved_only: bool = True) -> dict[str, Any]:
    """List alerts."""
    query = db.query(Alert)
    if unresolved_only:
        query = query.filter(Alert.is_resolved == False)  # noqa: E712
    alerts = query.order_by(Alert.created_at.desc()).limit(20).all()
    return {
        "success": True,
        "count": len(alerts),
        "alerts": [
            {"id": a.id, "type": a.type, "message": a.message, "zone": a.zone}
            for a in alerts
        ],
    }


def resolve_alerts(
    db: Session,
    alert_ids: list[int] | None = None,
    resolve_all: bool = False,
) -> dict[str, Any]:
    """Resolve specific alerts or all unresolved alerts."""
    query = db.query(Alert).filter(Alert.is_resolved == False)  # noqa: E712
    if alert_ids:
        query = query.filter(Alert.id.in_(alert_ids))
    elif not resolve_all:
        return {"success": False, "error": "Provide alert_ids or set resolve_all=true"}
    alerts = query.all()
    for a in alerts:
        a.is_resolved = True
    db.commit()
    return {"success": True, "resolved_count": len(alerts)}


def create_alert(
    db: Session,
    alert_type: str,
    message: str,
    zone: str = "General",
) -> dict[str, Any]:
    """Create a new system alert."""
    try:
        alert = Alert(
            type=alert_type.upper(),
            message=message.strip(),
            zone=zone,
            is_resolved=False,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return {"success": True, "alert_id": alert.id, "type": alert.type}
    except Exception as exc:
        db.rollback()
        return {"success": False, "error": str(exc)}


# ── PARKING TOOLS ─────────────────────────────────────────────────────────────

def get_parking_stats(db: Session) -> dict[str, Any]:
    """Get real-time parking statistics."""
    try:
        stats = build_parking_stats(db)
        return {"success": True, **stats}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def free_all_slots(db: Session) -> dict[str, Any]:
    """Mark all occupied parking slots as free."""
    slots = db.query(ParkingSlot).filter(ParkingSlot.is_occupied == True).all()  # noqa: E712
    for s in slots:
        s.is_occupied = False
    db.commit()
    return {"success": True, "freed_count": len(slots)}


def toggle_slot(db: Session, slot_id: int) -> dict[str, Any]:
    """Toggle a single parking slot occupancy."""
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        return {"success": False, "error": f"Slot {slot_id} not found"}
    slot.is_occupied = not slot.is_occupied
    db.commit()
    db.refresh(slot)
    return {
        "success": True,
        "slot_number": slot.slot_number,
        "is_occupied": slot.is_occupied,
    }
