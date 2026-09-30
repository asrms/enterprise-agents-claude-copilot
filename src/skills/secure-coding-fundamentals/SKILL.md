---
name: secure-coding-fundamentals
description: "Language-agnostic secure coding baseline: trust boundaries, input validation and output encoding, parameterized interpreters, authorization on every request, secrets handling, safe error handling and logging, dependency hygiene, and secure defaults. Use it when writing or reviewing any code that handles external input, data, or credentials."
---

# Skill: Secure Coding Fundamentals

## Implementation Rules:
- **[ARCHITECTURE]** Identify trust boundaries first: HTTP requests, message consumers, file uploads, CLI arguments, environment, third-party API responses, and LLM output are untrusted; everything crossing a boundary is validated at the boundary and treated as data, never as code.
- **[MANDATORY]** Validate input with allowlists (type, length, format, range, enum membership) using schema validators (Bean Validation, Pydantic, zod, FluentValidation, go-playground/validator); reject invalid input with a 4xx instead of "fixing" it silently.
- **[MANDATORY]** Separate code from data at every interpreter: parameterized SQL/NoSQL queries, argument arrays for OS commands (no shell), templates with autoescape, LDAP/XPath encoders; string concatenation into an interpreter is forbidden regardless of prior validation.
- **[MANDATORY]** Encode output for its context (HTML body, HTML attribute, JavaScript, URL, CSS, JSON, log line) using framework encoders; rich HTML from users passes through an allowlist sanitizer.
- **[MANDATORY]** Authorize on the server for every request and every object: check ownership/tenant on each ID received (no IDOR), enforce deny-by-default routing, and never rely on hidden UI elements, client-side checks, or client-supplied roles.
- **[FORBIDDEN]** Secrets in source code, config files under version control, container images, logs, URLs, or error messages; secrets come from a secret manager or injected environment/files, are rotated, and have least-privilege scopes.
- **[SECURITY]** Use vetted cryptography only: TLS 1.2+ with certificate verification on every connection, Argon2id/bcrypt for passwords, AES-GCM or libsodium for encryption, HMAC for integrity, CSPRNG for tokens; no home-made crypto, MD5/SHA-1, ECB, or `Math.random()` for security values.
- **[SECURITY]** Fail closed and fail safely: on errors in authentication, authorization, or validation the request is denied; error responses are generic (with a correlation id) and never expose stack traces, SQL, file paths, or library versions.
- **[FORBIDDEN]** Logging sensitive data (passwords, tokens, session ids, full card numbers, personal data beyond what is necessary) and logging untrusted input without neutralizing CR/LF (log injection); use structured logs with values as fields.
- **[SECURITY]** Least privilege everywhere: database users without DDL/owner rights, service accounts scoped to one resource, containers as non-root with read-only filesystem, API tokens with minimal scopes and short lifetimes.
- **[SECURITY]** Safe file handling: generate server-side file names (UUID), verify path containment after canonicalization, limit size and type (magic bytes, not only extension), store uploads outside the web root, and scan them if they are shared with other users.
- **[FORBIDDEN]** Deserializing untrusted data with native object serializers (Java `ObjectInputStream`, Python `pickle`, `yaml.load`, .NET `BinaryFormatter`, PHP `unserialize`); use data-only formats (JSON, Protobuf) bound to explicit types.
- **[SECURITY]** Server-side requests to user-supplied URLs use an allowlist of hosts and schemes, block private and metadata IP ranges after DNS resolution, and disable redirects (SSRF).
- **[SECURITY]** Protect state-changing requests from CSRF when using cookies (SameSite + anti-CSRF token), set security headers (CSP, HSTS, `X-Content-Type-Options`), and set cookies `HttpOnly; Secure; SameSite`.
- **[CONFIGURATION]** Secure defaults in configuration: debug off, admin endpoints and API docs disabled or authenticated in production, CORS restricted to known origins, default credentials removed, verbose headers (`Server`, `X-Powered-By`) suppressed.
- **[MANDATORY]** Dependency hygiene: lockfiles committed, dependencies pinned and scanned (SCA) in CI with a failing threshold on high/critical vulnerabilities with an available fix, and a documented process for exceptions with an expiry date.
- **[TESTING]** Security behavior is tested like any other behavior: unauthorized (401), forbidden (403/404 for other tenants), invalid input (400/422), injection payloads treated as data, and absence of sensitive data in responses and logs.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
