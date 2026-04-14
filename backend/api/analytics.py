import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import Alert, ParkingSlot, Shop, User, get_db
from services.crowd_simulation import build_crowd_zones

router = APIRouter()


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    alerts = db.query(Alert).filter(Alert.is_resolved == False).all()
    slots = db.query(ParkingSlot).all()
    total_revenue = sum(s.daily_revenue for s in shops)
    total_visitors = sum(s.visitor_count for s in shops)
    at_risk = [s for s in shops if s.is_at_risk]
    occupied_slots = [sl for sl in slots if sl.is_occupied]
    return {
        "total_revenue": total_revenue,
        "total_visitors": total_visitors,
        "avg_performance": round(sum(s.performance_score for s in shops) / len(shops), 1) if shops else 0,
        "shops_at_risk": len(at_risk),
        "active_alerts": len(alerts),
        "parking_occupancy": round(len(occupied_slots) / len(slots) * 100, 1) if slots else 0,
        "total_shops": len(shops),
    }


@router.get("/digital-twin")
def digital_twin_zones(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"zones": build_crowd_zones(db)}


@router.get("/revenue-chart")
def revenue_chart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    base = sum(s.daily_revenue for s in shops)
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    multipliers = [0.75, 0.82, 0.88, 0.91, 0.95, 1.35, 1.25]
    return [
        {"day": d, "revenue": round(base * m + random.uniform(-500, 500), 0)}
        for d, m in zip(days, multipliers)
    ]


@router.get("/visitor-trends")
def visitor_trends(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    peak = sum(s.visitor_count for s in shops) if shops else 5000
    hours = range(8, 23)
    curve = [0.1, 0.2, 0.4, 0.6, 0.7, 0.85, 1.0, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.3, 0.2]
    return [
        {"hour": f"{h:02d}:00", "visitors": int(peak * c + random.uniform(-100, 100))}
        for h, c in zip(hours, curve)
    ]


@router.get("/shop-performance")
def shop_performance(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    return [
        {
            "name": s.name,
            "revenue": s.daily_revenue,
            "visitors": s.visitor_count,
            "score": s.performance_score,
            "is_at_risk": s.is_at_risk,
        }
        for s in sorted(shops, key=lambda x: x.daily_revenue, reverse=True)
    ]


@router.get("/ai-recommendations")
def ai_recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    at_risk = [s for s in shops if s.is_at_risk]
    top = sorted(shops, key=lambda x: x.performance_score, reverse=True)[:2]
    recs = []
    for s in at_risk:
        recs.append(
            {
                "type": "WARNING",
                "shop": s.name,
                "action": "Offer 20% temporary rent reduction + joint marketing campaign",
                "impact": "Estimated +35% revenue recovery in 30 days",
            }
        )
    for s in top:
        recs.append(
            {
                "type": "OPPORTUNITY",
                "shop": s.name,
                "action": "Expand to adjacent unit to increase floor space by 40%",
                "impact": f"Estimated +${round(s.daily_revenue * 0.3):,} additional daily revenue",
            }
        )
    recs.append(
        {
            "type": "SYSTEM",
            "shop": "All Zones",
            "action": "Deploy weekend surge pricing (15%) across Food Court",
            "impact": "Projected $12,000 additional monthly revenue",
        }
    )
    return recs


@router.get("/security-insights")
def security_insights(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    critical = db.query(Alert).filter(Alert.is_resolved.is_(False), Alert.type == "CRITICAL").count()
    return {
        "crowd_risk_score": min(100, 40 + critical * 15),
        "abnormal_patterns": critical,
        "recommendation": "Increase security patrols near Food Court" if critical else "Patterns nominal",
    }
