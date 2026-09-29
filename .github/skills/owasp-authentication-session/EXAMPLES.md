# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Login with a custom controller and HTTP session (Java/Spring)
```java
@RestController
public class LoginController {

    private static final Logger log = LoggerFactory.getLogger(LoginController.class);
    private final UserRepository users;

    public LoginController(UserRepository users) {
        this.users = users;
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestParam String email,
                                        @RequestParam String password,
                                        HttpServletRequest request) throws Exception {
        Optional<User> user = users.findByEmail(email);
        if (user.isEmpty()) {
            return ResponseEntity.status(404).body("User not registered");
        }
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        String hash = HexFormat.of().formatHex(md.digest(password.getBytes(StandardCharsets.UTF_8)));
        if (!hash.equals(user.get().getPasswordHash())) {
            return ResponseEntity.status(401).body("Wrong password");
        }
        // the session created before login (same ID) is reused
        HttpSession session = request.getSession();
        session.setAttribute("USER_ID", user.get().getId());
        session.setAttribute("ROLE", user.get().getRole());
        log.info("Successful login for {}", email);
        return ResponseEntity.ok("Welcome");
    }
}
```
**Why it's wrong:**
- SHA-256 without salt or work factor: with GPUs billions of candidates per second can be tried and identical passwords have identical hashes (CWE-916, A02:2021).
- 404 "User not registered" versus 401 "Wrong password", and the different response time (no hash computed if the user does not exist), reveal which emails are registered (CWE-204, A07:2021).
- The session ID is not regenerated: an ID set by the attacker before login becomes an authenticated session (CWE-384, A07:2021).
- No rate limiting or lockout: unlimited brute force and credential stuffing (CWE-307).

### 2. JWT verification middleware and token storage in the SPA (Node.js/TypeScript)
```typescript
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';

const PUBLIC_KEY = fs.readFileSync('./keys/public.pem', 'utf8');

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // token also accepted from the query string (?token=<jwt>)
  const token = req.headers.authorization?.replace('Bearer ', '') ?? String(req.query.token);
  try {
    // no algorithms/issuer/audience: the token header decides
    const decoded = jwt.verify(token, PUBLIC_KEY) as jwt.JwtPayload;
    req.user = { id: decoded.sub!, role: decoded.role };
    return next();
  } catch {
    // "temporary" fallback for legacy clients with expired or badly signed tokens
    const unverified = jwt.decode(token) as jwt.JwtPayload | null;
    if (unverified?.sub) {
      req.user = { id: unverified.sub, role: unverified.role };
      return next();
    }
    return res.status(401).end();
  }
}

// SPA code
export async function login(email: string, password: string): Promise<void> {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { accessToken } = await r.json();      // access token valid for 30 days
  localStorage.setItem('accessToken', accessToken);
}
```
**Why it's wrong:**
- The `jwt.decode` fallback accepts any token without verifying the signature: anyone can forge `{"sub": "1", "role": "admin"}` (CWE-347, A02:2021; outcome A07:2021).
- Without `algorithms` the algorithm depends on the header and the library defaults (in jsonwebtoken < 9 CVE-2022-23540/CVE-2022-23541); `iss` and `aud` are not validated, so tokens from other services of the same IdP are accepted.
- Tokens in the query string end up in proxy logs, history, and `Referer`; in `localStorage` they can be exfiltrated by any XSS (CWE-922).
- A 30-day validity with no revocation turns every token theft into long-term access (CWE-613).

### 3. "Forgot password" flow (Python/FastAPI)
```python
import random

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

from .db import db
from .mail import send_mail
from .security import hash_password

app = FastAPI()


class ForgotRequest(BaseModel):
    email: str


class ResetConfirm(BaseModel):
    token: str
    new_password: str


@app.post("/password/forgot")
def forgot(body: ForgotRequest, request: Request):
    user = db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(404, "Email not registered")
    token = str(random.randint(100000, 999999))        # 6 digits from a non-cryptographic PRNG
    db.users.update_one({"_id": user["_id"]}, {"$set": {"reset_token": token}})
    link = f"https://{request.headers['host']}/reset?token={token}"   # host chosen by the client
    send_mail(body.email, "Password reset", link)
    return {"status": "sent"}


@app.post("/password/reset")
def reset(body: ResetConfirm):
    user = db.users.find_one({"reset_token": body.token})
    if not user:
        raise HTTPException(400, "Invalid token")
    db.users.update_one({"_id": user["_id"]},
                        {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"status": "ok"}
```
**Why it's wrong:**
- `random.randint` is not a CSPRNG and a million combinations without a rate limit can be enumerated quickly (CWE-330/CWE-338, CWE-640, A07:2021).
- The token is stored in plaintext, with no expiry, and never invalidated: it stays reusable and anyone who reads the DB can reset any account.
- The link uses the `Host` header: an attacker requests a reset for the victim with `Host: attacker.example` and receives the token when the victim clicks (host header poisoning).
- 404 "Email not registered" allows user enumeration (CWE-204) and active sessions are not revoked after the reset.

## Best Practice (How to do it right)

