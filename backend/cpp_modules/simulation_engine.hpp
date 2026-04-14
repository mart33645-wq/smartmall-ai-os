#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

class SimulationEngine {
public:
    SimulationEngine() {}

    // Simulates the revenue outcome of a decision (e.g., changing rent or adding a shop)
    double simulate_revenue(double current_revenue, double rent_change, double traffic_index) {
        // Simple linear model for simulation
        // In a real scenario, this would be a more complex Monte Carlo or ODE based simulation
        double outcome = current_revenue * (1.0 + (rent_change * 0.5) + (traffic_index * 0.2));
        return outcome;
    }

    // Optimization: Find the best rent adjustment for a set of shops to maximize total revenue
    std::vector<double> optimize_rents(const std::vector<double>& current_rents, const std::vector<double>& store_performances) {
        std::vector<double> optimized_rents;
        for (size_t i = 0; i < current_rents.size(); ++i) {
            double adjustment = (store_performances[i] > 0.8) ? 1.05 : 0.95;
            optimized_rents.push_back(current_rents[i] * adjustment);
        }
        return optimized_rents;
    }
};
