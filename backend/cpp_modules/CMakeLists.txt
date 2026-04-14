cmake_minimum_required(VERSION 3.10)
project(SmartMallEngine)

set(CMAKE_CXX_STANDARD 17)

# Find pybind11
find_package(pybind11 REQUIRED)

pybind11_add_module(mall_engine bindings.cpp)
