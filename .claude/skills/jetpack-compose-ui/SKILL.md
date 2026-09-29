---
name: jetpack-compose-ui
description: "Building Android UI with Jetpack Compose and Material 3: stateless composables with state hoisting, stable parameters and recomposition, lifecycle-aware state collection, lazy lists with keys, side-effect APIs, theming and design systems, adaptive layouts, previews, and accessibility semantics. Use it when writing or reviewing Compose UI code."
---

# Skill: Jetpack Compose UI

## Implementation Rules:
- **[ARCHITECTURE]** Split each screen into a stateful route composable (obtains the ViewModel, collects state, handles navigation) and a stateless screen composable that takes `uiState` and event lambdas; reusable components are stateless and hoist their state.
- **[MANDATORY]** Collect flows in UI with `collectAsStateWithLifecycle()` (lifecycle-runtime-compose), never plain `collectAsState()` for flows backed by expensive upstream work, and never collect inside composition without lifecycle awareness.
- **[PATTERN]** Every composable that emits UI accepts a `modifier: Modifier = Modifier` as its first optional parameter and applies it to its root element; parameters are immutable data (`data class` with `val`s, `kotlinx.collections.immutable` collections or stable types).
- **[PERFORMANCE]** Keep recomposition cheap: use `remember`/`derivedStateOf` for derived values, pass lambdas instead of reading frequently changing state high in the tree, defer state reads to layout or draw phases (`Modifier.offset { }`, `graphicsLayer { }`) for animations, and check with the Layout Inspector recomposition counts and compiler stability reports.
- **[MANDATORY]** `LazyColumn`/`LazyRow`/`LazyVerticalGrid` items have stable `key`s and `contentType`s; never place a lazy list inside a vertically scrolling parent of the same orientation.
- **[PATTERN]** Use side-effect APIs correctly: `LaunchedEffect(key)` for suspend work tied to composition and keys, `rememberCoroutineScope` for event-driven coroutines, `DisposableEffect` for listeners that need cleanup, and `rememberUpdatedState` for callbacks captured by long-lived effects.
- **[FORBIDDEN]** Business logic, repository calls, or navigation decisions inside composables, `mutableStateOf` held outside `remember` or a state holder, side effects executed directly in the composable body, and hard-coded colors, dimensions, and strings instead of theme tokens and string resources.
- **[PATTERN]** Theme through `MaterialTheme` (Material 3 color schemes including dynamic color, typography, shapes) and a design-system module of reusable components; support dark theme and adaptive layouts with window size classes.
- **[MANDATORY]** Accessibility: every icon-only control has a `contentDescription`, decorative images use `null`, touch targets are at least 48dp, custom controls expose semantics (`Modifier.semantics { role = Role.Button }`, `stateDescription`), and text uses `sp` so it scales with user font settings.
- **[PATTERN]** Provide `@Preview`s (light/dark, large font scale, different devices with `@PreviewScreenSizes` or multipreview annotations) for screen composables using sample state.
- **[TESTING]** Test composables with `createComposeRule()` and semantic finders (`onNodeWithText`, `onNodeWithContentDescription`, `onNodeWithTag`), asserting displayed state and invoked callbacks; add screenshot tests (Compose Preview Screenshot Testing or Roborazzi/Paparazzi) for the design system.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
