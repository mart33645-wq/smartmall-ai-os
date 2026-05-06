from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import User, get_db
from services.task_management import TaskManagementService

router = APIRouter()


@router.get("/")
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return TaskManagementService(db).list_tasks()


@router.post("/")
def create_task(data: dict = Body(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return TaskManagementService(db).create_task(data)


@router.post("/optimize-priority")
def optimize_priority(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return TaskManagementService(db).optimize_priorities()


@router.patch("/{task_id}/status")
def update_status(
    task_id: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return TaskManagementService(db).update_status(task_id, data["status"])
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        TaskManagementService(db).delete_task(task_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"message": "Task deleted"}
