from __future__ import annotations

import datetime
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from models.database import Alert, Task


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.UTC).replace(tzinfo=None)


class TaskSerializer:
    @staticmethod
    def to_dict(task: Task) -> dict:
        return {
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "priority": task.priority,
            "status": task.status,
            "assigned_to": task.assigned_to,
            "deadline": task.deadline.isoformat() if task.deadline else None,
        }


class TaskPrioritizer(ABC):
    @abstractmethod
    def score(self, task: Task, *, active_alerts: int, now: datetime.datetime) -> float:
        raise NotImplementedError

    @abstractmethod
    def sort_key(self, task: Task) -> tuple[int, datetime.datetime, int]:
        raise NotImplementedError

    @abstractmethod
    def priority_for_score(self, score: float) -> str:
        raise NotImplementedError


class ContextAwareTaskPrioritizer(TaskPrioritizer):
    def score(self, task: Task, *, active_alerts: int, now: datetime.datetime) -> float:
        score = 0.0
        score += {"High": 30, "Medium": 15, "Low": 5}.get(task.priority, 10)
        score += {"In Progress": 20, "Pending": 10, "Completed": -100}.get(task.status, 0)
        if task.deadline:
            hours_left = (task.deadline - now).total_seconds() / 3600
            if hours_left <= 0:
                score += 60
            elif hours_left <= 24:
                score += 45
            elif hours_left <= 72:
                score += 25
            elif hours_left <= 168:
                score += 10
        score += min(active_alerts * 2, 20)
        return score

    def sort_key(self, task: Task) -> tuple[int, datetime.datetime, int]:
        status_rank = {"In Progress": 0, "Pending": 1, "Completed": 2}.get(task.status, 3)
        deadline = task.deadline or datetime.datetime.max
        priority_rank = {"High": 0, "Medium": 1, "Low": 2}.get(task.priority, 3)
        return (status_rank, deadline, priority_rank)

    def priority_for_score(self, score: float) -> str:
        if score >= 70:
            return "High"
        if score >= 35:
            return "Medium"
        return "Low"


class TaskManagementService:
    def __init__(self, db: Session, prioritizer: TaskPrioritizer | None = None):
        self._db = db
        self._prioritizer = prioritizer or ContextAwareTaskPrioritizer()

    def list_tasks(self) -> list[dict]:
        tasks = sorted(self._db.query(Task).all(), key=self._prioritizer.sort_key)
        return [TaskSerializer.to_dict(task) for task in tasks]

    def create_task(self, data: dict) -> dict:
        deadline = None
        if data.get("deadline"):
            try:
                deadline = datetime.datetime.fromisoformat(str(data["deadline"]))
            except Exception:
                deadline = _utcnow() + datetime.timedelta(days=7)

        task = Task(
            title=data["title"],
            description=data.get("description", ""),
            priority=data.get("priority", "Medium"),
            status=data.get("status", "Pending"),
            assigned_to=data.get("assigned_to"),
            deadline=deadline,
        )
        self._db.add(task)
        self._db.commit()
        self._db.refresh(task)
        return TaskSerializer.to_dict(task)

    def optimize_priorities(self) -> dict:
        now = _utcnow()
        active_alerts = self._db.query(Alert).filter(Alert.is_resolved.is_(False)).count()
        tasks = self._db.query(Task).all()

        optimized = 0
        for task in tasks:
            if task.status == "Completed":
                continue
            score = self._prioritizer.score(task, active_alerts=active_alerts, now=now)
            next_priority = self._prioritizer.priority_for_score(score)
            if task.priority != next_priority:
                task.priority = next_priority
                optimized += 1

        self._db.commit()
        ordered_tasks = sorted(
            self._db.query(Task).all(),
            key=lambda task: (-self._prioritizer.score(task, active_alerts=active_alerts, now=now),)
            + self._prioritizer.sort_key(task),
        )
        return {
            "optimized": optimized,
            "tasks": [TaskSerializer.to_dict(task) for task in ordered_tasks],
        }

    def update_status(self, task_id: int, status: str) -> dict:
        task = self._db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise LookupError("Task not found")
        task.status = status
        self._db.commit()
        self._db.refresh(task)
        return TaskSerializer.to_dict(task)

    def delete_task(self, task_id: int) -> None:
        task = self._db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise LookupError("Task not found")
        self._db.delete(task)
        self._db.commit()
