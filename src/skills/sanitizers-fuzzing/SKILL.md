---
name: sanitizers-fuzzing
description: "Finding memory, undefined behavior, and concurrency bugs in C and C++ with sanitizers and fuzzing: AddressSanitizer, UndefinedBehaviorSanitizer, ThreadSanitizer, MemorySanitizer, and LeakSanitizer builds, libFuzzer and AFL++ harnesses, corpora and dictionaries, structure-aware fuzzing, continuous fuzzing with OSS-Fuzz or ClusterFuzzLite, triaging crashes, and adding regression tests. Use it when hardening C or C++ code, especially code that handles untrusted input."
---

# Skill: Sanitizers and Fuzzing

## Implementation Rules:
- **[MANDATORY]** Run the test suite in CI under sanitizer builds: AddressSanitizer plus UndefinedBehaviorSanitizer (`-fsanitize=address,undefined`) as a standard job, ThreadSanitizer (`-fsanitize=thread`) for concurrent code in a separate job, and MemorySanitizer (Clang, with fully instrumented dependencies) where uninitialized reads matter.
- **[MANDATORY]** Make sanitizer failures fatal and informative: `-fno-sanitize-recover=all` for UBSan, `-fno-omit-frame-pointer` and `-g` for good stacks, and environment options such as `ASAN_OPTIONS=detect_leaks=1:abort_on_error=1` and `UBSAN_OPTIONS=print_stacktrace=1`.
- **[PATTERN]** Fuzz every component that parses or processes untrusted input (file formats, network protocols, decoders, deserializers) with libFuzzer (`LLVMFuzzerTestOneInput`) or AFL++, compiled with sanitizers enabled.
- **[PATTERN]** Write focused harnesses: feed the input directly to the target API, avoid global state between runs, check invariants (round trips, no crashes, consistent results) inside the harness, and keep each iteration fast.
- **[PATTERN]** Seed fuzzers with a corpus of valid and edge-case inputs, add dictionaries of format tokens, and use structure-aware fuzzing (libprotobuf-mutator or `FuzzedDataProvider`) for structured inputs.
- **[MANDATORY]** Run fuzzing continuously: short fuzzing runs on pull requests (ClusterFuzzLite or CI time-boxed runs), longer scheduled runs, and OSS-Fuzz for open-source projects; store and minimize corpora between runs.
- **[MANDATORY]** Triage every crash: reproduce with the saved input, minimize it, fix the root cause, and add the input as a regression test (a unit test or a corpus entry that runs in CI).
- **[FORBIDDEN]** Ignoring or suppressing sanitizer reports without analysis, shipping sanitizer-instrumented binaries to production by accident, fuzzing without sanitizers (many bugs go unnoticed), and harnesses that leak state across iterations.
- **[PATTERN]** Combine with static analysis (clang-tidy, clang static analyzer, compiler warnings) and hardened library modes, since each technique finds different classes of bugs.
- **[SECURITY]** Treat fuzzing-found crashes in input-handling code as potential security vulnerabilities: assess exploitability, fix promptly, and follow the security disclosure process for shipped products.
- **[TESTING]** Track fuzzing effectiveness with coverage reports on the corpus (`-fprofile-instr-generate -fcoverage-mapping` with llvm-cov) and extend harnesses to reach uncovered code.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
