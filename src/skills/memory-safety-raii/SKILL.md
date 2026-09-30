---
name: memory-safety-raii
description: "Memory and resource safety in C++: RAII for every resource, std::unique_ptr and std::shared_ptr ownership rules, no naked new and delete, avoiding dangling references and iterator invalidation, lifetime issues with string_view and span, bounds-checked access, safe handling of C APIs with custom deleters, move semantics, hardened standard library modes, and tooling to detect memory errors. Use it when writing or reviewing C++ code that manages memory or other resources."
---

# Skill: Memory Safety and RAII

## Implementation Rules:
- **[MANDATORY]** Manage every resource (memory, files, sockets, locks, handles) with RAII: acquire in a constructor or factory, release in the destructor, so cleanup happens on every path including exceptions and early returns.
- **[MANDATORY]** Express ownership with types: `std::unique_ptr` for exclusive ownership (created with `std::make_unique`), `std::shared_ptr` only when ownership is genuinely shared (created with `std::make_shared`), raw pointers and references only as non-owning observers.
- **[FORBIDDEN]** Naked `new`/`delete` and `malloc`/`free` in application code, owning raw pointers, manual `delete[]`, and `shared_ptr` cycles without `std::weak_ptr` to break them.
- **[PATTERN]** Wrap C APIs with custom deleters (`std::unique_ptr<FILE, decltype(&std::fclose)>` or a small RAII class) and translate error codes at the boundary.
- **[MANDATORY]** Prevent dangling: never return references or views (`std::string_view`, `std::span`, iterators) to locals or temporaries, do not store views longer than the owner lives, and be careful with lambdas capturing by reference in asynchronous code.
- **[PATTERN]** Avoid iterator and reference invalidation: do not hold iterators or references into containers across insertions or erasures that can reallocate (for example `std::vector::push_back`); use indices or re-fetch after modification, and the erase-remove idiom or `std::erase_if`.
- **[PATTERN]** Implement move operations correctly (or rely on the rule of zero), mark them `noexcept`, leave moved-from objects in a valid state, and do not use objects after moving from them.
- **[SECURITY]** Prefer bounds-checked access in untrusted-input paths (`.at()`, `std::span` with checked helpers), and enable hardened library modes in development and where affordable in production (libc++ hardening modes, `_GLIBCXX_ASSERTIONS`, MSVC checked iterators).
- **[PATTERN]** Use containers and string types instead of manual buffers, `std::array` for fixed sizes, and `std::vector` with `reserve` for dynamic sizes; avoid pointer arithmetic outside low-level, reviewed code.
- **[MANDATORY]** Compile with warnings that catch lifetime problems (`-Wdangling`, `-Wreturn-stack-address`, clang `-Wlifetime` where available) and run static analyzers (clang-tidy, clang static analyzer, MSVC `/analyze`) in CI.
- **[TESTING]** Run tests under AddressSanitizer, UndefinedBehaviorSanitizer, and LeakSanitizer (or Valgrind where sanitizers are unavailable) in CI, and fuzz code that parses untrusted input.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
