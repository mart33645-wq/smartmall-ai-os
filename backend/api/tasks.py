import datetime

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import Task, User, get_db

router = APIRouter()


def task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "assigned_to": task.assigned_to,
        "deadline": task.deadline.isoformat() if task.deadline else None,
    }


@router.get("/")
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [task_to_dict(t) for t in db.query(Task).all()]


@router.post("/")
def create_task(data: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deadline = None
    if data.get("deadline"):
        try:
            deadline = datetime.datetime.fromisoformat(data["deadline"])
        except Exception:
            deadline = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    task = Task(
        title=data["title"],
        description=data.get("description", ""),
        priority=data.get("priority", "Medium"),
        status="Pending",
        assigned_to=data.get("assigned_to"),
        deadline=deadline,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@router.patch("/{task_id}/status")
def update_status(
    task_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = data["status"]
    db.commit()
    return task_to_dict(task)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}
