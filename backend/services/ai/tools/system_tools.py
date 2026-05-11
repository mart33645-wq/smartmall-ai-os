"""System, GitHub, and Vercel tools callable by the AI assistant."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from services.integrations import github, vercel


def get_system_health(db: Session) -> dict[str, Any]:
    """Return overall system health metrics."""
    from models.database import Shop, Task, Alert, ParkingSlot
    from services.parking_stats import build_parking_stats

    total_shops = db.query(Shop).count()
    at_risk = db.query(Shop).filter(Shop.is_at_risk == True).count()  # noqa
    pending_tasks = db.query(Task).filter(Task.status == "Pending").count()
    active_alerts = db.query(Alert).filter(Alert.is_resolved == False).count()  # noqa
    try:
        parking = build_parking_stats(db)
        parking_occupancy = parking.get("occupancy_pct", 0)
    except Exception:
        parking_occupancy = 0

    return {
        "success": True,
        "health": {
            "total_shops": total_shops,
            "shops_at_risk": at_risk,
            "pending_tasks": pending_tasks,
            "active_alerts": active_alerts,
            "parking_occupancy_pct": parking_occupancy,
            "overall_status": (
                "critical" if active_alerts > 5 or at_risk > 3
                else "warning" if at_risk > 0 or pending_tasks > 10
                else "healthy"
            ),
        },
    }


def git_commit_and_push(
    message: str,
    push: bool = True,
) -> dict[str, Any]:
    """Commit all current changes and push to GitHub."""
    if not github.enabled:
        return {
            "success": False,
            "error": "GitHub not configured. Add GITHUB_TOKEN and GITHUB_REPO to .env",
        }
    return github.commit_and_push(message=message, push=push)


def git_rollback(reason: str) -> dict[str, Any]:
    """Create a rollback commit to undo the last AI commit."""
    if not github.enabled:
        return {"success": False, "error": "GitHub not configured"}
    return github.create_rollback_commit(reason=reason)


def git_recent_commits(n: int = 5) -> dict[str, Any]:
    """Get the most recent commits from the repository."""
    if not github.enabled:
        return {"success": False, "error": "GitHub not configured"}
    commits = github.get_recent_commits(n=n)
    return {"success": True, "commits": commits, "count": len(commits)}


def vercel_deploy() -> dict[str, Any]:
    """Trigger a new Vercel deployment."""
    if not vercel.enabled:
        return {
            "success": False,
            "error": "Vercel not configured. Add VERCEL_TOKEN and VERCEL_PROJECT_ID to .env",
        }
    return vercel.trigger_deployment()


def vercel_status(deployment_id: str | None = None) -> dict[str, Any]:
    """Get the status of the latest (or a specific) Vercel deployment."""
    if not vercel.enabled:
        return {"success": False, "error": "Vercel not configured"}
    return vercel.get_deployment_status(deployment_id=deployment_id)


def vercel_recent_deployments(limit: int = 5) -> list[dict[str, Any]]:
    """List recent Vercel deployments."""
    return vercel.get_recent_deployments(limit=limit)
