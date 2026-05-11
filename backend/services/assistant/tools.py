"""
SmartMall AI Tool Executor
--------------------------
Defines every operation the AI can perform as a Gemini-compatible
function declaration, then executes whatever Gemini decides to call.

No keyword patterns. Pure intent understanding.
"""
from __future__ import annotations

import datetime
from typing import Any

from sqlalchemy.orm import Session

from models.database import Alert, ParkingSlot, Shop, Task
from services.ai.tools import system_tools
from services.task_management import TaskManagementService

# Tools that do not mutate mall data or external systems — any authenticated user may run.
_READ_ONLY_TOOLS = frozenset(
    {
        "list_shops",
        "list_tasks",
        "get_system_health",
        "git_recent_commits",
        "vercel_status",
        "vercel_recent_deployments",
    }
)


# ── Gemini function declarations (sent as "tools") ───────────────────────────

TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "add_shop",
        "description": "Add a new shop / store to the mall system.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "STRING", "description": "Shop name"},
                "category": {
                    "type": "STRING",
                    "description": "Category such as Food & Beverage, Fashion, Electronics, Pharmacy, Entertainment, Jewelry, Sports, Beauty & Wellness, Kids & Toys, Other",
                },
                "floor": {"type": "INTEGER", "description": "Floor number (1-10)"},
                "rent_amount": {"type": "NUMBER", "description": "Monthly rent in EGP"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "delete_shop",
        "description": "Remove / close a shop permanently from the mall.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "shop_name": {"type": "STRING", "description": "Name or partial name of the shop to delete"},
            },
            "required": ["shop_name"],
        },
    },
    {
        "name": "adjust_shop_rent",
        "description": "Raise or lower rent for a specific shop by a percentage.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "shop_name": {"type": "STRING", "description": "Name or partial name of the shop"},
                "percent": {
                    "type": "NUMBER",
                    "description": "Percentage to change rent. Positive = raise, negative = lower. Example: 10 means +10%, -5 means -5%.",
                },
            },
            "required": ["shop_name", "percent"],
        },
    },
    {
        "name": "adjust_all_rents",
        "description": "Raise or lower rent for ALL shops by a percentage.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "percent": {
                    "type": "NUMBER",
                    "description": "Percentage to change. Positive = raise, negative = lower.",
                },
            },
            "required": ["percent"],
        },
    },
    {
        "name": "set_shop_rent",
        "description": "Set a specific absolute rent amount for a shop.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "shop_name": {"type": "STRING", "description": "Name or partial name of the shop"},
                "rent_amount": {"type": "NUMBER", "description": "New rent amount in EGP"},
            },
            "required": ["shop_name", "rent_amount"],
        },
    },
    {
        "name": "add_task",
        "description": "Create a new task / maintenance job in the system.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title": {"type": "STRING", "description": "Task title"},
                "description": {"type": "STRING", "description": "Optional task details"},
                "priority": {
                    "type": "STRING",
                    "description": "Priority level: Low, Medium, or High",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "complete_tasks",
        "description": "Mark tasks as completed.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "filter": {
                    "type": "STRING",
                    "description": "Which tasks to complete: 'all', 'pending', or 'in_progress'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "start_tasks",
        "description": "Move pending tasks to 'In Progress' status.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "count": {"type": "INTEGER", "description": "How many tasks to start (default: all pending)"},
            },
            "required": [],
        },
    },
    {
        "name": "resolve_alerts",
        "description": "Mark all unresolved alerts as resolved.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "severity": {
                    "type": "STRING",
                    "description": "Filter by severity: 'all', 'CRITICAL', 'WARNING', 'INFO'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "free_parking",
        "description": "Free / vacate occupied parking slots.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "count": {"type": "INTEGER", "description": "How many slots to free (default: all occupied)"},
            },
            "required": [],
        },
    },
    {
        "name": "list_shops",
        "description": "Get a list of shops in the mall, optionally filtered.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "filter": {
                    "type": "STRING",
                    "description": "Optional filter: 'all', 'at_risk', or a category name or floor number like 'floor:2'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "list_tasks",
        "description": "Get a list of tasks, optionally filtered by status.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {
                    "type": "STRING",
                    "description": "Filter by status: 'all', 'Pending', 'In Progress', 'Completed'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "update_shop",
        "description": "Update a shop's details (category, floor, or performance score).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "shop_name": {"type": "STRING", "description": "Name or partial name of the shop"},
                "category": {"type": "STRING", "description": "New category (optional)"},
                "floor": {"type": "INTEGER", "description": "New floor number (optional)"},
                "performance_score": {"type": "NUMBER", "description": "New performance score 0-100 (optional)"},
                "daily_revenue": {"type": "NUMBER", "description": "Update daily revenue (optional)"},
            },
            "required": ["shop_name"],
        },
    },
    {
        "name": "get_system_health",
        "description": "Read-only snapshot of mall operational health (shops at risk, tasks, alerts, parking occupancy).",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
    {
        "name": "git_commit_and_push",
        "description": "Stage changes, commit with a message, and push to GitHub (admin only; requires GITHUB_TOKEN).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "message": {"type": "STRING", "description": "Commit message describing the change"},
            },
            "required": ["message"],
        },
    },
    {
        "name": "git_rollback",
        "description": "Revert the last commit via git revert and push (admin only).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "reason": {"type": "STRING", "description": "Short reason recorded in logs"},
            },
            "required": ["reason"],
        },
    },
    {
        "name": "git_recent_commits",
        "description": "List recent commit SHAs and messages from the configured repository.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"n": {"type": "INTEGER", "description": "How many commits (default 5)"}},
            "required": [],
        },
    },
    {
        "name": "vercel_deploy",
        "description": "Trigger a new Vercel deployment (admin only; requires VERCEL_TOKEN and project id).",
        "parameters": {"type": "OBJECT", "properties": {}, "required": []},
    },
    {
        "name": "vercel_status",
        "description": "Get the latest or a specific Vercel deployment status.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "deployment_id": {"type": "STRING", "description": "Optional deployment UID; omit for latest"},
            },
            "required": [],
        },
    },
    {
        "name": "vercel_recent_deployments",
        "description": "List recent Vercel deployments with state and URL.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"limit": {"type": "INTEGER", "description": "Max rows (default 5)"}},
            "required": [],
        },
    },
]


