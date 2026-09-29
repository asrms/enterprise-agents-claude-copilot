---
name: cmake-build
description: "Modern CMake for C and C++ projects: target-based design with target_link_libraries and usage requirements, CMakePresets.json for reproducible configurations, dependency management with vcpkg, Conan, or FetchContent, out-of-source builds, compiler warnings and sanitizers as options, install and export for packaging, compile_commands.json for tooling, ccache, and CI integration. Use it when creating or reviewing CMake-based build systems."
---

# Skill: Modern CMake Builds

## Implementation Rules:
- **[MANDATORY]** Use target-based modern CMake (3.25+): define targets with `add_library`/`add_executable` and attach everything to targets with `target_sources`, `target_include_directories`, `target_compile_features`, `target_compile_options`, and `target_link_libraries` using `PRIVATE`, `PUBLIC`, and `INTERFACE` correctly.
- **[FORBIDDEN]** Directory-wide commands that leak settings (`include_directories`, `link_libraries`, `add_definitions`, global `CMAKE_CXX_FLAGS` edits), `file(GLOB ...)` for sources without `CONFIGURE_DEPENDS` awareness, and in-source builds.
- **[MANDATORY]** Provide `CMakePresets.json` with configure, build, and test presets for common configurations (debug, release, sanitizers, CI) so developers and CI build identically with `cmake --preset <name>`.
- **[PATTERN]** Manage dependencies with a package manager (vcpkg manifest mode with `vcpkg.json` and a baseline, or Conan 2 with lock files) and `find_package` with imported targets; use `FetchContent` for small, header-only, or tightly controlled dependencies with pinned tags or commits.
- **[PATTERN]** Set the language standard per target (`target_compile_features(app PRIVATE cxx_std_23)`) and keep compiler-specific options behind generator expressions (`$<$<CXX_COMPILER_ID:MSVC>:/W4>`).
- **[PATTERN]** Offer build options for quality tooling: warnings as errors, sanitizers (address, undefined, thread), clang-tidy (`CMAKE_CXX_CLANG_TIDY`), coverage, and link-time optimization (`INTERPROCEDURAL_OPTIMIZATION`) enabled by presets rather than hard-coded.
- **[MANDATORY]** Export `compile_commands.json` (`CMAKE_EXPORT_COMPILE_COMMANDS ON`) for clang-tidy, IDEs, and language servers, and speed up builds with ccache or sccache (`CMAKE_CXX_COMPILER_LAUNCHER`) and the Ninja generator.
- **[PATTERN]** Make libraries consumable: namespaced alias targets (`add_library(orders::core ALIAS orders_core)`), `install(TARGETS ... EXPORT ...)`, generated `Config.cmake` and version files, and `$<BUILD_INTERFACE:...>`/`$<INSTALL_INTERFACE:...>` include paths.
- **[PATTERN]** Register tests with CTest (`enable_testing()`, `gtest_discover_tests` or `add_test`) and run them with `ctest --preset` in CI, including labels for unit, integration, and slow tests.
- **[SECURITY]** Enable hardening flags for release builds where supported (stack protector, `_FORTIFY_SOURCE=3` with optimization, position-independent executables, RELRO and now binding on Linux, Control Flow Guard on MSVC) and pin dependency versions to reviewed releases.
- **[TESTING]** CI builds every preset on each supported compiler and platform (GCC, Clang, MSVC as applicable), runs tests and sanitizer builds, and treats warnings as errors.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
