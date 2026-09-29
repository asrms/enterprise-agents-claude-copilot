---
name: laravel-security
description: "Securing Laravel applications: authentication with Sanctum, Fortify, or OAuth providers, authorization with policies and gates, mass assignment protection, validation, Blade escaping and XSS, CSRF, SQL injection with query builder bindings, encryption and hashing, signed URLs, rate limiting, file upload safety, secure configuration (APP_KEY, APP_DEBUG, cookies), and dependency auditing. Use it when implementing or reviewing security in Laravel code."
---

# Skill: Laravel Security

## Implementation Rules:
- **[MANDATORY]** Authorize every action with policies or gates (`$this->authorize('update', $order)`, `Gate::authorize`, `can` middleware, `authorize()` in form requests), including object-level checks that the resource belongs to the user or tenant; route middleware alone is not sufficient.
- **[MANDATORY]** Protect against mass assignment: define `$fillable` explicitly (or `$guarded` with care), never `$guarded = []` with `$request->all()`, and use validated data only; enable `Model::preventSilentlyDiscardingAttributes()` in development.
- **[MANDATORY]** Output with Blade's escaped syntax `{{ }}`; use `{!! !!}` only for trusted, sanitized HTML (for example processed with a sanitizer such as HTML Purifier), and escape data placed into JavaScript with `@js()` or `Js::from()`.
- **[MANDATORY]** Keep queries parameterized: Eloquent and query builder bindings; `whereRaw`, `orderByRaw`, and `DB::raw` only with bound parameters and allow-listed identifiers.
- **[SECURITY]** Use Sanctum for SPA cookie authentication (with CSRF protection and stateful domains) or API tokens with abilities and expiration, Fortify or a starter kit for login flows with rate limiting and optional two-factor authentication, and Socialite or an OIDC library for external identity providers.
- **[SECURITY]** Apply rate limiting with `RateLimiter::for()` and the `throttle` middleware on login, password reset, and expensive endpoints; use signed and temporary signed URLs for links that grant access without login.
- **[SECURITY]** Handle uploads safely: validate type by content (`mimes`, `mimetypes`), size, and dimensions, store outside the public directory with generated names (`store()`), serve through controllers or signed URLs with correct `Content-Disposition`, and scan when required.
- **[MANDATORY]** Configure production securely: `APP_DEBUG=false`, a strong `APP_KEY` stored as a secret (rotated with `APP_PREVIOUS_KEYS`), `SESSION_SECURE_COOKIE=true`, `SameSite` cookies, HTTPS enforced, and trusted proxies configured correctly.
- **[FORBIDDEN]** Committing `.env` files, disabling CSRF protection for web routes, using `md5`/`sha1` for passwords (use `Hash::make` with bcrypt or Argon2id), storing secrets or tokens in plain columns (use `encrypted` casts or a secret store), and exposing Telescope, Horizon, or debug tools publicly without authorization.
- **[PATTERN]** Add security headers (Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`, HSTS) via middleware or the web server, and log security-relevant events (logins, failed authorizations, permission changes) without sensitive data.
- **[MANDATORY]** Keep Laravel and packages patched: `composer audit` in CI, automated dependency updates, and review of new packages before adoption.
- **[TESTING]** Feature tests cover authorization (other users' resources return 403/404), validation rejections, CSRF on web forms, rate limits, and signed URL tampering, and security static analysis (for example Larastan rules) runs in CI.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