# ── Executor ─────────────────────────────────────────────────────────────────

class ToolExecutor:
    def __init__(self, db: Session, actor_user_id: int | None = None, actor_role: str | None = None):
        self._db = db
        self._actor_user_id = actor_user_id
        self._actor_role = (actor_role or "").strip()

    def _is_admin(self) -> bool:
        return self._actor_role.casefold() == "admin"

    def execute(self, function_name: str, args: dict[str, Any]) -> dict[str, Any]:
        if function_name not in _READ_ONLY_TOOLS and not self._is_admin():
            return {
                "success": False,
                "error": "This operation requires an administrator account.",
                "requires_admin": True,
            }
        handler = getattr(self, f"_tool_{function_name}", None)
        if handler is None:
            return {"success": False, "error": f"Unknown tool: {function_name}"}
        try:
            return handler(**args)
        except Exception as exc:
            self._db.rollback()
            return {"success": False, "error": str(exc)}

    # ── Shop tools ────────────────────────────────────────────────────────────

    def _tool_add_shop(self, name: str, category: str = "Other", floor: int = 1, rent_amount: float = 5000.0) -> dict:
        shop = Shop(
            name=name,
            category=category,
            floor=max(1, min(10, int(floor))),
            rent_amount=max(100.0, float(rent_amount)),
            daily_revenue=0,
            visitor_count=0,
            performance_score=75,
            owner_id=self._actor_user_id,
        )
        self._db.add(shop)
        self._db.commit()
        self._db.refresh(shop)
        return {
            "success": True,
            "action": "add_shop",
            "shop_id": shop.id,
            "name": shop.name,
            "category": shop.category,
            "floor": shop.floor,
            "rent_amount": shop.rent_amount,
        }

    def _tool_delete_shop(self, shop_name: str) -> dict:
        shop = self._find_shop(shop_name)
        if not shop:
            return {"success": False, "error": f"No shop found matching '{shop_name}'"}
        name = shop.name
        self._db.delete(shop)
        self._db.commit()
        return {"success": True, "action": "delete_shop", "deleted_shop": name}

    def _tool_adjust_shop_rent(self, shop_name: str, percent: float) -> dict:
        shop = self._find_shop(shop_name)
        if not shop:
            return {"success": False, "error": f"No shop found matching '{shop_name}'"}
        old_rent = shop.rent_amount
        shop.rent_amount = round(old_rent * (1 + float(percent) / 100), 2)
        self._db.commit()
        return {
            "success": True,
            "action": "adjust_shop_rent",
            "shop": shop.name,
            "old_rent": old_rent,
            "new_rent": shop.rent_amount,
            "change_percent": percent,
        }

    def _tool_adjust_all_rents(self, percent: float) -> dict:
        shops = self._db.query(Shop).all()
        for s in shops:
            s.rent_amount = round(s.rent_amount * (1 + float(percent) / 100), 2)
        self._db.commit()
        return {
            "success": True,
            "action": "adjust_all_rents",
            "affected_shops": len(shops),
            "change_percent": percent,
        }

    def _tool_set_shop_rent(self, shop_name: str, rent_amount: float) -> dict:
        shop = self._find_shop(shop_name)
        if not shop:
            return {"success": False, "error": f"No shop found matching '{shop_name}'"}
        old_rent = shop.rent_amount
        shop.rent_amount = round(float(rent_amount), 2)
        self._db.commit()
        return {
            "success": True,
            "action": "set_shop_rent",
            "shop": shop.name,
            "old_rent": old_rent,
            "new_rent": shop.rent_amount,
        }

    def _tool_update_shop(
        self,
        shop_name: str,
        category: str | None = None,
        floor: int | None = None,
        performance_score: float | None = None,
        daily_revenue: float | None = None,
    ) -> dict:
        shop = self._find_shop(shop_name)
        if not shop:
            return {"success": False, "error": f"No shop found matching '{shop_name}'"}
        updated: list[str] = []
        if category is not None:
            shop.category = category
            updated.append(f"category={category}")
        if floor is not None:
            shop.floor = max(1, min(10, int(floor)))
            updated.append(f"floor={shop.floor}")
        if performance_score is not None:
            shop.performance_score = max(0, min(100, float(performance_score)))
            updated.append(f"performance={shop.performance_score}")
        if daily_revenue is not None:
            shop.daily_revenue = max(0.0, float(daily_revenue))
            updated.append(f"daily_revenue={shop.daily_revenue}")
        self._db.commit()
        return {"success": True, "action": "update_shop", "shop": shop.name, "updated_fields": updated}

    def _tool_list_shops(self, filter: str = "all") -> dict:
        query = self._db.query(Shop)
        if filter == "at_risk":
            shops = [s for s in query.all() if s.is_at_risk]
        elif filter and filter.startswith("floor:"):
            fl = int(filter.split(":")[1])
            shops = query.filter(Shop.floor == fl).all()
        elif filter and filter not in ("all", ""):
            shops = query.filter(Shop.category.ilike(f"%{filter}%")).all()
        else:
            shops = query.all()
        return {
            "success": True,
            "action": "list_shops",
            "count": len(shops),
            "shops": [
                {
                    "id": s.id,
                    "name": s.name,
                    "category": s.category,
                    "floor": s.floor,
                    "rent": s.rent_amount,
                    "daily_revenue": s.daily_revenue,
                    "performance": s.performance_score,
                    "at_risk": s.is_at_risk,
                }
                for s in shops
            ],
        }

    # ── Task tools ────────────────────────────────────────────────────────────

    def _tool_add_task(self, title: str, description: str = "", priority: str = "Medium") -> dict:
        if priority not in ("Low", "Medium", "High"):
            priority = "Medium"
        task = TaskManagementService(self._db).create_task({
            "title": title,
            "description": description,
            "priority": priority,
            "status": "Pending",
            "assigned_to": self._actor_user_id,
            "deadline": (datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=7)).replace(tzinfo=None).isoformat(),
        })
        return {"success": True, "action": "add_task", "task": task, "priority": priority}

    def _tool_complete_tasks(self, filter: str = "all") -> dict:
        q = self._db.query(Task)
        if filter == "pending":
            q = q.filter(Task.status == "Pending")
        elif filter == "in_progress":
            q = q.filter(Task.status == "In Progress")
        else:
            q = q.filter(Task.status != "Completed")
        tasks = q.all()
        for t in tasks:
            t.status = "Completed"
        self._db.commit()
        return {"success": True, "action": "complete_tasks", "completed_count": len(tasks)}

    def _tool_start_tasks(self, count: int = 0) -> dict:
        q = self._db.query(Task).filter(Task.status == "Pending")
        if count and count > 0:
            q = q.limit(count)
        tasks = q.all()
        for t in tasks:
            t.status = "In Progress"
        self._db.commit()
        return {"success": True, "action": "start_tasks", "started_count": len(tasks)}

    def _tool_list_tasks(self, status: str = "all") -> dict:
        q = self._db.query(Task)
        if status and status != "all":
            q = q.filter(Task.status == status)
        tasks = q.all()
        return {
            "success": True,
            "action": "list_tasks",
            "count": len(tasks),
            "tasks": [
                {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority}
                for t in tasks
            ],
        }

    # ── Alert tools ───────────────────────────────────────────────────────────

    def _tool_resolve_alerts(self, severity: str = "all") -> dict:
        q = self._db.query(Alert).filter(Alert.is_resolved == False)
        if severity and severity != "all":
            q = q.filter(Alert.type == severity)
        alerts = q.all()
        for a in alerts:
            a.is_resolved = True
        self._db.commit()
        return {"success": True, "action": "resolve_alerts", "resolved_count": len(alerts)}

    # ── Parking tools ─────────────────────────────────────────────────────────

    def _tool_free_parking(self, count: int = 0) -> dict:
        q = self._db.query(ParkingSlot).filter(ParkingSlot.is_occupied.is_(True))
        if count and count > 0:
            q = q.limit(count)
        slots = q.all()
        for slot in slots:
            slot.is_occupied = False
        self._db.commit()
        return {"success": True, "action": "free_parking", "freed_count": len(slots)}

    # ── System / integrations (see services.ai.tools.system_tools) ───────────

    def _tool_get_system_health(self) -> dict:
        return system_tools.get_system_health(self._db)

    def _tool_git_commit_and_push(self, message: str, push: bool = True) -> dict:
        return system_tools.git_commit_and_push(message=message, push=push)

    def _tool_git_rollback(self, reason: str) -> dict:
        return system_tools.git_rollback(reason=reason)

    def _tool_git_recent_commits(self, n: int = 5) -> dict:
        return system_tools.git_recent_commits(n=n)

    def _tool_vercel_deploy(self) -> dict:
        return system_tools.vercel_deploy()

    def _tool_vercel_status(self, deployment_id: str | None = None) -> dict:
        return system_tools.vercel_status(deployment_id=deployment_id)

    def _tool_vercel_recent_deployments(self, limit: int = 5) -> dict:
        rows = system_tools.vercel_recent_deployments(limit=limit)
        return {"success": True, "action": "vercel_recent_deployments", "deployments": rows, "count": len(rows)}

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _find_shop(self, name_query: str) -> Shop | None:
        shops = self._db.query(Shop).all()
        q = name_query.lower().strip()
        # Exact match first
        for s in shops:
            if s.name and s.name.lower() == q:
                return s
        # Contains match
        for s in shops:
            if s.name and q in s.name.lower():
                return s
        # Word-level match
        for s in shops:
            if s.name:
                for word in q.split():
                    if len(word) > 2 and word in s.name.lower():
                        return s
        return None
