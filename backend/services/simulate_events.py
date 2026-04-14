import time
import random
from core.event_bus import bus

def simulate_mall_activity():
    print("Starting Mall Event Simulation...")
    events = [
        ("car_entered", {"lane": "A", "type": "SUV"}),
        ("visitor_spike", {"zone": "Food Court", "increase": "25%"}),
        ("sales_drop", {"shop_id": 24, "drop": "15%"}),
        ("security_alert", {"gate": 3, "level": "warning", "message": "Unidentified bag"}),
        ("parking_full", {"floor": 1})
    ]
    
    while True:
        routing_key, message = random.choice(events)
        bus.publish(routing_key, message)
        print(f"Emitted: {routing_key} -> {message}")
        time.sleep(random.randint(10, 30))

if __name__ == "__main__":
    simulate_mall_activity()
