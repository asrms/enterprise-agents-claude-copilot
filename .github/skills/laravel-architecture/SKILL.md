---
name: laravel-architecture
description: "Maintainable architecture for Laravel applications on current Laravel and PHP 8.3+: thin controllers, form requests for validation, actions or service classes for use cases, API resources for responses, domain-oriented folders, dependency injection through the container, events and listeners, configuration and environment handling, and strict typing. Use it when structuring, building, or reviewing Laravel applications."
---

# Skill: Laravel Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Keep controllers thin: validate with Form Request classes, delegate each use case to a single-purpose action or service class (`PlaceOrder::handle()`), and return API Resources or views; controllers contain no business rules or queries beyond simple lookups.
- **[ARCHITECTURE]** Organize code by domain as the application grows (`app/Domain/Orders/{Actions,Models,Events,Data}`) or by feature modules, rather than piling everything into default folders; shared infrastructure stays in `app/Support`.
- **[MANDATORY]** Validate every input in Form Requests (`rules()`, `authorize()`), use `$request->validated()` or typed data objects, and never pass `$request->all()` to models (mass assignment).
- **[MANDATORY]** Shape responses with `JsonResource`/`ResourceCollection` classes that list exposed fields explicitly; never return Eloquent models or arrays with hidden internal fields directly from APIs.
- **[PATTERN]** Use constructor injection and the service container for dependencies, binding interfaces to implementations in service providers; avoid facades inside domain classes where testability suffers, and never use `app()` as a service locator in business code.
- **[PATTERN]** Use typed data objects (readonly classes or spatie/laravel-data) for passing structured data between layers instead of associative arrays.
- **[PATTERN]** Decouple side effects with events and queued listeners (emails, notifications, integrations), dispatched after the transaction commits (`ShouldDispatchAfterCommit` or `DB::afterCommit`).
- **[MANDATORY]** Declare `declare(strict_types=1);` in PHP files, use parameter, return, and property types everywhere, enums for fixed sets of values (backed enums cast on models), and readonly properties where values do not change.
- **[FORBIDDEN]** Business logic in Blade templates, controllers, or model observers that hide side effects; `env()` calls outside configuration files (they return null when config is cached); and fat models containing unrelated responsibilities.
- **[CONFIGURATION]** Read configuration only via `config()` from files in `config/`, cache it in production (`php artisan config:cache`, `route:cache`, `event:cache`, `view:cache` or `optimize`), and keep secrets in environment variables or a secret manager, never committed `.env` files.
- **[TESTING]** Structure tests to mirror the architecture: unit tests for actions and domain logic, feature tests for HTTP endpoints, and architecture tests (Pest `arch()` presets) that enforce layer rules such as "controllers do not use DB facade".
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
