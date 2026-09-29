---
name: angular-security
description: "Frontend security for Angular applications: built-in sanitization and the risks of bypassSecurityTrust*, Trusted Types and Content Security Policy, XSRF protection with HttpClient, token handling and the BFF pattern, functional HTTP interceptors, route guards as UX only, secure dependencies, and SSR-specific concerns. Use it when implementing or reviewing security in Angular apps."
---

# Skill: Angular Security

## Implementation Rules:
- **[MANDATORY]** Rely on Angular's automatic contextual escaping: bind untrusted data with interpolation or property binding, never build HTML strings, and never use `ElementRef.nativeElement.innerHTML` or `document.write` with dynamic content.
- **[FORBIDDEN]** `DomSanitizer.bypassSecurityTrustHtml/Script/Url/ResourceUrl` on data that comes from users, APIs, or URLs; when rich HTML is unavoidable, sanitize with a maintained sanitizer (for example DOMPurify) and bind the result through `[innerHTML]`, which Angular sanitizes again.
- **[SECURITY]** Deploy a strict Content Security Policy with nonces (`ngCspNonce` or the `CSP_NONCE` token for inline styles), `object-src 'none'`, `base-uri 'self'`, and enable Trusted Types (`require-trusted-types-for 'script'; trusted-types angular angular#bundler`) to block DOM XSS sinks.
- **[SECURITY]** For cookie-based sessions, keep XSRF protection enabled (`provideHttpClient(withXsrfConfiguration({ cookieName, headerName }))`) with the backend issuing and validating the token; cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`.
- **[PATTERN]** Prefer the Backend-for-Frontend pattern: the SPA talks to its own backend with a session cookie, and OAuth tokens stay on the server. If tokens must live in the browser, keep access tokens in memory only (never `localStorage`), use Authorization Code + PKCE with a certified library, and short token lifetimes.
- **[PATTERN]** Attach credentials with a functional `HttpInterceptorFn` that adds them only for allow-listed API origins, so tokens are never sent to third-party URLs.
- **[MANDATORY]** Treat route guards and hidden buttons as user experience only: every authorization decision is enforced by the backend, and the UI handles 401/403 responses gracefully.
- **[SECURITY]** Validate and encode URLs built from user input (`encodeURIComponent` for path segments and query values), and only allow navigation to internal routes or allow-listed domains to prevent open redirects.
- **[SECURITY]** Never ship secrets in the bundle (`environment.ts` is public); API keys that must be client-side are restricted by origin and scope on the provider side.
- **[SECURITY]** In SSR, do not leak per-request data between users (no module-level mutable state), escape data placed in transfer state, and validate the `Host` header and allowed hosts configuration.
- **[MANDATORY]** Keep Angular and dependencies current (`ng update`, `npm audit` or an SCA tool in CI), and use lint rules that flag `bypassSecurityTrust*`, `innerHTML` assignments, and `eval`.
- **[TESTING]** Tests cover XSS payloads rendered through components (they must appear as text), interceptors that must not attach tokens to foreign origins, and 401/403 handling; CSP violations are reported (`report-to`) and monitored.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
