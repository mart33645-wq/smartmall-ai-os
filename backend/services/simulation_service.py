import re
from sqlalchemy.orm import Session
from models.database import Shop, Alert, ParkingSlot
import datetime

class SimulationService:
    @staticmethod
    def run_simulation(db: Session, params: dict):
        """
        Runs a sophisticated revenue and foot traffic simulation based on mall data.
        """
        rent_change = params.get("rent_change", 0.0) # Percentage change (e.g. 0.05 for 5%)
        traffic_multiplier = params.get("traffic_index", 1.0)
        
        shops = db.query(Shop).all()
        total_projected_revenue = 0
        impacts = []

        for shop in shops:
            # Basic Elasticity Model: Higher rent usually reduces foot traffic or profit unless balanced by visitors
            elasticity = 0.5 if shop.category == "Fashion" else 0.3 if shop.category == "Dining" else 0.4
            
            current_rev = shop.daily_revenue
            # New Revenue = Current * (1+TrafficBoost) * (1+RentBoost) - (RentElasticityImpact)
            traffic_effect = (traffic_multiplier - 1.0) * 0.8 # Sensitivity to mall traffic
            rent_effect = rent_change * (1.0 - elasticity)
            
            projected = current_rev * (1.0 + traffic_effect + rent_effect)
            total_projected_revenue += projected
            
            if projected < current_rev * 0.9:
                impacts.append(f"⚠️ {shop.name}: Critical risk if rent increased by {rent_change*100}%.")
            elif projected > current_rev * 1.1:
                impacts.append(f"✅ {shop.name}: Strong growth potential in this scenario.")

        cleaned_impacts = [re.sub(r"^[^A-Za-z0-9$]+", "", impact) for impact in impacts[:3]]

        return {
            "projected_total": total_projected_revenue,
            "status": "Success",
            "timestamp": datetime.datetime.now().isoformat(),
            "insights": cleaned_impacts
        }
