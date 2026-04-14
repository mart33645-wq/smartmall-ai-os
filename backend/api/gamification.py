from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from core.deps import get_current_user
from models.database import Shop, User, get_db

router = APIRouter()


@router.get("/summary")
def loyalty_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    shops = db.query(Shop).all()
    total_visitors = sum(s.visitor_count for s in shops) or 0
    points = int(total_visitors * 0.12 + len(shops) * 80 + (500 if user.role == "Admin" else 0))
    target = max(15000, points + 2000)
    progress = min(100, int(points / target * 100))
    tier = "Platinum" if points > 12000 else "Gold" if points > 8000 else "Silver"
    return {
        "points": points,
        "tier_label": tier,
        "next_reward_progress_pct": progress,
        "next_reward_label": "$50 mall voucher",
        "engagement_streak_days": 7,
    }


@router.post("/redeem")
def redeem_reward(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reward = payload.get("reward", "voucher_50")
    return {
        "ok": True,
        "message": f"Redeem request recorded for {reward}. Validate at concierge within 24h.",
        "username": user.username,
    }


@router.get("/history")
def loyalty_history(user: User = Depends(get_current_user)):
    return {
        "transactions": [
            {"when": "2026-04-10", "delta": 120, "reason": "Weekend traffic goal"},
            {"when": "2026-04-08", "delta": 80, "reason": "Parking app engagement"},
            {"when": "2026-04-05", "delta": 200, "reason": "AI task completion streak"},
        ]
    }
