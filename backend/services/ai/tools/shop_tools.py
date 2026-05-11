"""AI tool implementations — Shop management tools callable by the AI."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from models.database import Shop


def add_shop(
    db: Session,
    name: str,
    category: str = "Other",
    floor: int = 1,
    rent_amount: float = 5000,
    actor_user_id: int | None = None,
) -> dict[str, Any]:
    """Add a new shop to the mall system."""
    try:
        shop = Shop(
            name=name.strip(),
            category=category,
            floor=max(1, min(20, floor)),
            rent_amount=max(100, float(rent_amount)),
            daily_revenue=0,
            visitor_count=0,
            performance_score=75,
            owner_id=actor_user_id,
        )
        db.add(shop)
        db.commit()
        db.refresh(shop)
        return {
            "success": True,
            "id": shop.id,
            "name": shop.name,
            "category": shop.category,
            "floor": shop.floor,
            "rent_amount": shop.rent_amount,
        }
    except Exception as exc:
        db.rollback()
        return {"success": False, "error": str(exc)}


def edit_shop(
    db: Session,
    shop_id: int,
    name: str | None = None,
    category: str | None = None,
    floor: int | None = None,
) -> dict[str, Any]:
    """Edit an existing shop's details."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        return {"success": False, "error": f"Shop {shop_id} not found"}
    if name:
        shop.name = name.strip()
    if category:
        shop.category = category
    if floor is not None:
        shop.floor = max(1, min(20, floor))
    db.commit()
    db.refresh(shop)
    return {"success": True, "shop": {"id": shop.id, "name": shop.name, "floor": shop.floor}}


def delete_shop(db: Session, shop_id: int) -> dict[str, Any]:
    """Delete a shop. Requires explicit confirmation (handled by caller)."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        return {"success": False, "error": f"Shop {shop_id} not found"}
    name = shop.name
    db.delete(shop)
    db.commit()
    return {"success": True, "deleted_shop": name, "id": shop_id}


def update_rent(
    db: Session,
    shop_id: int,
    new_rent: float | None = None,
    change_percent: float | None = None,
) -> dict[str, Any]:
    """Update a single shop's rent (absolute value or percent change)."""
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        return {"success": False, "error": f"Shop {shop_id} not found"}
    old_rent = shop.rent_amount
    if new_rent is not None:
        shop.rent_amount = max(100, float(new_rent))
    elif change_percent is not None:
        shop.rent_amount = round(old_rent * (1 + change_percent / 100), 2)
    else:
        return {"success": False, "error": "Provide new_rent or change_percent"}
    db.commit()
    db.refresh(shop)
    return {
        "success": True,
        "shop": shop.name,
        "old_rent": old_rent,
        "new_rent": shop.rent_amount,
        "change_percent": round((shop.rent_amount - old_rent) / old_rent * 100, 1),
    }


def bulk_update_rent(
    db: Session,
    change_percent: float,
    category: str | None = None,
    floor: int | None = None,
) -> dict[str, Any]:
    """Update rent for multiple shops filtered by category/floor."""
    query = db.query(Shop)
    if category:
        query = query.filter(Shop.category == category)
    if floor is not None:
        query = query.filter(Shop.floor == floor)
    shops = query.all()
    if not shops:
        return {"success": True, "affected_shops": 0, "message": "No shops matched the filter"}
    for s in shops:
        s.rent_amount = round(s.rent_amount * (1 + change_percent / 100), 2)
    db.commit()
    return {
        "success": True,
        "affected_shops": len(shops),
        "change_percent": change_percent,
        "category_filter": category,
        "floor_filter": floor,
    }


def list_shops(
    db: Session,
    floor: int | None = None,
    category: str | None = None,
    at_risk_only: bool = False,
) -> dict[str, Any]:
    """List shops with optional filters."""
    query = db.query(Shop)
    if floor is not None:
        query = query.filter(Shop.floor == floor)
    if category:
        query = query.filter(Shop.category == category)
    if at_risk_only:
        query = query.filter(Shop.is_at_risk == True)  # noqa: E712
    shops = query.order_by(Shop.floor, Shop.name).all()
    return {
        "success": True,
        "count": len(shops),
        "shops": [
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "floor": s.floor,
                "rent_amount": s.rent_amount,
                "performance_score": s.performance_score,
                "is_at_risk": getattr(s, "is_at_risk", False),
            }
            for s in shops
        ],
    }
