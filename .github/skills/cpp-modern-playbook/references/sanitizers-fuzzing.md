# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Parser shipped with only happy-path tests
```text
- Invoice importer parses customer-uploaded CSV and XML files; tests use 3 well-formed samples
- No sanitizer builds; a crash report from production shows a segfault in parse_field()
- Fix: added "if (len > 1024) return;" at the crash site; no test added
```
**Why it's wrong:**
- Untrusted input is parsed without fuzzing or sanitizers, so memory errors reach production.
- The fix patches one symptom without finding the root cause or preventing regressions.

## Best Practice (How to do it right)

### 1. libFuzzer harness with a round-trip invariant
`fuzz/csv_fuzzer.cpp`:
```cpp
#include <cstddef>
#include <cstdint>
#include <string_view>
#include "invoice/csv.hpp"

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t* data, std::size_t size) {
    std::string_view input(reinterpret_cast<const char*>(data), size);
    auto parsed = invoice::parse_csv(input);                     // must never crash or trigger UB
    if (parsed) {
        auto again = invoice::parse_csv(invoice::to_csv(*parsed));
        if (!again || *again != *parsed) __builtin_trap();       // invariant: serialize/parse round trip
    }
    return 0;
}
```
```cmake
add_executable(csv_fuzzer fuzz/csv_fuzzer.cpp)
target_link_libraries(csv_fuzzer PRIVATE invoice_core)
target_compile_options(csv_fuzzer PRIVATE -fsanitize=fuzzer,address,undefined -fno-omit-frame-pointer -g)
target_link_options(csv_fuzzer PRIVATE -fsanitize=fuzzer,address,undefined)
```
```bash
mkdir -p corpus && cp testdata/csv/*.csv corpus/
./build/fuzz/csv_fuzzer corpus/ -dict=fuzz/csv.dict -max_total_time=600 -jobs=4
# crash: ./crash-8f2a... -> minimize, then add as regression test
./build/fuzz/csv_fuzzer -minimize_crash=1 -runs=100000 crash-8f2a...
cp minimized-from-8f2a... testdata/csv/regressions/quoted-field-overflow.csv
```
### 2. Sanitizer job in CI
```bash
cmake --preset asan && cmake --build --preset asan
ASAN_OPTIONS=detect_leaks=1:abort_on_error=1 UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=1 ctest --preset asan
```
**Why it's right:**
- The harness targets the untrusted-input API directly, checks an invariant, and runs with ASan and UBSan.
- Corpus and dictionary guide the fuzzer, crashes are minimized and become regression inputs, and all tests run under sanitizers in CI.