### 1. Login with a custom controller and HTTP session (Java/Spring)
```java
// Prefer Spring Security's formLogin/AuthenticationManager, which applies
// changeSessionId() by default; here is the correct version of a custom controller.
@RestController
public class LoginController {

    // Argon2id: saltLength=16, hashLength=32, parallelism=1, memory=19456 KiB, iterations=2
    private static final PasswordEncoder ENCODER = new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
    // dummy hash: same computational cost even if the user does not exist
    private static final String DUMMY_HASH = ENCODER.encode("dummy-password-for-timing");

    private final UserRepository users;
    private final LoginAttemptService attempts;   // progressive lockout per account and IP (Redis)
    private final SecurityEventLogger securityLog;

    public LoginController(UserRepository users, LoginAttemptService attempts, SecurityEventLogger securityLog) {
        this.users = users;
        this.attempts = attempts;
        this.securityLog = securityLog;
    }

    @PostMapping("/login")
    public ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        String email = body.email().trim().toLowerCase(Locale.ROOT);
        String ip = request.getRemoteAddr();
        if (attempts.isBlocked(email, ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
        }
        Optional<User> user = users.findByEmail(email);
        String storedHash = user.map(User::getPasswordHash).orElse(DUMMY_HASH);
        boolean valid = ENCODER.matches(body.password(), storedHash) && user.isPresent();
        if (!valid) {
            attempts.recordFailure(email, ip);
            securityLog.loginFailed(email, ip);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();   // single response
        }
        attempts.reset(email, ip);
        if (ENCODER.upgradeEncoding(storedHash)) {
            users.updatePasswordHash(user.get().getId(), ENCODER.encode(body.password()));
        }
        // anti session fixation: invalidate the pre-login session and create a new one
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        HttpSession session = request.getSession(true);
        session.setAttribute("USER_ID", user.get().getId());
        session.setMaxInactiveInterval(15 * 60);
        securityLog.loginSucceeded(user.get().getId(), ip);
        return ResponseEntity.noContent().build();
    }
}
```
**Why it's right:**
- Argon2id with the OWASP parameters (19 MiB, t=2, p=1) and a random salt per password; `upgradeEncoding` realigns hashes when parameters change.
- A 401 response without a body for every failure and verification against `DUMMY_HASH` when the user does not exist: no difference in message or timing.
- The pre-login session is invalidated and recreated, eliminating session fixation; the idle timeout is explicit.
- Progressive lockout and security event logging counter brute force and credential stuffing and provide data for alerting.

### 2. JWT verification middleware and token storage in the SPA (Node.js/TypeScript)
```typescript
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import type { NextFunction, Request, Response } from 'express';

const ISSUER = process.env.OIDC_ISSUER!;       // e.g. https://idp.example.com/realms/prod
const AUDIENCE = process.env.OIDC_AUDIENCE!;   // e.g. orders-api
// JWKS from a fixed URL in configuration, with cache and cooldown handled by jose
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  // token only from the Authorization header or the BFF's HttpOnly cookie, never from the query string
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.['__Host-at'];
  if (!token) return res.status(401).end();
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],          // fixed algorithm: no none, no HS256
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTolerance: 30,             // seconds
      maxTokenAge: '15m',             // rejects tokens issued more than 15 minutes ago
      requiredClaims: ['exp', 'iat', 'sub'],
    });
    req.user = { id: payload.sub!, roles: Array.isArray(payload.roles) ? payload.roles : [] };
    return next();
  } catch (e) {
    if (e instanceof errors.JWTExpired) {
      res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    }
    return res.status(401).end();
  }
}

// BFF: the refresh token stays on the server, the browser only gets an HttpOnly cookie
export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie('__Host-at', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
}
```
**Why it's right:**
- `jwtVerify` with `algorithms`, `issuer`, `audience`, and `requiredClaims` rejects `alg: none`, HS256/RS256 confusion, and tokens intended for other services; there is no path without signature verification.
- `maxTokenAge` and the cookie's `maxAge` limit the token's life to 15 minutes; renewal happens in the BFF with refresh rotation.
- The token is never in the query string or in `localStorage`: the `__Host-` cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, and bound to the host.
- Keys come from the configured IdP's JWKS, supporting rotation via `kid` with no keys in the code.

### 3. "Forgot password" flow (Python/FastAPI)
```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from .db import db
from .mail import send_mail
from .security import hash_password, revoke_all_sessions
from .settings import settings  # PUBLIC_BASE_URL from configuration, not from the Host header

app = FastAPI()
RESET_TTL = timedelta(minutes=20)


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetConfirm(BaseModel):
    token: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")
    new_password: str = Field(min_length=15, max_length=128)


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@app.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
def forgot(body: ForgotRequest, tasks: BackgroundTasks):  # rate limit per IP and email in the middleware
    user = db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)  # 256 bits from a CSPRNG
        db.users.update_one({"_id": user["_id"]}, {"$set": {
            "reset_token_hash": _digest(token),
            "reset_expires": datetime.now(timezone.utc) + RESET_TTL}})
        link = f"{settings.PUBLIC_BASE_URL}/reset#token={token}"  # fragment: out of logs and Referer
        tasks.add_task(send_mail, user["email"], "Password reset", link)
    # identical response for registered and unregistered addresses
    return {"message": "If the address is registered you will receive an email"}


@app.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset(body: ResetConfirm):
    new_hash = hash_password(body.new_password)  # Argon2id, always computed: uniform timing
    # atomic consumption: the token is valid only once and only before expiry
    user = db.users.find_one_and_update(
        {"reset_token_hash": _digest(body.token),
         "reset_expires": {"$gt": datetime.now(timezone.utc)}},
        {"$set": {"password_hash": new_hash},
         "$unset": {"reset_token_hash": "", "reset_expires": ""}})
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired token")
    revoke_all_sessions(user["_id"])
```
**Why it's right:**
- A 256-bit token generated with `secrets`, stored only as SHA-256, with a 20-minute expiry and consumed atomically by `find_one_and_update`: single-use and unusable even with read access to the DB.
- The link uses `PUBLIC_BASE_URL` from configuration and carries the token in the fragment, which is not sent to the server or included in the `Referer`.
- An identical 202 response and sending the email in the background eliminate enumeration by content and by timing.
- After the reset all sessions are revoked and the new password respects the NIST minimum length.
