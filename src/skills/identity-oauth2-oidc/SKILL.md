---
name: identity-oauth2-oidc
description: "Identity architecture with OAuth 2.0 and OpenID Connect: choosing and centralizing the identity provider, flows per client type (Authorization Code with PKCE, client credentials, device flow, token exchange), token formats and lifetimes, refresh token rotation, sessions and the Backend-for-Frontend pattern, federation and SSO with SAML and OIDC, MFA and passkeys, machine identities, and account lifecycle. Use it when designing or reviewing authentication and identity for applications and APIs."
---

# Skill: Identity with OAuth 2.0 and OIDC

## Implementation Rules:
- **[ARCHITECTURE]** Centralize authentication in one identity provider (Microsoft Entra ID, Okta, Auth0, Keycloak, Amazon Cognito, Google Identity Platform) or a small, deliberate set per audience (workforce vs customers); applications never implement password storage or login protocols themselves.
- **[MANDATORY]** Use the right flow per client, following OAuth 2.0 Security Best Current Practice (RFC 9700): Authorization Code with PKCE for web, SPA, mobile, and desktop apps; client credentials for service-to-service; device authorization grant for input-constrained devices; token exchange (RFC 8693) for delegation across services. The implicit and resource owner password grants are not used.
- **[PATTERN]** Browser-based applications use the Backend-for-Frontend pattern: the BFF performs the OAuth flow as a confidential client and keeps tokens server-side, while the browser holds only an `HttpOnly`, `Secure`, `SameSite` session cookie.
- **[MANDATORY]** Keep access tokens short-lived (minutes), audience-restricted (`aud` per API), and scoped minimally; refresh tokens are rotated on use with reuse detection, bound to the client (and sender-constrained with DPoP or mTLS for high-risk clients), and revocable.
- **[PATTERN]** APIs validate tokens fully: signature against the IdP's JWKS with algorithm allow-listing, issuer, audience, expiry, and required scopes or roles; use introspection or short lifetimes when immediate revocation matters.
- **[SECURITY]** Require phishing-resistant MFA for workforce and privileged users (passkeys/WebAuthn or FIDO2 security keys), offer passkeys to customers, apply step-up authentication (`acr_values`, `max_age`) for sensitive operations, and protect login with rate limiting and breached-password checks.
- **[PATTERN]** Federate enterprise customers and partners with OIDC or SAML to their IdPs, map external groups to application roles explicitly, and automate provisioning and deprovisioning with SCIM.
- **[PATTERN]** Give workloads their own identities: workload identity federation, managed identities, or SPIFFE/SPIRE instead of shared static secrets; separate machine identities per service and environment.
- **[FORBIDDEN]** Tokens in URLs or browser `localStorage`, long-lived bearer tokens for users, ID tokens used as API access tokens, wildcard redirect URIs, and shared accounts.
- **[MANDATORY]** Manage the identity lifecycle: joiner-mover-leaver processes, session and token revocation on account disable, periodic access reviews for privileged roles, and audit logs of authentication events sent to the SIEM.
- **[TESTING]** Test identity flows end to end: redirect URI validation, state and nonce handling, PKCE enforcement, token expiry and refresh rotation, logout and revocation, and authorization failures across tenants and roles.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
