---
name: flutter-architecture
description: "Architecture for Flutter apps with Dart 3: feature-first structure, layered UI/domain/data separation following the official app architecture guide, immutable models with sealed classes and records, dependency injection, go_router navigation, widget composition, null safety and strict analysis, and code generation hygiene. Use it when structuring or reviewing Flutter applications."
---

# Skill: Flutter Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Follow the layered architecture from the official Flutter guidance: UI layer (widgets plus view models or controllers), optional domain layer (use cases), and data layer (repositories and services); organize folders by feature (`lib/features/orders/{data,domain,ui}`) with shared code in `lib/core`.
- **[MANDATORY]** Widgets only render state and forward user intents; business logic, networking, and persistence live in view models/notifiers and repositories, never in `build` methods or `initState` bodies.
- **[PATTERN]** Model data as immutable classes (`final` fields, `copyWith`, `==`/`hashCode` via `freezed` or `equatable`) and state as Dart 3 sealed classes (`sealed class OrdersState` with `Loading`, `Loaded`, `Failed`) handled with exhaustive `switch` expressions.
- **[PATTERN]** Repositories are the single source of truth for their data, expose `Stream`s or `Future`s of domain models, map DTOs from services (Dio or `http` clients, local databases) at the boundary, and return typed results or throw domain exceptions.
- **[PATTERN]** Inject dependencies through constructors and a composition root (Riverpod providers, `provider` package, or `get_it` registered at startup); widgets obtain dependencies from the chosen mechanism, never from global singletons created ad hoc.
- **[PATTERN]** Navigate with `go_router` using typed routes (`go_router_builder` or route constants), deep-link-ready paths, and redirect logic for authentication in one place.
- **[PERFORMANCE]** Compose small widgets with `const` constructors, split large `build` methods into widget classes (not helper methods that return widgets), and rebuild only the subtree that depends on changing state (`select`, `Consumer`, `ValueListenableBuilder`).
- **[FORBIDDEN]** `setState` for shared or business state, `BuildContext` used across async gaps without a `mounted` check, `dynamic` and `late` used to silence the type system, and platform channels or plugins called directly from widgets.
- **[CONFIGURATION]** Enable strict analysis in `analysis_options.yaml` (`strict-casts`, `strict-inference`, `strict-raw-types`, and `flutter_lints` or `very_good_analysis`), run `dart format`, and pin dependency versions with `pubspec.lock` committed for apps.
- **[PATTERN]** Keep generated code (`*.g.dart`, `*.freezed.dart`) reproducible with `dart run build_runner build --delete-conflicting-outputs` in CI, and use flavors or `--dart-define-from-file` for environment configuration without secrets.
- **[TESTING]** Unit-test view models and repositories with fakes, widget-test screens with injected fakes, and keep golden tests for design system components.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
