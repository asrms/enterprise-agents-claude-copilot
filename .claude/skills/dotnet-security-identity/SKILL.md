---
name: dotnet-security-identity
description: "Security for ASP.NET Core applications: JWT bearer and OpenID Connect authentication, policy-based and resource-based authorization, ASP.NET Core Identity hardening, Data Protection keys, secrets management with Key Vault and managed identities, anti-forgery, CORS, headers, and dependency scanning. Use it when implementing or reviewing .NET application security."
---

# Skill: .NET Security and Identity

## Implementation Rules:
- **[MANDATORY]** Authenticate APIs with `AddAuthentication().AddJwtBearer()` validating issuer, audience, lifetime, and signing keys from the identity provider's metadata (Entra ID, Auth0, Keycloak, Duende IdentityServer); never implement custom token parsing or accept unsigned tokens.
- **[MANDATORY]** Authorize with policies, not scattered role checks: define policies for scopes and permissions (`RequireClaim("scope", "orders:write")`), set a fallback policy that requires authenticated users (`FallbackPolicy`), and opt out explicitly with `AllowAnonymous` only where intended.
- **[MANDATORY]** Enforce resource-based authorization for object access with `IAuthorizationService.AuthorizeAsync(user, resource, requirement)` or tenant/owner filters in queries, to prevent IDOR regardless of role.
- **[PATTERN]** Web applications with server-rendered UI use OpenID Connect with authorization code flow and PKCE and cookie sessions (`HttpOnly`, `Secure`, `SameSite=Lax` or `Strict`); SPAs use a Backend-for-Frontend instead of storing tokens in browser storage.
- **[SECURITY]** When using ASP.NET Core Identity: require confirmed accounts, strong password rules with breached-password checks, lockout on repeated failures, and multi-factor authentication for privileged users; never store passwords outside the Identity hasher.
- **[SECURITY]** Configure Data Protection for multi-instance deployments: persist keys to shared storage (Blob Storage, Redis, database) and protect them with a key encryption key (Key Vault), with a stable application name.
- **[MANDATORY]** Secrets never live in `appsettings.json` or source control: use user-secrets locally, Azure Key Vault/AWS Secrets Manager via configuration providers in deployed environments, and managed identities (`DefaultAzureCredential`) instead of connection-string credentials where possible.
- **[SECURITY]** Enable anti-forgery for cookie-authenticated forms and endpoints (`AddAntiforgery`, `UseAntiforgery`), HTTPS redirection and HSTS, security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`), and CORS with explicit origins.
- **[FORBIDDEN]** `BinaryFormatter` and other insecure deserializers, `TypeNameHandling.All` in Newtonsoft.Json with untrusted input, string-concatenated SQL, disabling certificate validation (`ServerCertificateCustomValidationCallback = (...) => true`), and logging tokens or personal data.
- **[PATTERN]** Protect against abuse: rate limiting on authentication and expensive endpoints, request size limits, validation of file uploads (size, type by content, storage outside the web root), and constant-time comparison for secrets (`CryptographicOperations.FixedTimeEquals`).
- **[MANDATORY]** Dependencies are scanned continuously (`dotnet list package --vulnerable --include-transitive`, Dependabot, NuGet audit with `NuGetAuditMode=all`), and builds fail on high or critical vulnerabilities.
- **[TESTING]** Integration tests verify 401 for anonymous calls, 403 for insufficient scopes, 404/403 for cross-tenant resources, and anti-forgery rejection, using a test authentication handler in `WebApplicationFactory`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
