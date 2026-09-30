# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Implicit flow, tokens in the browser, one token for everything
```text
SPA -> /authorize?response_type=token&redirect_uri=https://*.example.com/*   (implicit flow, wildcard redirect)
access_token (24h, aud: "all-apis", scope: "*") stored in localStorage
Same token forwarded from the SPA to billing, orders, and admin APIs
Service-to-service calls reuse the user's token or a shared API key "internal-key-2019"
```
**Why it's wrong:**
- Tokens are exposed to any XSS, valid for a day, accepted by every API, and cannot be scoped or revoked meaningfully.
- Wildcard redirects enable token theft; services share a static key that never rotates.

## Best Practice (How to do it right)

### 1. Target identity architecture
```text
Workforce:  Entra ID (SSO, passkeys/FIDO2 required for admins, SCIM to apps)
Customers:  Customer IdP (Authorization Code + PKCE, passkeys offered, step-up for payment changes)

Web app:    Browser --session cookie--> BFF (confidential client) --access token (aud=orders-api, 5 min)--> Orders API
Mobile app: Authorization Code + PKCE via system browser; refresh token rotation with reuse detection
Services:   Orders API --token exchange (RFC 8693, aud=billing-api, scope=invoices:create)--> Billing API
Batch jobs: client credentials via workload identity federation (no static secrets)
```
### 2. API token validation (Python, PyJWT)
```python
jwks = jwt.PyJWKClient("https://login.example.com/.well-known/jwks.json", cache_keys=True)

def validate(token: str, required_scope: str) -> Claims:
    key = jwks.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        key.key,
        algorithms=["RS256", "ES256"],                   # allow-list, never taken from the token header alone
        audience="orders-api",
        issuer="https://login.example.com/",
        options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        leeway=30,
    )
    if required_scope not in claims.get("scope", "").split():
        raise Forbidden("insufficient_scope")
    return Claims(**claims)
```
**Why it's right:**
- Each client type uses the recommended flow; browsers never hold tokens, and each API receives a short-lived, audience-restricted token.
- Delegation between services uses token exchange with narrower scopes, and machines use federated identities.
- APIs validate signature, algorithm, issuer, audience, expiry, and scope explicitly.
