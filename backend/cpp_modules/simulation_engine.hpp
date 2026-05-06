#pragma once

#include <algorithm>
#include <memory>
#include <numeric>
#include <random>
#include <stdexcept>
#include <utility>
#include <vector>

// ============================================================
// OOP pillars showcase in C++
//
// - Abstraction: `RevenueModel` is an abstract interface.
// - Inheritance: `LinearRevenueModel` and `MonteCarloRevenueModel` derive from it.
// - Polymorphism: `SimulationEngine` calls `RevenueModel::simulate(...)` virtually.
// - Encapsulation: `SimulationEngine` owns internal state privately and exposes safe APIs.
// ============================================================

// (Abstraction) Pure-virtual interface: callers depend on "what it does", not "how it does it".
class RevenueModel {
public:
    virtual ~RevenueModel() = default;

    // (Polymorphism entrypoint) Different models implement different revenue simulation logic.
    virtual double simulate(double current_revenue, double rent_change, double traffic_index) const = 0;
};

// (Inheritance) A concrete implementation of the abstraction.
class LinearRevenueModel final : public RevenueModel {
public:
    double simulate(double current_revenue, double rent_change, double traffic_index) const override {
        // Simple linear model
        return current_revenue * (1.0 + (rent_change * 0.5) + (traffic_index * 0.2));
    }
};

// (Inheritance) Another concrete implementation (stochastic).
class MonteCarloRevenueModel final : public RevenueModel {
public:
    explicit MonteCarloRevenueModel(unsigned int seed = std::random_device{}(), int samples = 250)
        : rng_(seed), samples_(samples) {
        if (samples_ <= 0) {
            throw std::invalid_argument("samples must be > 0");
        }
    }

    double simulate(double current_revenue, double rent_change, double traffic_index) const override {
        // Toy Monte Carlo: sample a small noise term around the linear outcome.
        // This keeps example self-contained while demonstrating alternative implementations.
        std::normal_distribution<double> noise(0.0, 0.03); // 3% stddev

        const double base = current_revenue * (1.0 + (rent_change * 0.5) + (traffic_index * 0.2));
        double acc = 0.0;
        for (int i = 0; i < samples_; ++i) {
            acc += base * (1.0 + noise(rng_));
        }
        return acc / static_cast<double>(samples_);
    }

private:
    // (Encapsulation) Even though this model has state, it's private and controlled.
    // `mutable` is used because `simulate` is const but still needs to advance RNG.
    mutable std::mt19937 rng_;
    int samples_;
};

class SimulationEngine {
public:
    // Default to a linear model (keeps existing behavior by default).
    SimulationEngine()
        : model_(std::make_unique<LinearRevenueModel>()) {}

    // Dependency injection: swap behavior at runtime without changing engine code.
    explicit SimulationEngine(std::unique_ptr<RevenueModel> model)
        : model_(std::move(model)) {
        if (!model_) {
            throw std::invalid_argument("model must not be null");
        }
    }

    // (Encapsulation) Public API validates inputs and hides internal details.
    void set_context(double current_revenue, double traffic_index) {
        if (current_revenue < 0.0) throw std::invalid_argument("current_revenue must be >= 0");
        if (traffic_index < 0.0) throw std::invalid_argument("traffic_index must be >= 0");
        current_revenue_ = current_revenue;
        traffic_index_ = traffic_index;
    }

    double current_revenue() const { return current_revenue_; }
    double traffic_index() const { return traffic_index_; }

    // (Polymorphism) Engine delegates to abstract model; actual behavior depends on concrete type.
    double simulate_revenue(double rent_change) const {
        return model_->simulate(current_revenue_, rent_change, traffic_index_);
    }

    void set_model(std::unique_ptr<RevenueModel> model) {
        if (!model) throw std::invalid_argument("model must not be null");
        model_ = std::move(model);
    }

    // Optimization: Find the best rent adjustment for a set of shops to maximize total revenue
    std::vector<double> optimize_rents(
        const std::vector<double>& current_rents,
        const std::vector<double>& store_performances
    ) const {
        std::vector<double> optimized_rents;
        optimized_rents.reserve(current_rents.size());

        const size_t n = std::min(current_rents.size(), store_performances.size());
        for (size_t i = 0; i < n; ++i) {
            double adjustment = (store_performances[i] > 0.8) ? 1.05 : 0.95;
            optimized_rents.push_back(current_rents[i] * adjustment);
        }
        return optimized_rents;
    }

private:
    // (Encapsulation) Internal state is private, not directly mutable by callers.
    double current_revenue_ = 0.0;
    double traffic_index_ = 0.0;
    std::unique_ptr<RevenueModel> model_;
};
