#include <vector>
#include <string>

struct ParkingSlot {
    int id;
    bool is_occupied;
    std::string type; // "Standard", "EV", "Disabled"
};

class ParkingOptimizer {
public:
    ParkingOptimizer(int total_slots) {
        for (int i = 0; i < total_slots; ++i) {
            slots.push_back({i, false, "Standard"});
        }
    }

    // Predicts the best slot for an incoming vehicle based on proximity to entrances
    int allocate_best_slot(const std::string& vehicle_type) {
        for (auto& slot : slots) {
            if (!slot.is_occupied) {
                if (vehicle_type == "EV" && slot.type == "EV") return slot.id;
                if (vehicle_type == "Standard") return slot.id;
            }
        }
        return -1; // No slot available
    }

private:
    std::vector<ParkingSlot> slots;
};
