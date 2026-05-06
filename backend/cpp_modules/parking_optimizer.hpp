#pragma once

#include <algorithm>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

// ============================================================
// OOP pillars showcase in C++
//
// - Abstraction: `Vehicle` + `SlotAllocationStrategy` are abstract interfaces.
// - Inheritance: Concrete vehicles/strategies derive from them.
// - Polymorphism: Optimizer allocates via virtual `choose_slot(...)`.
// - Encapsulation: `ParkingOptimizer` hides slots & occupancy transitions behind methods.
// ============================================================

enum class SlotType {
    Standard,
    EV,
    Disabled
};

class ParkingSlot {
public:
    ParkingSlot(int id, SlotType type)
        : id_(id), occupied_(false), type_(type) {}

    int id() const { return id_; }
    SlotType type() const { return type_; }
    bool is_occupied() const { return occupied_; }

    void occupy() { occupied_ = true; }
    void release() { occupied_ = false; }

private:
    // (Encapsulation) Internal fields are private and changed only via methods.
    int id_;
    bool occupied_;
    SlotType type_;
};

// (Abstraction) A vehicle "contract": what the optimizer needs to know.
class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual std::string name() const = 0;
    virtual SlotType preferred_slot_type() const = 0;
};

// (Inheritance) Concrete vehicles.
class StandardVehicle final : public Vehicle {
public:
    std::string name() const override { return "Standard"; }
    SlotType preferred_slot_type() const override { return SlotType::Standard; }
};

class EVVehicle final : public Vehicle {
public:
    std::string name() const override { return "EV"; }
    SlotType preferred_slot_type() const override { return SlotType::EV; }
};

class DisabledVehicle final : public Vehicle {
public:
    std::string name() const override { return "Disabled"; }
    SlotType preferred_slot_type() const override { return SlotType::Disabled; }
};

// (Abstraction) Strategy interface: different allocation policies share the same API.
class SlotAllocationStrategy {
public:
    virtual ~SlotAllocationStrategy() = default;

    // Return a slot index in `slots` or -1 if none.
    virtual int choose_slot(const Vehicle& vehicle, const std::vector<ParkingSlot>& slots) const = 0;
};

// (Inheritance) Strategy #1: try preferred type first, fallback to any Standard.
class PreferTypeThenFallbackStrategy final : public SlotAllocationStrategy {
public:
    int choose_slot(const Vehicle& vehicle, const std::vector<ParkingSlot>& slots) const override {
        // Prefer exact match
        for (size_t i = 0; i < slots.size(); ++i) {
            if (!slots[i].is_occupied() && slots[i].type() == vehicle.preferred_slot_type()) {
                return static_cast<int>(i);
            }
        }
        // Fallback: any standard
        for (size_t i = 0; i < slots.size(); ++i) {
            if (!slots[i].is_occupied() && slots[i].type() == SlotType::Standard) {
                return static_cast<int>(i);
            }
        }
        return -1;
    }
};

// (Inheritance) Strategy #2: first free slot regardless of type.
class FirstFreeSlotStrategy final : public SlotAllocationStrategy {
public:
    int choose_slot(const Vehicle&, const std::vector<ParkingSlot>& slots) const override {
        for (size_t i = 0; i < slots.size(); ++i) {
            if (!slots[i].is_occupied()) return static_cast<int>(i);
        }
        return -1;
    }
};

class ParkingOptimizer {
public:
    explicit ParkingOptimizer(int total_slots)
        : strategy_(std::make_unique<PreferTypeThenFallbackStrategy>()) {
        if (total_slots <= 0) throw std::invalid_argument("total_slots must be > 0");

        // Create some dedicated slots (simple distribution).
        const int ev_slots = std::max(1, total_slots / 10);
        const int disabled_slots = std::max(1, total_slots / 20);

        int id = 0;
        for (int i = 0; i < disabled_slots && id < total_slots; ++i, ++id) {
            slots_.emplace_back(id, SlotType::Disabled);
        }
        for (int i = 0; i < ev_slots && id < total_slots; ++i, ++id) {
            slots_.emplace_back(id, SlotType::EV);
        }
        for (; id < total_slots; ++id) {
            slots_.emplace_back(id, SlotType::Standard);
        }
    }

    // (Polymorphism) Allocation behavior depends on the chosen strategy at runtime.
    int allocate_best_slot(const Vehicle& vehicle) {
        const int idx = strategy_->choose_slot(vehicle, slots_);
        if (idx < 0) return -1;

        slots_[static_cast<size_t>(idx)].occupy();
        return slots_[static_cast<size_t>(idx)].id();
    }

    bool release_slot(int slot_id) {
        auto it = std::find_if(slots_.begin(), slots_.end(), [&](const ParkingSlot& s) { return s.id() == slot_id; });
        if (it == slots_.end()) return false;
        it->release();
        return true;
    }

    void set_strategy(std::unique_ptr<SlotAllocationStrategy> strategy) {
        if (!strategy) throw std::invalid_argument("strategy must not be null");
        strategy_ = std::move(strategy);
    }

    int total_slots() const { return static_cast<int>(slots_.size()); }

private:
    // (Encapsulation) Slots + strategy are private; callers can't corrupt state accidentally.
    std::vector<ParkingSlot> slots_;
    std::unique_ptr<SlotAllocationStrategy> strategy_;
};
