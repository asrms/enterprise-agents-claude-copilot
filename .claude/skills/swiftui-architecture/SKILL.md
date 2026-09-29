---
name: swiftui-architecture
description: "Architecture for SwiftUI apps with Swift 6: feature modules with Swift Package Manager, @Observable models, unidirectional data flow, NavigationStack with typed routes, dependency injection through initializers and the environment, small composable views, previews with sample data, and separation of UI from domain and data layers. Use it when structuring or reviewing iOS apps built with SwiftUI."
---

# Skill: SwiftUI Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Split the app into local Swift packages by feature and layer (`OrdersFeature`, `DesignSystem`, `APIClient`, `Persistence`), with the app target only composing them; feature modules depend on protocols of lower layers, never on each other's internals.
- **[MANDATORY]** Model screen state with the Observation framework (`@Observable` classes marked `@MainActor`) owned by the view with `@State` or injected from a parent; `ObservableObject`/`@Published` is reserved for code that must support older OS versions.
- **[PATTERN]** Follow unidirectional data flow: views render state and send user intents to the model (`model.didTapRetry()`), the model performs async work through injected services and updates state; views never call networking or persistence directly.
- **[PATTERN]** Represent screen state explicitly with enums (`enum LoadState { case idle, loading, loaded([Order]), failed(String) }`) instead of several independent booleans that can contradict each other.
- **[PATTERN]** Navigate with `NavigationStack(path:)` and a typed `Hashable` route enum handled by `.navigationDestination(for:)`; a coordinator or router model owns the path so deep links and state restoration can drive navigation.
- **[PATTERN]** Inject dependencies through initializers for models and through the SwiftUI environment (`@Environment` with custom `EnvironmentValues` entries via `@Entry`) for cross-cutting services; define services as protocols with live, preview, and test implementations.
- **[PATTERN]** Keep views small and composable: extract subviews instead of long `body` properties, pass only the data a subview needs, and use `ViewModifier`s and a shared design system for styling.
- **[FORBIDDEN]** Singletons accessed from views (`APIClient.shared` inside `body`), business logic inside `body` or `onAppear` closures, force unwrapping of external data, and `AnyView` type erasure to work around type-checking instead of `@ViewBuilder`.
- **[CONFIGURATION]** Enable Swift 6 language mode with complete strict concurrency checking in every package and target, treat warnings as errors in CI, and lint with SwiftLint using a committed configuration.
- **[PATTERN]** Every screen has `#Preview`s with preview implementations of its services covering loading, empty, error, and populated states, plus Dynamic Type and dark mode variants.
- **[TESTING]** Models are unit-tested without UI by injecting fake services and asserting state transitions; navigation logic is tested through the router model.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
