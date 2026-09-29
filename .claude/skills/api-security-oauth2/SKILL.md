---
name: api-security-oauth2
description: "Securing APIs with OAuth 2.x and OpenID Connect: choosing flows (authorization code + PKCE, client credentials, token exchange), token validation (issuer, audience, signature, expiry), scopes and claims design, object-level authorization, BFF for browsers, API keys, mTLS, rate limiting, and OWASP API Security Top 10. Use it when designing or reviewing authentication and authorization for any API."
---

# Skill: API Security with OAuth 2 and OpenID Connect

## Implementation Rules:
- **[ARCHITECTURE]** Delegate authentication to an identity provider (Keycloak, Entra ID, Auth0, Okta, Cognito); APIs act as OAuth 2 resource servers that validate access tokens and never handle user passwords.
- **[MANDATORY]** Choose the flow by client type: Authorization Code with PKCE for web, mobile, and SPA clients (never the implicit or password grants); Client Credentials for service-to-service; Token Exchange (RFC 8693) to call downstream APIs on behalf of a user; Device Authorization for input-constrained devices.
- **[PATTERN]** Browser applications use the Backend-for-Frontend pattern: the BFF performs the OAuth flow, keeps tokens server-side, and gives the browser an `HttpOnly; Secure; SameSite` session cookie; tokens are never stored in `localStorage`.
- **[MANDATORY]** Validate every access token: signature with keys from the issuer's JWKS (cached, rotated by `kid`), allowed algorithms fixed server-side (e.g. `RS256`, `ES256`; never `none`), `iss` equal to the expected issuer, `aud` containing this API, `exp`/`nbf` with small clock skew; use opaque tokens with introspection (RFC 7662) when immediate revocation is required.
- **[PATTERN]** Short-lived access tokens (5–15 minutes) and rotating refresh tokens with reuse detection; sender-constrained tokens (DPoP or mTLS-bound) for high-risk APIs.
- **[PATTERN]** Scope design: coarse-grained, API-oriented scopes (`orders:read`, `orders:write`) checked per operation; fine-grained permissions and roles come from claims or an authorization service (RBAC/ABAC/ReBAC, e.g. OPA, OpenFGA, Cedar); scopes express what the client may do, not everything the user may do.
- **[MANDATORY]** Object-level and function-level authorization on every request (OWASP API1 and API5): check ownership/tenant of each resource id and the permission for each operation in the service, not only at the gateway.
- **[MANDATORY]** Property-level authorization (OWASP API3): explicit input DTOs to prevent mass assignment and explicit output DTOs to avoid exposing sensitive fields.
- **[PATTERN]** API keys only identify client applications for quota and analytics, never users; they are long random secrets, stored hashed, scoped, rotatable, and sent in a header, never in the URL.
- **[SECURITY]** Service-to-service traffic uses mTLS or workload identity (SPIFFE/SPIRE, cloud IAM) plus audience-restricted tokens; no shared static passwords between services.
- **[MANDATORY]** Abuse protection (OWASP API4 and API6): rate limits and quotas per client and per user, request size limits, pagination caps, and protection of sensitive business flows (sign-up, checkout, password reset) against automation.
- **[SECURITY]** Error responses do not leak whether a resource exists for unauthorized callers (prefer 404 for other tenants' objects), and `WWW-Authenticate` headers follow RFC 6750 for token errors.
- **[FORBIDDEN]** Custom token formats or home-made JWT validation, accepting tokens from multiple issuers without explicit configuration, trusting claims from unverified tokens, and disabling TLS certificate verification for the IdP.
- **[TESTING]** Automated tests for each endpoint: missing token (401), expired or wrong-audience token (401), insufficient scope (403), other tenant's object (404/403), and mass-assignment attempts; include security headers and CORS in API tests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
