import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from core.deps import get_current_user
from core.event_bus import event_bus
from core.realtime import schedule_ws
from models.database import Shop, User, get_db
from services.event_journal import record_mall_event

router = APIRouter()


def shop_to_dict(shop: Shop) -> dict:
    return {
        "id": shop.id,
        "name": shop.name,
        "category": shop.category,
        "floor": shop.floor,
        "rent_amount": shop.rent_amount,
        "is_at_risk": shop.is_at_risk,
        "daily_revenue": shop.daily_revenue,
        "visitor_count": shop.visitor_count,
        "performance_score": shop.performance_score,
        "updated_at": shop.updated_at.isoformat() if shop.updated_at else None,
    }


@router.get("/")
def list_shops(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> List[dict]:
    return [shop_to_dict(s) for s in db.query(Shop).all()]


@router.get("/{shop_id}")
def get_shop(shop_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop_to_dict(shop)


@router.post("/")
def create_shop(
    background_tasks: BackgroundTasks,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    shop = Shop(
        name=data["name"],
        category=data.get("category", "Other"),
        floor=int(data.get("floor", 1)),
        rent_amount=float(data.get("rent_amount", 5000)),
        daily_revenue=float(data.get("daily_revenue", 0) or 0),
        visitor_count=int(data.get("visitor_count", 0) or 0),
        performance_score=float(data.get("performance_score", 100) or 100),
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)
    event_bus.publish("visitor_spike", {"shop_id": shop.id, "action": "shop_created"})
    record_mall_event(db, "shop_created", {"shop_id": shop.id, "by": user.username})
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": shop_to_dict(shop)})
    return shop_to_dict(shop)


@router.put("/{shop_id}")
def update_shop(
    shop_id: int,
    background_tasks: BackgroundTasks,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    before_rev = shop.daily_revenue
    for key, value in data.items():
        if hasattr(shop, key) and key not in ("id",):
            setattr(shop, key, value)
    shop.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(shop)
    if shop.daily_revenue < before_rev * 0.85 and before_rev > 0:
        event_bus.publish(
            "sales_drop",
            {"shop_id": shop.id, "name": shop.name, "before": before_rev, "after": shop.daily_revenue},
        )
        record_mall_event(
            db,
            "sales_drop",
            {"shop_id": shop.id, "before": before_rev, "after": shop.daily_revenue},
        )
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": shop_to_dict(shop)})
    return shop_to_dict(shop)


@router.delete("/{shop_id}")
def delete_shop(
    shop_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    db.delete(shop)
    db.commit()
    event_bus.publish("shop_deleted", {"shop_id": shop_id})
    record_mall_event(db, "shop_deleted", {"shop_id": shop_id, "by": user.username})
    schedule_ws(background_tasks, {"type": "SHOP_DELETED", "payload": {"id": shop_id}})
    return {"message": "Shop deleted successfully"}


@router.post("/{shop_id}/optimize-rent")
def optimize_rent(
    shop_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    old_rent = shop.rent_amount
    if shop.performance_score > 85 and shop.visitor_count > 800:
        shop.rent_amount = round(shop.rent_amount * 1.05, 2)
        msg = f"Rent increased by 5% (high performance) from ${old_rent} to ${shop.rent_amount}"
    elif shop.performance_score < 60:
        shop.rent_amount = round(shop.rent_amount * 0.95, 2)
        msg = f"Rent decreased by 5% (retention strategy) from ${old_rent} to ${shop.rent_amount}"
    else:
        msg = "Rent is optimal — no change needed"
    shop.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(shop)
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": shop_to_dict(shop)})
    return {"shop": shop_to_dict(shop), "recommendation": msg}


@router.post("/{shop_id}/risk-check")
def risk_check(
    shop_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    shop = db.query(Shop).filter(Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_at_risk = shop.daily_revenue < 2000 or shop.performance_score < 60
    db.commit()
    db.refresh(shop)
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": shop_to_dict(shop)})
    return {"shop_id": shop_id, "is_at_risk": shop.is_at_risk}
