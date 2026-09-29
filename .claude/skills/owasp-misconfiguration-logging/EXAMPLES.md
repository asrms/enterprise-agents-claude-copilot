# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Spring Boot production profile (application-prod.yml)
```yaml
# application-prod.yml
server:
  port: 8080
  error:
    include-stacktrace: always        # stack trace in the error JSON
    include-message: always
    include-binding-errors: always
    include-exception: true

spring:
  datasource:
    url: jdbc:postgresql://db.prod.internal:5432/orders
    username: orders_app
    password: Orders2024!             # plaintext credential in the repository
  security:
    user:
      name: admin
      password: admin                 # default user never changed
  devtools:
    remote:
      secret: devtools-secret         # remote DevTools enabled

management:
  endpoints:
    web:
      exposure:
        include: "*"                  # env, heapdump, loggers, threaddump, shutdown...
  endpoint:
    health:
      show-details: always
    env:
      show-values: always

logging:
  level:
    root: DEBUG
    org.hibernate.SQL: DEBUG
    org.hibernate.orm.jdbc.bind: TRACE   # SQL parameter values (PII) in the logs
    org.springframework.security: DEBUG

springdoc:
  swagger-ui:
    enabled: true
```
**Why it's wrong:**
- `include-stacktrace: always` and `include-exception: true` expose classes, versions, and queries in error responses (CWE-209, A05:2021).
- `exposure.include: "*"` on the application port makes `/actuator/heapdump` (secrets and sessions in memory) and `/actuator/env` with `show-values: always` downloadable (CWE-200, A05:2021, CVSS up to 7.5).
- The DB password and the `admin/admin` user in plaintext in the versioned file, remote DevTools with a trivial secret (CWE-798/CWE-1392, A07:2021; CWE-489).
- Global `DEBUG` and `jdbc.bind=TRACE` write SQL parameters with personal data and security details to the logs (CWE-532, A09:2021).

### 2. Error handling, CORS, and login logging (Python/FastAPI)
```python
import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import authenticate

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(message)s")
log = logging.getLogger("app")

app = FastAPI(debug=True)  # error page with traceback
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(Exception)
async def all_errors(request: Request, exc: Exception):
    return JSONResponse(status_code=500,
                        content={"error": str(exc), "trace": traceback.format_exc()})


@app.post("/login")
async def login(request: Request):
    body = await request.json()
    log.debug(f"Login request: {body} headers={dict(request.headers)}")  # password and cookies
    user = authenticate(body["username"], body["password"])
    if user is None:
        log.info("Login failed for " + body["username"])  # CRLF in the username = fake lines
        return JSONResponse(status_code=401, content={"error": "Invalid credentials"})
    log.info(f"Login ok user={user.id} token={user.session_token}")
    return {"token": user.session_token}
```
**Why it's wrong:**
- `debug=True` and the handler that returns `traceback.format_exc()` hand stack traces and internal details to the attacker (CWE-209/CWE-489, A05:2021).
- `allow_origins=["*"]` with `allow_credentials=True`: Starlette reflects the `Origin` of cookie-bearing requests, so any site can read authenticated responses (CWE-942, A05:2021).
- Passwords, the `Cookie` header, and session tokens end up in the logs in plaintext (CWE-532, A09:2021).
- The username concatenated into the message allows injecting fake lines such as `\nLogin ok user=admin` (CWE-117, A09:2021), and there is no correlation id to reconstruct events.

### 3. Security headers, errors, and audit events (Node.js/TypeScript)
```typescript
import express from 'express';
import cors from 'cors';
import { authenticate, changeRole } from './auth';

const app = express();
app.use(cors());                 // Access-Control-Allow-Origin: *
app.use(express.json());

app.post('/api/login', async (req, res) => {
  console.log('login attempt', req.body);            // plaintext password in the logs
  const user = await authenticate(req.body.email, req.body.password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' }); // failure not recorded
  }
  res.json({ token: user.token });
});

app.put('/api/admin/users/:id/role', async (req, res) => {
  await changeRole(req.params.id, req.body.role);    // privilege change without audit
  res.status(204).end();
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`Error on ${req.url}: ${err.message}`); // URL with a token in the query and CRLF
  res.status(500).send(`<pre>${err.stack}</pre>`);        // stack trace to the client
});

app.listen(3000);
```
**Why it's wrong:**
- No security headers (CSP, HSTS, `nosniff`, `frame-ancestors`) and the `X-Powered-By: Express` banner is active; `cors()` without options opens the APIs to any origin (CWE-693/CWE-942, A05:2021).
- Failed logins and role changes produce no security events: brute force and privilege escalation remain invisible to the SOC (CWE-778, A09:2021).
- `console.log(req.body)` records passwords and the full URL can contain tokens in the query string (CWE-532); concatenated text logs are subject to injection (CWE-117).
- The stack trace sent as HTML exposes the code and reflects unneutralized content (CWE-209, A05:2021); the admin endpoint has no role check (CWE-862).

## Best Practice (How to do it right)

