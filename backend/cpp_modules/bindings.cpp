#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "simulation_engine.hpp"
#include "parking_optimizer.hpp"

namespace py = pybind11;

PYBIND11_MODULE(mall_engine, m) {
    m.doc() = "SmartMall AI OS C++ High-Performance Module";

    py::class_<SimulationEngine>(m, "SimulationEngine")
        .def(py::init<>())
        .def("simulate_revenue", &SimulationEngine::simulate_revenue)
        .def("optimize_rents", &SimulationEngine::optimize_rents);

    py::class_<ParkingOptimizer>(m, "ParkingOptimizer")
        .def(py::init<int>())
        .def("allocate_best_slot", &ParkingOptimizer::allocate_best_slot);
}
