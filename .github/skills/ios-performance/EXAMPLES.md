# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Main-thread decoding, eager stack, full-size images
```swift
struct GalleryView: View {
    let urls: [URL]

    var body: some View {
        ScrollView {
            VStack {                                              // builds every row up front
                ForEach(urls, id: \.self) { url in
                    let data = try! Data(contentsOf: url)         // synchronous I/O in body
                    Image(uiImage: UIImage(data: data)!)          // decodes a 12 MP photo on the main thread
                        .resizable().scaledToFit().frame(height: 120)
                }
            }
        }
    }
}
```
**Why it's wrong:**
- Every image is read and decoded at full resolution on the main thread during `body` evaluation, causing hangs and huge memory use.
- `VStack` instantiates all rows immediately, even those far off screen.

## Best Practice (How to do it right)

### 1. Lazy grid, background downsampling, bounded cache
```swift
actor ThumbnailProvider {
    private let cache = NSCache<NSURL, UIImage>()

    init() { cache.totalCostLimit = 50 * 1024 * 1024 }            // ~50 MB

    func thumbnail(for url: URL, maxPixelSize: Int) async -> UIImage? {
        if let cached = cache.object(forKey: url as NSURL) { return cached }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,           // decode here, off the main thread
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let image = UIImage(cgImage: cgImage)
        cache.setObject(image, forKey: url as NSURL, cost: cgImage.bytesPerRow * cgImage.height)
        return image
    }
}

struct GalleryView: View {
    let urls: [URL]
    let provider: ThumbnailProvider
    @Environment(\.displayScale) private var scale

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110))]) {
                ForEach(urls, id: \.self) { url in
                    Thumbnail(url: url, provider: provider, pixelSize: Int(120 * scale))
                }
            }
        }
    }
}

struct Thumbnail: View {
    let url: URL
    let provider: ThumbnailProvider
    let pixelSize: Int
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFill() } else { Color.secondary.opacity(0.2) }
        }
        .frame(width: 110, height: 120).clipped()
        .task(id: url) { image = await provider.thumbnail(for: url, maxPixelSize: pixelSize) }
    }
}
```
### 2. Launch performance test with a baseline
```swift
func testLaunchPerformance() {
    measure(metrics: [XCTApplicationLaunchMetric()]) { XCUIApplication().launch() }
}
```
**Why it's right:**
- Rows are created lazily, images are downsampled to display size and decoded off the main thread, and the cache is bounded.
- Loading is cancelled automatically when rows scroll away, and launch time is guarded by a performance test.