### 1. Spring Boot production profile (application-prod.yml)
```yaml
# application-prod.yml
server:
  port: 8443
  ssl:
    enabled: true
    enabled-protocols: TLSv1.3,TLSv1.2
  error:
    include-stacktrace: never
    include-message: never
    include-binding-errors: never
    include-exception: false
    whitelabel:
      enabled: false

spring:
  datasource:
    url: jdbc:postgresql://db.prod.internal:5432/orders?sslmode=verify-full
    username: ${DB_USERNAME}           # injected from Vault / Secrets Manager
    password: ${DB_PASSWORD}
  mvc:
    problemdetails:
      enabled: true                    # RFC 9457 errors without internal details

management:
  server:
    port: 9090                         # management port not exposed by the ingress
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: never
      probes:
        enabled: true
    env:
      show-values: never
  info:
    env:
      enabled: false

logging:
  level:
    root: INFO
    org.hibernate.orm.jdbc.bind: WARN
  structured:
    format:
      console: ecs                     # Spring Boot >= 3.4: structured JSON logs

springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false
```
**Why it's right:**
- Error responses include no stack traces, messages, or exception classes; the `ProblemDetail` format is uniform and the details stay in the logs.
- Actuator exposes only `health`, `info`, and `prometheus` on a separate management port, with environment details and values hidden.
- No credentials in the file: values come from the secret manager, the DB connection verifies the certificate, and DevTools is absent from the profile (`developmentOnly` dependency).
- `INFO`-level logs in structured JSON (ECS), without SQL parameters, ready for the SIEM.

### 2. Error handling, CORS, and login logging (Python/FastAPI)
```python
import logging
import re
import uuid

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, SecretStr
from .auth import authenticate
from .settings import settings  # CORS_ORIGINS from configuration, e.g. ["https://app.example.com"]

structlog.configure(processors=[
    structlog.contextvars.merge_contextvars,          # correlation_id in every event
    structlog.processors.TimeStamper(fmt="iso", utc=True),
    structlog.processors.add_log_level,
    structlog.processors.dict_tracebacks,             # stack traces only in the logs
    structlog.processors.JSONRenderer(),              # \r\n stay escaped in the JSON
], wrapper_class=structlog.make_filtering_bound_logger(logging.INFO))
log = structlog.get_logger("security")
SAFE_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")

app = FastAPI(debug=False, docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def context_and_headers(request: Request, call_next):
    incoming = request.headers.get("x-correlation-id", "")
    cid = incoming if SAFE_ID.fullmatch(incoming) else str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(correlation_id=cid, client_ip=getattr(request.client, "host", None))
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled_error", path=request.url.path)
        response = JSONResponse(status_code=500, content={"error": "Internal error", "correlation_id": cid})
    response.headers["X-Correlation-Id"] = cid
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Cache-Control"] = "no-store"
    return response


class LoginRequest(BaseModel):
    username: str
    password: SecretStr  # masked repr: '**********'


@app.post("/login", status_code=204)
async def login(body: LoginRequest, response: Response):
    user = authenticate(body.username, body.password.get_secret_value())
    if user is None:
        log.warning("auth.login.failure", username=body.username[:64], reason="invalid_credentials")
        return JSONResponse(status_code=401, content={"error": "Invalid credentials"})
    log.info("auth.login.success", user_id=str(user.id))
    response.set_cookie("__Host-session", user.session_token, httponly=True, secure=True,
                        samesite="strict", path="/", max_age=1800)
```
**Why it's right:**
- Debug and interactive documentation are turned off; exceptions are recorded with stack traces only in the logs and the client receives a generic message with a correlation id.
- CORS limited to the configured origins, explicit methods and headers; security headers applied to every response, errors included.
- `SecretStr` prevents the password from appearing in logs or `repr`; the session token travels only in an `HttpOnly` `__Host-` cookie and is never logged.
- Structured JSON logs with named events (`auth.login.failure`) and values as fields: no log injection and immediate correlation in the SIEM.

### 3. Security headers, errors, and audit events (Node.js/TypeScript)
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { authenticate, changeRole, requireRole } from './auth';

const als = new AsyncLocalStorage<{ correlationId: string }>();
const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'], censor: '[REDACTED]' },
  mixin: () => ({ correlationId: als.getStore()?.correlationId }),   // correlation id on every line
});
const audit = logger.child({ stream: 'security-audit' });           // forwarded to the SIEM

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"] },
  },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
}));
app.use(cors({ origin: ['https://app.example.com'], credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  const correlationId = randomUUID();
  res.setHeader('X-Correlation-Id', correlationId);
  als.run({ correlationId }, next);
});

app.post('/api/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.slice(0, 254) : '';
  const user = await authenticate(email, req.body?.password);
  if (!user) {
    audit.warn({ event: 'auth.login.failure', email, ip: req.ip }, 'login failed');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  audit.info({ event: 'auth.login.success', userId: user.id, ip: req.ip }, 'login succeeded');
  res.cookie('__Host-session', user.sessionId, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  res.status(204).end();
});

app.put('/api/admin/users/:id/role', requireRole('ADMIN'), async (req, res) => {
  const { oldRole, newRole } = await changeRole(req.params.id, req.body.role);
  audit.info({ event: 'authz.role.changed', actorId: req.user!.id, targetId: req.params.id, oldRole, newRole },
    'role changed');
  res.status(204).end();
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, path: req.path }, 'unhandled error');       // stack only in the JSON log
  res.status(500).json({ error: 'Internal error', correlationId: als.getStore()?.correlationId });
});

app.listen(3000);
```
**Why it's right:**
- helmet sets a restrictive CSP, HSTS, `nosniff`, and `frame-ancestors`; the `X-Powered-By` banner is disabled and CORS is limited to the application's origin.
- Successful and failed logins and role changes generate structured audit events with actor, target, IP, and correlation id, ready for alerting rules.
- pino with `redact` masks sensitive headers and fields; values are JSON fields, so a `\r\n` in the email does not create fake lines.
- The returned error is generic with a correlation id, while the stack trace stays in the log; `req.path` instead of `req.url` avoids recording the query string.
