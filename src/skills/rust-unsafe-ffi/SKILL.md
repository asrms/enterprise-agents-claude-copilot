---
name: rust-unsafe-ffi
description: "Using unsafe Rust and foreign function interfaces responsibly: minimizing and encapsulating unsafe blocks behind safe abstractions, documenting safety invariants with SAFETY comments, FFI with C via bindgen and cbindgen, ownership and memory across the boundary, panics and errors at FFI boundaries, #[repr(C)] layouts, and verifying with Miri, sanitizers, and fuzzing. Use it when writing or reviewing unsafe code or bindings between Rust and C, C++, or other languages."
---

# Skill: Unsafe Rust and FFI

## Implementation Rules:
- **[MANDATORY]** Avoid `unsafe` unless it is required (FFI, performance-critical code proven by benchmarks, low-level data structures); crates that do not need it declare `#![forbid(unsafe_code)]`.
- **[MANDATORY]** Keep every `unsafe` block as small as possible and precede it with a `// SAFETY:` comment explaining which invariants make it sound; public `unsafe fn`s document their preconditions in a `# Safety` section.
- **[PATTERN]** Encapsulate unsafe code in a small module behind a safe API whose invariants are enforced by types and checks, so callers cannot trigger undefined behavior through safe code.
- **[PATTERN]** Generate bindings instead of writing them by hand: `bindgen` for calling C from Rust (in a `-sys` crate), `cbindgen` for exposing Rust to C, and `cxx` or `autocxx` for safer C++ interop; `uniffi` or `PyO3`/`napi-rs` for other language bindings.
- **[MANDATORY]** Make ownership across the boundary explicit: document who allocates and frees each pointer, provide matching free functions for memory allocated in Rust (`Box::into_raw` / `Box::from_raw`, `CString::into_raw` / `CString::from_raw`), and never free Rust memory with C `free` or vice versa.
- **[MANDATORY]** Validate everything coming from foreign code: null pointers, lengths, UTF-8 (`CStr::to_str`), alignment, and lifetimes of borrowed buffers; convert to safe Rust types immediately.
- **[FORBIDDEN]** Letting panics unwind across `extern "C"` boundaries (catch with `std::panic::catch_unwind` and return error codes, or use `extern "C-unwind"` deliberately), creating references to uninitialized or unaligned memory, transmuting between unrelated types, and assuming Rust struct layout without `#[repr(C)]`.
- **[PATTERN]** Use `#[repr(C)]` for structs and enums shared with C, fixed-size integer types (`i32`, `u64`, `c_int` from `std::ffi` or `libc`), and opaque handle types for Rust objects exposed to C.
- **[SECURITY]** Treat FFI boundaries as trust boundaries: fuzz the foreign-facing API, keep third-party C libraries updated for security fixes, and link them with hardening flags.
- **[PATTERN]** Prefer safe abstractions from the ecosystem (`bytemuck` for plain-old-data casts, `zerocopy`, `std::ptr::NonNull`, `MaybeUninit`) over hand-rolled pointer manipulation.
- **[TESTING]** Run tests under Miri (`cargo +nightly miri test`) for unsafe code paths, run AddressSanitizer or ThreadSanitizer builds for FFI integration tests, and fuzz parsers and boundary functions with `cargo fuzz`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
