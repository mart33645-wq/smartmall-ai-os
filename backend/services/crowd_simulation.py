from sqlalchemy.orm import Session

from models.database import Alert, ParkingSlot, Shop


def build_crowd_zones(db: Session) -> list[dict]:
    shops = db.query(Shop).all()
    slots = db.query(ParkingSlot).all()
    zones = []
    color_cycle = ("sky", "pink", "amber", "orange", "violet", "emerald", "rose", "indigo")
    for i, s in enumerate(shops[:8]):
        density = min(99, max(8, int(s.visitor_count / 25 + s.performance_score / 5)))
        zones.append(
            {
                "id": f"S-{s.id:02d}",
                "name": s.name,
                "density": density,
                "color": color_cycle[i % len(color_cycle)],
            }
        )
    occ_pct = 0
    if slots:
        occ_pct = int(round(100 * sum(1 for x in slots if x.is_occupied) / len(slots)))
    zones.append({"id": "P-01", "name": "Parking L1–L3", "density": occ_pct, "color": "indigo"})
    open_alerts = db.query(Alert).filter(Alert.is_resolved.is_(False), Alert.type == "CRITICAL").count()
    zones.append(
        {
            "id": "A-01",
            "name": "Main Atrium",
            "density": min(99, 55 + open_alerts * 8),
            "color": "rose",
        }
    )
    return zones
