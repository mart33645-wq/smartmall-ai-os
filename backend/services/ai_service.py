from sqlalchemy.orm import Session
from models.database import Shop, Alert, ParkingSlot
import random

class AIService:
    @staticmethod
    def analyze_and_respond(db: Session, message: str) -> str:
        msg = message.lower()
        shops = db.query(Shop).all()
        alerts = db.query(Alert).all()
        slots = db.query(ParkingSlot).all()
        
        occupied = [s for s in slots if s.is_occupied]
        parking_pct = (len(occupied) / len(slots) * 100) if slots else 0
        at_risk = [s for s in shops if s.is_at_risk]
        total_rev = sum(s.daily_revenue for s in shops)
        
        # High-level logic refinement
        if any(w in msg for w in ["recommend", "advice", "suggest"]):
            if at_risk:
                return f"🔍 **AI Recommendation:** I've identified {len(at_risk)} at-risk shops. Priority 1: Review {at_risk[0].name}'s traffic trends. I suggest a dynamic rent subsidy based on foot traffic performance."
            return "✅ **AI Recommendation:** All systems are within nominal parameters. I suggest optimizing lighting in Zone B during non-peak hours to save 4% energy cost."

        if any(w in msg for w in ["revenue", "sales", "money"]):
            return f"💰 **Financial Overview:** Total mall revenue today is **${total_rev:,.0f}**. Revenue per visitor is at **${(total_rev/sum(s.visitor_count for s in shops)):.2f}**. This is 5% above the monthly average."

        if "parking" in msg:
            status = "Nominal" if parking_pct < 75 else "Crowded" if parking_pct < 90 else "CRITICAL"
            return f"🚗 **Parking Intelligence:** Load is at **{parking_pct:.1f}%** ({status}). Automated valet routing is currently { 'active' if parking_pct > 80 else 'idle' }."

        return f"Hello. I'm processing your mall data. We have {len(shops)} shops online across {max([s.floor for s in shops]) if shops else 1} floors. How can I assist you with operations today?"
