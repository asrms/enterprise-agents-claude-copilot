---
name: ios-performance
description: "Performance for iOS apps: launch time, main-thread responsiveness and hangs, SwiftUI view update efficiency, lazy stacks and lists, image decoding and caching, memory and retain cycles, energy and networking efficiency, and measuring with Instruments, MetricKit, XCTest performance metrics, and Xcode Organizer. Use it when optimizing or reviewing iOS app performance."
---

# Skill: iOS Performance

## Implementation Rules:
- **[MANDATORY]** Measure first with Instruments (Time Profiler, SwiftUI, Hangs, Allocations, Leaks, Network) on a release build on a real, older supported device; record the baseline and the target for launch time, hang rate, and memory.
- **[MANDATORY]** Keep the main thread free: no synchronous networking, disk I/O, JSON decoding of large payloads, image decoding, or database queries on the main actor; move them to nonisolated async functions or background actors and publish results on the main actor.
- **[PERFORMANCE]** Optimize launch: defer non-essential SDK initialization and work until after first frame, avoid heavy work in `App.init` and `application(_:didFinishLaunchingWithOptions:)`, reduce dynamic frameworks, and show meaningful content quickly.
- **[PERFORMANCE]** Make SwiftUI updates cheap: use `@Observable` models so views only re-render for properties they read, keep `body` free of expensive computation, give `ForEach` stable identifiers, split large views so state changes invalidate small subtrees, and inspect updates with the SwiftUI instrument.
- **[PERFORMANCE]** Use `List` or `LazyVStack`/`LazyVGrid` for long or unbounded content, paginate data, and avoid `GeometryReader`-heavy layouts inside scrolling rows.
- **[PERFORMANCE]** Handle images efficiently: downsample to display size (ImageIO thumbnails or `UIImage.byPreparingThumbnail(ofSize:)`), decode off the main thread, cache with size limits (`NSCache` or a maintained image library), and prefer vector or asset-catalog images for UI.
- **[FORBIDDEN]** Strong reference cycles in closures stored by objects (`[weak self]` or structured lifetimes needed), unbounded in-memory caches, timers and location updates running when not needed, and polling where push, background tasks, or `URLSession` background transfers fit.
- **[PERFORMANCE]** Be network- and energy-efficient: batch requests, use HTTP caching (`URLCache`) and compression, prefer `BGTaskScheduler` for deferrable work, and respect Low Power Mode and constrained networks (`allowsConstrainedNetworkAccess`).
- **[PATTERN]** Monitor production performance with MetricKit (`MXMetricManager` payloads for launch, hangs, memory, disk writes, crashes) and Xcode Organizer metrics, and set alerts for regressions per release.
- **[CONFIGURATION]** Build release configurations with whole-module optimization, strip debug symbols from the shipped binary (upload dSYMs for symbolication), and review app size with the App Thinning size report.
- **[TESTING]** Protect key flows with XCTest performance tests (`measure(metrics: [XCTApplicationLaunchMetric(), XCTClockMetric(), XCTMemoryMetric()])`) with baselines, and run them on consistent devices or simulators in CI.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
