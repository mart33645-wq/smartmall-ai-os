import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from core.cache import _lock, _store
from core.deps import get_current_user
from core.event_bus import event_bus
from core.realtime import schedule_ws
from models.database import Shop, User, get_db
from services.event_journal import record_mall_event
from services.shop_management import ShopIntelligenceService, ShopSerializer

router = APIRouter()

_SHOP_CACHE_KEYS = (
    "analytics_overview",
    "shop_performance",
    "ai_recommendations",
    "digital_twin_zones",
)


def _bust_shop_caches() -> None:
    """Invalidate all analytics caches that depend on shop data."""
    with _lock:
        for key in _SHOP_CACHE_KEYS:
            _store.pop(key, None)


def shop_to_dict(shop: Shop) -> dict:
    return ShopSerializer.to_dict(shop)


@router.get("/")
def list_shops(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> List[dict]:
    return [shop_to_dict(shop) for shop in db.query(Shop).all()]


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
    try:
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
        _bust_shop_caches()
        schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": shop_to_dict(shop)})
        return shop_to_dict(shop)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
    _bust_shop_caches()
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
    _bust_shop_caches()
    schedule_ws(background_tasks, {"type": "SHOP_DELETED", "payload": {"id": shop_id}})
    return {"message": "Shop deleted successfully"}


@router.post("/{shop_id}/optimize-rent")
def optimize_rent(
    shop_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        result = ShopIntelligenceService(db).optimize_rent(shop_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _bust_shop_caches()
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": result["shop"]})
    return result


@router.post("/{shop_id}/risk-check")
def risk_check(
    shop_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        result = ShopIntelligenceService(db).assess_shop_risk(shop_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _bust_shop_caches()
    schedule_ws(background_tasks, {"type": "SHOP_UPDATE", "payload": result["shop"]})
    return {"shop_id": shop_id, "is_at_risk": result["is_at_risk"]}
