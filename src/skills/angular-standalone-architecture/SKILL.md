---
name: angular-standalone-architecture
description: "Architecture for enterprise Angular applications on the current major version: standalone components, feature-based folders, lazy-loaded routes, functional guards and resolvers, dependency injection with inject(), smart vs presentational components, new control flow, and module boundaries enforced by lint rules. Use it when structuring, creating, or reviewing Angular applications."
---

# Skill: Angular Standalone Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Use standalone components, directives, and pipes everywhere (the default in current Angular); bootstrap with `bootstrapApplication` and an `app.config.ts` that registers providers (`provideRouter`, `provideHttpClient(withFetch(), withInterceptors([...]))`, `provideZonelessChangeDetection()` where adopted); do not create new `NgModule`s.
- **[ARCHITECTURE]** Organize code by feature, not by type: `features/orders/` contains its routes, pages (smart/container components), UI components, services, and models; shared UI lives in `shared/ui`, cross-cutting infrastructure in `core/`. In Nx or multi-project workspaces, enforce boundaries with tags and `@nx/enforce-module-boundaries` or `eslint-plugin-boundaries`.
- **[MANDATORY]** Lazy-load every feature with `loadComponent` or `loadChildren` pointing to a `*.routes.ts` file; route-level providers (`providers: [...]` on a route) scope feature services to that feature.
- **[PATTERN]** Separate container components (inject services, hold state, handle navigation) from presentational components (only `input()`, `output()`, and `model()`, no injected data services), and set `changeDetection: ChangeDetectionStrategy.OnPush` on every component.
- **[PATTERN]** Use `inject()` instead of constructor parameters, `providedIn: 'root'` for stateless singletons, and `InjectionToken`s for configuration and abstractions (for example an `API_BASE_URL` token or a repository port).
- **[PATTERN]** Use functional guards, resolvers, and interceptors (`CanActivateFn`, `ResolveFn`, `HttpInterceptorFn`), and bind route parameters to inputs with `withComponentInputBinding()`.
- **[MANDATORY]** Templates use the built-in control flow (`@if`, `@for` with a mandatory `track` expression, `@switch`) and `@defer` for below-the-fold or heavy UI; the structural directives `*ngIf`/`*ngFor` are migrated with the official schematic.
- **[FORBIDDEN]** Business logic in templates (method calls with side effects, complex expressions), components that call `HttpClient` directly from presentational UI, barrel files that create import cycles, and `any` in public component APIs.
- **[CONFIGURATION]** Enable strict mode in `tsconfig.json` (`strict: true`) and in `angularCompilerOptions` (`strictTemplates: true`, `strictInjectionParameters: true`, `extendedDiagnostics` as errors), and keep the workspace on the current major via `ng update`.
- **[PATTERN]** Keep environment-specific values out of the bundle where they are secrets (there are none in a frontend); load runtime configuration (API URLs, feature flags) from a JSON endpoint at startup with `provideAppInitializer`.
- **[TESTING]** Architecture rules are checked in CI: ESLint with `angular-eslint`, module boundary rules, `ng build` with production budgets, and schematic-based migrations reviewed in their own pull requests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
