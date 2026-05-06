from __future__ import annotations

from abc import ABC, abstractmethod

from sqlalchemy.orm import Session

from models.database import Shop


class ShopSerializer:
    @staticmethod
    def to_dict(shop: Shop) -> dict:
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


class ShopRiskEvaluator(ABC):
    @abstractmethod
    def is_at_risk(self, shop: Shop) -> bool:
        raise NotImplementedError


class PerformanceThresholdRiskEvaluator(ShopRiskEvaluator):
    def is_at_risk(self, shop: Shop) -> bool:
        return bool(shop.daily_revenue < 2000 or shop.performance_score < 60)


class ShopIntelligenceService:
    def __init__(self, db: Session, evaluator: ShopRiskEvaluator | None = None):
        self._db = db
        self._evaluator = evaluator or PerformanceThresholdRiskEvaluator()

    def assess_shop_risk(self, shop_id: int) -> dict:
        shop = self._db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            raise LookupError("Shop not found")
        shop.is_at_risk = self._evaluator.is_at_risk(shop)
        self._db.commit()
        self._db.refresh(shop)
        return {
            "shop_id": shop_id,
            "is_at_risk": shop.is_at_risk,
            "shop": ShopSerializer.to_dict(shop),
        }

    def assess_all_shops(self) -> dict:
        affected = 0
        at_risk = 0
        shops = self._db.query(Shop).all()
        for shop in shops:
            next_state = self._evaluator.is_at_risk(shop)
            if shop.is_at_risk != next_state:
                affected += 1
            shop.is_at_risk = next_state
            if shop.is_at_risk:
                at_risk += 1
        self._db.commit()
        return {
            "affected": affected,
            "at_risk": at_risk,
            "shops": [ShopSerializer.to_dict(shop) for shop in shops],
        }

    def optimize_rent(self, shop_id: int) -> dict:
        shop = self._db.query(Shop).filter(Shop.id == shop_id).first()
        if not shop:
            raise LookupError("Shop not found")

        old_rent = shop.rent_amount
        if shop.performance_score > 85 and shop.visitor_count > 800:
            shop.rent_amount = round(shop.rent_amount * 1.05, 2)
            recommendation = f"Rent increased by 5% (high performance) from ${old_rent} to ${shop.rent_amount}"
        elif shop.performance_score < 60:
            shop.rent_amount = round(shop.rent_amount * 0.95, 2)
            recommendation = f"Rent decreased by 5% (retention strategy) from ${old_rent} to ${shop.rent_amount}"
        else:
            recommendation = "Rent is optimal; no change needed"

        self._db.commit()
        self._db.refresh(shop)
        return {"shop": ShopSerializer.to_dict(shop), "recommendation": recommendation}
