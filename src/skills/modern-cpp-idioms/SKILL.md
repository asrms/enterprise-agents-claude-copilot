---
name: modern-cpp-idioms
description: "Writing modern C++ (C++20 and C++23): value semantics and the rule of zero, auto and type deduction used clearly, strong types and enum class, std::optional, std::variant, and std::expected for results, ranges and algorithms over raw loops, std::span and std::string_view, constexpr and concepts, modules where supported, and following the C++ Core Guidelines with clang-tidy. Use it when writing or reviewing C++ code for clarity, safety, and modern practice."
---

# Skill: Modern C++ Idioms

## Implementation Rules:
- **[MANDATORY]** Target a modern standard (C++20 at minimum, C++23 where compilers support it) set explicitly in the build (`CMAKE_CXX_STANDARD 20` with `CMAKE_CXX_STANDARD_REQUIRED ON`), and follow the C++ Core Guidelines as the team's baseline.
- **[PATTERN]** Prefer value semantics and the rule of zero: classes own resources through members that manage themselves (`std::vector`, `std::string`, smart pointers), so no custom destructor, copy, or move operations are needed.
- **[PATTERN]** Express intent with types: `enum class` instead of plain enums, strong types for identifiers and units, `std::optional<T>` for optional values, `std::variant` for closed alternatives with `std::visit`, and `std::expected<T, E>` (C++23) or a similar result type for recoverable errors.
- **[PATTERN]** Prefer standard algorithms and ranges (`std::ranges::sort`, `std::views::filter`, `std::views::transform`) over hand-written loops, and range-based `for` when iterating.
- **[PATTERN]** Pass non-owning views for read-only data: `std::string_view` and `std::span<const T>` parameters, `const T&` for larger objects, by value for cheap types or when taking ownership (then `std::move`).
- **[PATTERN]** Use `constexpr`, `consteval`, and concepts (`template <std::integral T>`, `requires` clauses) to move checks to compile time and give clear template errors.
- **[FORBIDDEN]** C-style casts (use `static_cast` and friends), macros for constants or functions (use `constexpr` and inline functions), `using namespace std;` in headers, raw arrays for owned buffers, and variadic C functions like `printf` for new code (use `std::format` or `std::print`).
- **[PATTERN]** Mark functions `[[nodiscard]]` when ignoring the result is a bug, `noexcept` when they cannot throw (especially move operations), and single-argument constructors `explicit`.
- **[PATTERN]** Use `auto` where the type is obvious or verbose (iterators, lambdas), but spell types when they carry meaning; initialize every variable, preferring brace initialization for aggregates.
- **[CONFIGURATION]** Enforce style and guidelines with clang-format and clang-tidy (checks such as `cppcoreguidelines-*`, `modernize-*`, `bugprone-*`, `performance-*`, `readability-*`) in CI, and compile with high warning levels treated as errors (`-Wall -Wextra -Wpedantic -Werror` or `/W4 /WX`).
- **[TESTING]** Unit-test public behavior with a framework such as GoogleTest or Catch2, including `static_assert` checks for compile-time guarantees.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
