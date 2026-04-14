from core.event_bus import bus
from services.ai_engine import ai_engine
import json

def handle_car_entry(data):
    print(f"AI Service: Car entered lane {data['lane']}. Recalculating parking occupancy...")
    # Simulation: Update system state

def handle_security(data):
    print(f"AI Service: SECURITY ALERT at gate {data['gate']}: {data['message']}. Notifying security team and optimizing task routes.")

def handle_visitor_spike(data):
    print(f"AI Service: Visitor spike in {data['zone']}. Suggesting staff reallocation.")

def start_consumer():
    print("AI Event Consumer started...")
    # In a real app, these would be in separate threads or async loops
    bus.subscribe("car_entered", handle_car_entry)
    bus.subscribe("security_alert", handle_security)
    bus.subscribe("visitor_spike", handle_visitor_spike)

if __name__ == "__main__":
    start_consumer()
