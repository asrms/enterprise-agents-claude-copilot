# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Old-style global CMake
```cmake
cmake_minimum_required(VERSION 2.8)
project(shop)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -std=c++11 -O2")   # global flags for everything
include_directories(${CMAKE_SOURCE_DIR}/include /usr/local/include/json)
file(GLOB SRC src/*.cpp)
add_executable(shop ${SRC})
target_link_libraries(shop /usr/local/lib/libjson.a pthread)   # absolute paths to system libraries
```
**Why it's wrong:**
- Global settings leak to every target, dependencies are hard-coded paths that break on other machines, and the standard is outdated.
- There are no presets, tests, warnings, or reproducible dependency versions.

## Best Practice (How to do it right)

### 1. Target-based project with vcpkg and presets
`CMakeLists.txt`:
```cmake
cmake_minimum_required(VERSION 3.25)
project(shop VERSION 1.4.0 LANGUAGES CXX)

option(SHOP_WARNINGS_AS_ERRORS "Treat warnings as errors" ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

find_package(nlohmann_json CONFIG REQUIRED)
find_package(GTest CONFIG REQUIRED)

add_library(shop_core src/order.cpp src/pricing.cpp)
add_library(shop::core ALIAS shop_core)
target_compile_features(shop_core PUBLIC cxx_std_23)
target_include_directories(shop_core PUBLIC
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_link_libraries(shop_core PUBLIC nlohmann_json::nlohmann_json)
target_compile_options(shop_core PRIVATE
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic -Wconversion $<$<BOOL:${SHOP_WARNINGS_AS_ERRORS}>:-Werror>>
  $<$<CXX_COMPILER_ID:MSVC>:/W4 $<$<BOOL:${SHOP_WARNINGS_AS_ERRORS}>:/WX>>)

add_executable(shop src/main.cpp)
target_link_libraries(shop PRIVATE shop::core)

enable_testing()
add_executable(shop_tests tests/order_test.cpp)
target_link_libraries(shop_tests PRIVATE shop::core GTest::gtest_main)
include(GoogleTest)
gtest_discover_tests(shop_tests)
```
`CMakePresets.json` (excerpt):
```json
{
  "version": 6,
  "configurePresets": [
    { "name": "base", "hidden": true, "generator": "Ninja", "binaryDir": "build/${presetName}",
      "toolchainFile": "$env{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake",
      "cacheVariables": { "CMAKE_CXX_COMPILER_LAUNCHER": "ccache" } },
    { "name": "debug", "inherits": "base", "cacheVariables": { "CMAKE_BUILD_TYPE": "Debug" } },
    { "name": "asan", "inherits": "debug",
      "cacheVariables": { "CMAKE_CXX_FLAGS": "-fsanitize=address,undefined -fno-omit-frame-pointer" } },
    { "name": "release", "inherits": "base",
      "cacheVariables": { "CMAKE_BUILD_TYPE": "Release", "CMAKE_INTERPROCEDURAL_OPTIMIZATION": "ON" } }
  ],
  "buildPresets": [ { "name": "debug", "configurePreset": "debug" }, { "name": "release", "configurePreset": "release" } ],
  "testPresets": [ { "name": "debug", "configurePreset": "debug", "output": { "outputOnFailure": true } } ]
}
```
```bash
cmake --preset debug && cmake --build --preset debug && ctest --preset debug
```
**Why it's right:**
- Settings are attached to targets with correct visibility, dependencies come from vcpkg as imported targets, and warnings are strict.
- Presets make configurations reproducible across developers and CI, and tests are discovered by CTest.
