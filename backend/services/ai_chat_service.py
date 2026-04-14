from sqlalchemy.orm import Session

from models.database import Alert, ParkingSlot, Shop


class AIChatService:
    @staticmethod
    def analyze_and_respond(db: Session, message: str) -> str:
        msg = message.lower().strip()
        shops = db.query(Shop).all()
        alerts = db.query(Alert).all()
        slots = db.query(ParkingSlot).all()

        occupied = [slot for slot in slots if slot.is_occupied]
        parking_pct = (len(occupied) / len(slots) * 100) if slots else 0
        at_risk = [shop for shop in shops if shop.is_at_risk]
        total_revenue = sum(shop.daily_revenue for shop in shops)
        total_visitors = sum(shop.visitor_count for shop in shops) or 1

        if any(word in msg for word in ["recommend", "advice", "suggest", "اقتراح", "نصيحة", "اقترح"]):
            if at_risk:
                return (
                    f"AI Recommendation: I found {len(at_risk)} at-risk shops. "
                    f"Start with {at_risk[0].name} and review traffic trends before rent optimization."
                )
            return (
                "AI Recommendation: Operations are stable. "
                "Focus on energy optimization in low-traffic zones during off-peak hours."
            )

        if any(word in msg for word in ["revenue", "sales", "money", "ايراد", "إيراد", "مبيعات"]):
            return (
                f"Financial Overview: Total mall revenue today is ${total_revenue:,.0f}. "
                f"Revenue per visitor is ${total_revenue / total_visitors:.2f}."
            )

        if "parking" in msg or "مواقف" in msg:
            status = "Nominal" if parking_pct < 75 else "Crowded" if parking_pct < 90 else "Critical"
            valet_status = "active" if parking_pct > 80 else "idle"
            return f"Parking Intelligence: Load is {parking_pct:.1f}% ({status}). Automated valet routing is {valet_status}."

        if "alert" in msg or "تنبيه" in msg:
            unresolved = len([alert for alert in alerts if not alert.is_resolved])
            return f"Alert Overview: There are {unresolved} unresolved alerts that still need review."

        floors = max([shop.floor for shop in shops], default=1)
        return (
            "Hello. I'm processing your mall data. "
            f"We have {len(shops)} shops online across {floors} floors. "
            "How can I help with mall operations today?"
        )
