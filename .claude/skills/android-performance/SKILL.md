---
name: android-performance
description: "Android app performance: startup time with Baseline Profiles and App Startup, jank-free rendering in Compose, main-thread discipline and StrictMode, memory leaks with LeakCanary, efficient images with Coil, background work with WorkManager, battery and network efficiency, app size, and measuring with Macrobenchmark, Perfetto, and Android vitals. Use it when optimizing or reviewing Android app performance."
---

# Skill: Android Performance

## Implementation Rules:
- **[MANDATORY]** Measure on release-like builds (minified, not debuggable) on real low- and mid-range devices: Macrobenchmark for startup and scrolling, Perfetto/System Tracing for jank, and Android vitals in the Play Console for production (ANR rate, crash rate, slow frames, excessive wakeups).
- **[MANDATORY]** Ship Baseline Profiles (generated with the Baseline Profile Gradle plugin and a `BaselineProfileRule` journey test) for app and library modules, and Startup Profiles for DEX layout, verifying the improvement with Macrobenchmark `CompilationMode` comparisons.
- **[PERFORMANCE]** Keep startup lean: no heavy work in `Application.onCreate` or content providers, lazy initialization with App Startup or DI-provided lazy singletons, defer SDK initialization until needed, and render the first frame quickly with the SplashScreen API and `reportFullyDrawn()` when content is ready.
- **[MANDATORY]** Never block the main thread: disk, network, database, and JSON parsing run in coroutines on injected IO/Default dispatchers; enable `StrictMode` thread and VM policies in debug builds to catch violations.
- **[PERFORMANCE]** Avoid Compose jank: stable parameters, keyed lazy lists, `derivedStateOf` for thresholds, deferred state reads for animations, no allocations or sorting in composition, and release-mode checks because debug builds are not representative.
- **[PERFORMANCE]** Load images with Coil (or Glide) sized to the target view, with memory and disk caches, and prefer vector drawables or WebP/AVIF for bundled assets.
- **[PATTERN]** Run deferrable and guaranteed background work with WorkManager (constraints for network and charging, exponential backoff, unique work to avoid duplicates) instead of long-running services or alarms.
- **[FORBIDDEN]** Leaking Activities, Views, or Contexts through static fields, singletons, or long-lived callbacks; polling on timers when push (FCM) or flows fit; wake locks without timeouts; and loading full-resolution bitmaps into memory.
- **[PERFORMANCE]** Detect and fix leaks with LeakCanary in debug builds and heap dumps in the Android Studio Memory Profiler; handle `onTrimMemory` by releasing caches.
- **[PERFORMANCE]** Be network-efficient: batch and compress requests, cache with OkHttp `Cache` and HTTP caching headers, paginate with Paging 3, and respect metered networks and Data Saver.
- **[CONFIGURATION]** Reduce app size with Android App Bundles, R8 full mode with resource shrinking, per-ABI and per-density splits, and dynamic feature modules for rarely used large features; track size in CI.
- **[TESTING]** Macrobenchmark tests for cold startup (`StartupTimingMetric`) and critical scrolls (`FrameTimingMetric`) run in CI on a consistent device or managed device, with regressions compared against a baseline.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
