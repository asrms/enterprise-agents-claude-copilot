# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unchecked pointers and panics across the boundary
```rust
#[unsafe(no_mangle)]
pub extern "C" fn parse_order(json: *const c_char) -> *mut Order {
    let s = unsafe { CStr::from_ptr(json) }.to_str().unwrap();     // null pointer UB, panic on invalid UTF-8
    let order: Order = serde_json::from_str(s).unwrap();            // panic unwinds into C
    &mut order as *mut Order                                        // pointer to a local: dangling after return
}
```
**Why it's wrong:**
- A null or invalid pointer causes undefined behavior, and panics unwind across the C boundary.
- The returned pointer refers to a dropped local, and nobody knows how to free the memory.

## Best Practice (How to do it right)

### 1. Safe core, thin FFI layer with explicit ownership and error codes
```rust
/// Opaque handle for C callers.
pub struct OrderHandle(Order);

#[repr(C)]
pub enum FfiStatus { Ok = 0, NullPointer = 1, InvalidUtf8 = 2, InvalidJson = 3, Panic = 99 }

/// Parses an order from a NUL-terminated UTF-8 JSON string.
///
/// # Safety
/// `json` must be null or point to a valid NUL-terminated string that stays alive during the call.
/// `out` must be a valid, writable pointer. The returned handle must be released with `order_free`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn order_parse(json: *const c_char, out: *mut *mut OrderHandle) -> FfiStatus {
    let result = std::panic::catch_unwind(|| {
        if json.is_null() || out.is_null() {
            return FfiStatus::NullPointer;
        }
        // SAFETY: checked non-null above; the caller guarantees NUL termination and lifetime.
        let text = match unsafe { CStr::from_ptr(json) }.to_str() {
            Ok(t) => t,
            Err(_) => return FfiStatus::InvalidUtf8,
        };
        match parse_order_safe(text) {                                    // pure safe Rust
            Ok(order) => {
                // SAFETY: `out` is non-null and writable per the documented contract.
                unsafe { *out = Box::into_raw(Box::new(OrderHandle(order))) };
                FfiStatus::Ok
            }
            Err(_) => FfiStatus::InvalidJson,
        }
    });
    result.unwrap_or(FfiStatus::Panic)
}

/// # Safety
/// `handle` must come from `order_parse` and must not be used after this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn order_free(handle: *mut OrderHandle) {
    if !handle.is_null() {
        // SAFETY: the pointer was created by Box::into_raw in order_parse and is freed exactly once.
        drop(unsafe { Box::from_raw(handle) });
    }
}
```
```bash
cbindgen --lang c --output include/orders.h        # generated header for C callers
cargo +nightly miri test ffi::                      # detect undefined behavior in unsafe paths
```
**Why it's right:**
- All logic is safe Rust; the FFI layer validates inputs, returns status codes, and never unwinds into C.
- Memory ownership is explicit with a matching free function, and every unsafe block states its safety argument.
