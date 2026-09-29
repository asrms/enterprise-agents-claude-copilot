---
name: android-architecture-mvvm
description: "Android app architecture following the official guidance: UI layer with ViewModels and unidirectional data flow, immutable UI state exposed as StateFlow, optional domain layer with use cases, data layer with repositories and offline-first sources (Room, DataStore, Retrofit/Ktor), Hilt dependency injection, modularization by feature, and type-safe Navigation Compose. Use it when structuring or reviewing Android apps."
---

# Skill: Android Architecture (MVVM and UDF)

## Implementation Rules:
- **[ARCHITECTURE]** Follow the layered architecture from the official Android guidance: UI layer (composables plus ViewModels), optional domain layer (use cases for reusable or complex business logic), and data layer (repositories that own data and coordinate sources); dependencies point from UI to data, never the other way.
- **[MANDATORY]** ViewModels expose a single immutable UI state (`StateFlow<XUiState>`) built with `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)` or a private `MutableStateFlow` updated with `update { }`, and receive user events as function calls; UI never mutates state directly.
- **[PATTERN]** Model UI state explicitly with data classes and sealed interfaces (`Loading`, `Loaded`, `Error`), mapping domain models to UI models (formatted strings, flags) in the ViewModel or a mapper, not in composables.
- **[PATTERN]** One-off effects (navigation, snackbars) are modeled as state that the UI consumes and acknowledges, or as navigation calls from the route composable; avoid `SharedFlow`-based event buses that can lose events.
- **[ARCHITECTURE]** Repositories are the single source of truth for their data: expose `Flow`s from the local database (Room) and refresh from the network in the background (offline-first), convert network DTOs to domain models at the boundary, and never leak Retrofit or Room types to the UI.
- **[MANDATORY]** Use Hilt for dependency injection (`@HiltViewModel`, `@Inject constructor`, modules binding interfaces to implementations with `@Binds`), and inject `CoroutineDispatcher`s with qualifiers so they can be replaced in tests.
- **[ARCHITECTURE]** Modularize by feature and layer as the app grows (`:feature:orders`, `:core:data`, `:core:database`, `:core:network`, `:core:designsystem`), using convention plugins in `build-logic` and a Gradle version catalog (`libs.versions.toml`) for consistent configuration.
- **[PATTERN]** Navigate with Navigation Compose type-safe routes (`@Serializable` route objects or classes with `composable<Route>`), keeping navigation calls in route-level composables and passing ids rather than whole objects between destinations.
- **[FORBIDDEN]** Passing `Context`, `Activity`, `View`, or composables into ViewModels, business logic in Activities or composables, `GlobalScope`, `LiveData` in new Compose code, and singletons with mutable global state instead of injected repositories.
- **[PATTERN]** Persist small key-value settings with DataStore (Preferences or Proto), structured data with Room (with migrations and exported schemas), and survive process death for critical UI state with `SavedStateHandle`.
- **[TESTING]** Unit-test ViewModels with fake repositories, `kotlinx-coroutines-test` (`runTest`, `StandardTestDispatcher` set as `Dispatchers.Main`) and Turbine for flows; test repositories against an in-memory Room database and a fake network source.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
