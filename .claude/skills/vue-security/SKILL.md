---
name: vue-security
description: "Security for Vue and Nuxt applications: template auto-escaping and the dangers of v-html, dynamic URLs and attribute bindings, never compiling user templates, CSP, secrets and runtimeConfig, cookie sessions with CSRF protection, the BFF pattern for tokens, SSR state leaks, route guards as UX only, and dependency hygiene. Use it when implementing or reviewing security in Vue or Nuxt code."
---

# Skill: Vue Security

## Implementation Rules:
- **[MANDATORY]** Render untrusted data only through text interpolation (`{{ }}`) and normal attribute bindings, which Vue escapes; treat `v-html`, `innerHTML`, and render functions that set `innerHTML` as dangerous sinks.
- **[FORBIDDEN]** `v-html` with user or API-provided content that is not sanitized, compiling templates from user input (runtime compiler with dynamic `template` strings), `eval`/`new Function`, and binding user-controlled values to `on*` attributes or `:is` component names without an allow-list.
- **[SECURITY]** When rich HTML must be displayed, sanitize it with a maintained sanitizer (DOMPurify with a strict allow-list), ideally on the server when the content is stored and again at render time.
- **[SECURITY]** Validate dynamic URLs bound to `href`/`src`: allow only `https:` (and `mailto:` where needed) or relative paths, rejecting `javascript:` and `data:` schemes, and add `rel="noopener noreferrer"` to external links opened in new tabs.
- **[SECURITY]** Deploy a Content Security Policy without `unsafe-eval` (use the runtime-only Vue build) and with nonces or hashes for inline scripts; in Nuxt configure it through a security module (for example `nuxt-security`) and report violations.
- **[MANDATORY]** No secrets in client code: everything bundled into the browser is public. In Nuxt, keep secrets in private `runtimeConfig` and call third-party APIs from server routes.
- **[PATTERN]** Authenticate with `HttpOnly`, `Secure`, `SameSite` session cookies via a Backend-for-Frontend (Nuxt server routes are a natural BFF), with CSRF protection for state-changing requests (SameSite plus a CSRF token or origin checks); do not store tokens in `localStorage`.
- **[MANDATORY]** Router guards (`beforeEach`, Nuxt route middleware) only improve user experience; every permission is enforced by the API, and the UI handles 401/403 responses.
- **[SECURITY]** In SSR, never keep per-user data in module-level variables or singletons shared across requests; use `useState`, request context (`event.context`), or per-request Pinia instances, and do not serialize sensitive fields into the page payload.
- **[SECURITY]** Validate every Nitro server route input with a schema, return minimal fields, and apply rate limiting and security headers on the server.
- **[MANDATORY]** Keep Vue, Nuxt, and dependencies up to date, run an SCA check (`npm audit` or equivalent) in CI, and lint with rules that flag `v-html` (`vue/no-v-html`) so every use is reviewed.
- **[TESTING]** Tests render XSS payloads through components and assert they appear as text, check that unsafe URLs are rejected, and verify that server routes reject invalid input and unauthorized requests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
