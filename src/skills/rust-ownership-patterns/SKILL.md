---
name: rust-ownership-patterns
description: "Idiomatic ownership and API design in Rust: borrowing vs owning in function signatures, lifetimes kept simple, avoiding needless clones, Cow and Arc used deliberately, interior mutability (Cell, RefCell, Mutex, RwLock) only when needed, newtypes and typestate for invariants, iterators over index loops, traits and generics vs dyn, and Clippy-enforced idioms. Use it when writing or reviewing Rust code for clarity, correctness, and zero-cost abstractions."
---

# Skill: Rust Ownership Patterns

## Implementation Rules:
- **[PATTERN]** Choose parameter types by need: borrow (`&str`, `&[T]`, `&T`) when the function only reads, take ownership (`String`, `Vec<T>`) when it stores or consumes the value, and accept `impl AsRef<str>` or `impl Into<String>` for ergonomic public APIs.
- **[PATTERN]** Return owned values from constructors and transformations, and borrowed views (`&str`, slices, iterators) from accessors; avoid returning references tied to complex lifetimes when an owned value is simpler.
- **[FORBIDDEN]** Cloning to silence the borrow checker without understanding the ownership problem, `Rc<RefCell<T>>` graphs as a default architecture, and `unwrap()`/`expect()` on values that can legitimately be absent in production paths.
- **[PATTERN]** Share ownership deliberately: `Arc<T>` for immutable shared data across threads, `Arc<Mutex<T>>` or `Arc<RwLock<T>>` for shared mutable state with short critical sections, and message passing (channels) when ownership can move instead.
- **[PATTERN]** Encode invariants in types: newtypes for identifiers and validated values (`struct Email(String)` with a fallible constructor), enums instead of boolean flags or stringly typed states, and the typestate pattern for protocols where invalid transitions must not compile.
- **[PATTERN]** Prefer iterator chains (`iter().filter().map().collect()`) and slice methods over manual indexing; they are idiomatic, bounds-safe, and optimize well.
- **[PATTERN]** Use generics with trait bounds for static dispatch in hot paths and `dyn Trait` (boxed or referenced) for heterogeneous collections or to reduce code size; keep trait objects object-safe.
- **[PATTERN]** Use `Cow<'_, str>` when a function usually borrows but sometimes needs to allocate, and `Option<&T>` / `as_deref()` to avoid cloning optional values.
- **[MANDATORY]** Keep lifetimes simple: rely on elision, add explicit lifetimes only when needed, and restructure data (owning types, indices, arenas) rather than fighting self-referential structs.
- **[CONFIGURATION]** Enforce idioms with `cargo clippy --all-targets --all-features -- -D warnings` (including `clippy::pedantic` selectively), `rustfmt` in CI, and `#![deny(unsafe_code)]` in crates that do not need unsafe.
- **[TESTING]** Test public APIs of types that encode invariants (constructors rejecting invalid input, typestate transitions) and use doc tests for usage examples.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
