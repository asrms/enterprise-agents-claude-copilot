# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. SPA with password grant and tokens in localStorage
```javascript
const res = await fetch('https://auth.example.com/token', {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'password', username, password, client_id: 'spa', client_secret: 'abc123' }),
});
const { access_token, refresh_token } = await res.json();
localStorage.setItem('at', access_token);      // readable by any XSS
localStorage.setItem('rt', refresh_token);
```
**Why it's wrong:**
- The password grant is deprecated and exposes user credentials to the client; a client secret in a browser is not secret.
- Tokens in `localStorage` can be stolen by any injected script, including long-lived refresh tokens.

### 2. Validating only the signature
```python
claims = jwt.decode(token, jwks_key, algorithms=["RS256"], options={"verify_aud": False})
if "admin" in claims.get("roles", []):
    return delete_any_order(order_id)            # no ownership check
```
**Why it's wrong:**
- Without audience validation, a token issued for another API of the same IdP is accepted.
- Authorization relies on a broad role and never checks whether the order belongs to the caller's tenant.

## Best Practice (How to do it right)

### 1. BFF with authorization code + PKCE
```text
Browser ──(cookie __Host-session, HttpOnly, Secure, SameSite=Lax)──▶ BFF ──(Bearer access token)──▶ Orders API
   1. GET /login → BFF redirects to IdP /authorize with code_challenge (S256), state, nonce
   2. IdP → BFF /callback?code=... → BFF exchanges code + code_verifier for tokens (confidential client)
   3. BFF stores tokens server-side (encrypted session store) and sets the session cookie
   4. API calls from the browser go to the BFF, which attaches the access token and refreshes it
```
**Why it's right:**
- The browser never sees tokens or client secrets; PKCE protects the code exchange; the cookie is not readable by scripts.

### 2. Full token validation plus object-level authorization (Python)
```python
jwks = PyJWKClient(settings.oidc.jwks_uri, cache_keys=True)

def authenticate(token: str) -> Principal:
    key = jwks.get_signing_key_from_jwt(token).key
    claims = jwt.decode(
        token, key,
        algorithms=["RS256"],
        audience="orders-api",
        issuer=settings.oidc.issuer,
        leeway=30,
        options={"require": ["exp", "iat", "iss", "aud", "sub"]},
    )
    return Principal(subject=claims["sub"], tenant_id=claims["tid"], scopes=set(claims.get("scope", "").split()))

def delete_order(principal: Principal, order_id: UUID) -> None:
    if "orders:write" not in principal.scopes:
        raise Forbidden("insufficient_scope")
    deleted = orders.delete(order_id=order_id, tenant_id=principal.tenant_id)   # scoped query
    if not deleted:
        raise NotFound()                                                          # no existence leak
```
**Why it's right:**
- Signature, algorithm, issuer, audience, and expiry are validated; required claims are enforced.
- The scope gates the operation and the query scopes the object to the caller's tenant.
