# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unchecked sharing, blocking, and unstructured tasks
```swift
final class ImageCache: @unchecked Sendable {        // silences the compiler, not the race
    var images: [URL: UIImage] = [:]
}

func loadAll(_ urls: [URL]) -> [UIImage] {
    let semaphore = DispatchSemaphore(value: 0)
    var result: [UIImage] = []
    for url in urls {
        Task.detached {                               // unbounded, uncancellable
            let (data, _) = try await URLSession.shared.data(from: url)
            result.append(UIImage(data: data)!)       // data race on result
            semaphore.signal()
        }
    }
    for _ in urls { semaphore.wait() }                // blocks a thread, can deadlock the main thread
    return result
}
```
**Why it's wrong:**
- `@unchecked Sendable` hides a data race on a mutable dictionary; `result` is mutated concurrently.
- Blocking with a semaphore defeats the cooperative thread pool; detached tasks ignore cancellation and errors.

## Best Practice (How to do it right)

### 1. Actor-protected cache and a bounded task group
```swift
actor ImageLoader {
    private var cache: [URL: UIImage] = [:]
    private var inFlight: [URL: Task<UIImage, Error>] = [:]
    private let session: URLSession

    init(session: URLSession = .shared) { self.session = session }

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache[url] { return cached }
        if let task = inFlight[url] { return try await task.value }   // deduplicate concurrent requests

        let task = Task { [session] in
            let (data, _) = try await session.data(from: url)
            guard let image = UIImage(data: data) else { throw URLError(.cannotDecodeContentData) }
            return image
        }
        inFlight[url] = task
        defer { inFlight[url] = nil }
        let image = try await task.value
        cache[url] = image                                             // state re-checked after suspension
        return image
    }
}

func loadAll(_ urls: [URL], loader: ImageLoader, maxConcurrent: Int = 4) async throws -> [URL: UIImage] {
    try await withThrowingTaskGroup(of: (URL, UIImage).self) { group in
        var iterator = urls.makeIterator()
        var results: [URL: UIImage] = [:]
        for _ in 0..<maxConcurrent {
            guard let url = iterator.next() else { break }
            group.addTask { (url, try await loader.image(for: url)) }
        }
        while let (url, image) = try await group.next() {
            results[url] = image
            if let next = iterator.next() {
                group.addTask { (next, try await loader.image(for: next)) }
            }
        }
        return results
    }
}
```
**Why it's right:**
- The actor serializes access to the cache and deduplicates in-flight requests; no unchecked conformances are needed.
- The task group bounds concurrency, propagates errors, and cancels remaining work when the caller is cancelled.
- Nothing blocks threads; results are collected in the group's isolated scope.
