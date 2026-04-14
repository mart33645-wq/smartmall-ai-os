"""Read-only endpoints for the customer web app (no JWT)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db, Shop
from services.crowd_simulation import build_crowd_zones
from services.parking_stats import build_parking_stats

router = APIRouter()


def _shop_card(s: Shop) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "category": s.category,
        "floor": s.floor,
        "gate_hint": f"Gate {1 + (s.id % 4)}",
    }


@router.get("/shops")
def public_shop_directory(db: Session = Depends(get_db)):
    shops = db.query(Shop).order_by(Shop.name).all()
    return {"shops": [_shop_card(s) for s in shops]}


@router.get("/parking")
def public_parking_summary(db: Session = Depends(get_db)):
    return build_parking_stats(db)


@router.get("/offers")
def personalized_offers(db: Session = Depends(get_db)):
    weak = db.query(Shop).filter(Shop.is_at_risk.is_(True)).all()
    top = (
        db.query(Shop)
        .filter(Shop.is_at_risk.is_(False))
        .order_by(Shop.performance_score.desc())
        .limit(3)
        .all()
    )
    offers = []
    for s in weak:
        offers.append(
            {
                "title": f"Boost day at {s.name}",
                "subtitle": "Limited-time mall-backed promo",
                "discount_pct": 15,
                "shop_id": s.id,
            }
        )
    for s in top:
        offers.append(
            {
                "title": f"Trending: {s.name}",
                "subtitle": f"Floor {s.floor} · {s.category}",
                "discount_pct": 5,
                "shop_id": s.id,
            }
        )
    return {"offers": offers[:8]}


@router.get("/crowd-zones")
def public_crowd_zones(db: Session = Depends(get_db)):
    """IoT-style crowd simulation derived from live shop + parking data."""
    return {"zones": build_crowd_zones(db)}


@router.get("/health")
def public_health(db: Session = Depends(get_db)):
    shops_n = db.query(Shop).count()
    return {"mall_online": True, "shops_indexed": shops_n}
