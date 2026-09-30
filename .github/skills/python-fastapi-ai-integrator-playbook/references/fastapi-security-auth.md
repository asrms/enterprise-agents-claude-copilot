# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Insecure JWT verification and implicit authorization
```python
import jwt
from fastapi import Header, HTTPException

SECRET = "super-secret-key-2024"


async def get_current_user(authorization: str = Header()) -> dict:
    token = authorization.replace("Bearer ", "")
    header = jwt.get_unverified_header(token)
    try:
        payload = jwt.decode(
            token,
            SECRET,
            algorithms=[header["alg"]],
            options={"verify_aud": False},
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    return payload


async def get_current_user_fast(authorization: str = Header()) -> dict:
    # "optimization": the gateway has already verified the token anyway
    return jwt.decode(authorization[7:], options={"verify_signature": False})


async def require_admin(authorization: str = Header()) -> dict:
    user = await get_current_user(authorization)
    if "admin" not in str(user):
        raise HTTPException(status_code=403)
    return user
```
**Why it's wrong:**
- The algorithm is taken from the token header (algorithm confusion) and the HS256 secret is hardcoded in the code.
- Disabling `verify_aud` accepts tokens issued for other applications; the "fast" variant does not even verify the signature.
- The error message reflects the exception details and authorization is a string check instead of typed scopes.

### 2. Permissive CORS, public docs, and errors that expose the stack trace
```python
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(debug=True, title="Ticket AI API")  # /docs and /openapi.json public even in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "type": type(exc).__name__,
            "trace": traceback.format_exc(),
            "headers": dict(request.headers),
        },
    )
```
**Why it's wrong:**
- `allow_origins=["*"]` with `allow_credentials=True`: Starlette can reflect the request's `Origin`, allowing any site to call the API with the user's cookies.
- `debug=True` and public documentation reveal the attack surface and tracebacks.
- The error body contains the stack trace and all headers, including `Authorization`; `TrustedHostMiddleware` is missing.

### 3. In-memory rate limiting and an API key compared in plaintext
```python
import os
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Query, Request

router = APIRouter(prefix="/chat", tags=["chat"])
_hits: dict[str, list[float]] = defaultdict(list)


@router.post("/completions")
async def chat(request: Request, body: ChatIn, api_key: str = Query()) -> ChatOut:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _hits[ip] = [t for t in _hits[ip] if now - t < 60]
    if len(_hits[ip]) >= 30:
        raise HTTPException(status_code=429)
    _hits[ip].append(now)

    if api_key != os.environ["INTERNAL_API_KEY"]:
        raise HTTPException(status_code=401, detail="Wrong API key")

    return await chat_service.reply(body)
```
**Why it's wrong:**
- Counters in a per-process `dict`: every worker and replica has its own limit, memory grows without bound, and behind a proxy all clients share the same IP.
- The API key travels in the query string (it ends up in proxy and browser logs) and is compared with `!=`, which is vulnerable to timing attacks.
- No `Retry-After`, no link to the authenticated identity, and security logic mixed into the route.

## Best Practice (How to do it right)

### 1. Insecure JWT verification and implicit authorization
```python
# app/api/security.py
import logging
from typing import Annotated

import anyio
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, SecurityScopes

from app.api.deps import ContainerDep
from app.domain.auth import Principal

security_log = logging.getLogger("security")
bearer_scheme = HTTPBearer(auto_error=False)


def _auth_error(status_code: int, code: str, scope: str = "") -> HTTPException:
    challenge = f'Bearer error="{code}"' + (f', scope="{scope}"' if scope else "")
    return HTTPException(status_code=status_code, detail=code, headers={"WWW-Authenticate": challenge})


async def get_current_principal(
    security_scopes: SecurityScopes,
    container: ContainerDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal:
    if credentials is None:
        raise _auth_error(status.HTTP_401_UNAUTHORIZED, "invalid_request")
    auth, token = container.settings.auth, credentials.credentials
    try:
        # PyJWKClient is synchronous: refreshing the JWKS must not block the event loop
        signing_key = await anyio.to_thread.run_sync(container.jwks_client.get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=list(auth.algorithms),  # e.g. ["RS256"], fixed by config
            audience=auth.audience,
            issuer=auth.issuer,
            leeway=auth.leeway_s,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "tid"]},
        )
    except jwt.PyJWTError as exc:
        security_log.info("jwt_rejected", extra={"reason": type(exc).__name__})
        raise _auth_error(status.HTTP_401_UNAUTHORIZED, "invalid_token") from None
    granted = frozenset(str(claims.get("scp", "")).split())
    if not granted.issuperset(security_scopes.scopes):
        security_log.info("scope_denied", extra={"sub": claims["sub"], "required": security_scopes.scope_str})
        raise _auth_error(status.HTTP_403_FORBIDDEN, "insufficient_scope", security_scopes.scope_str)
    return Principal(subject=claims["sub"], tenant_id=claims["tid"], scopes=granted)


TicketReader = Annotated[Principal, Security(get_current_principal, scopes=["tickets:read"])]
TicketWriter = Annotated[Principal, Security(get_current_principal, scopes=["tickets:write"])]
```
**Why it's right:**
- Signature verified with a JWKS key, algorithms fixed by config, and mandatory claims (`exp`, `aud`, `iss`, `sub`, `tid`) checked by PyJWT.
- Scopes declared on the route via `Security()`/`SecurityScopes`, with a clear distinction between 401 (token) and 403 (permissions) and a compliant `WWW-Authenticate` challenge.
- The log records only the rejection reason and the `sub`, never the token; the synchronous JWKS call is moved to a thread.

### 2. Permissive CORS, public docs, and errors that expose the stack trace
```python
# app/main.py (excerpt)
import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger("app.errors")


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id: str = getattr(request.state, "request_id", uuid4().hex)
    logger.exception("unhandled_error", extra={"request_id": request_id, "path": request.url.path})
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error", "request_id": request_id}})


async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    errors = exc.errors() if isinstance(exc, RequestValidationError) else []
    details = [{"loc": e["loc"], "type": e["type"], "msg": e["msg"]} for e in errors]  # no "input"
    return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "details": details}})


def create_app(settings: Settings) -> FastAPI:
    is_prod = settings.environment == "production"
    app = FastAPI(
        debug=False,
        lifespan=lifespan,
        docs_url=None if is_prod else "/docs",
        redoc_url=None,
        openapi_url=None if is_prod else "/openapi.json",
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,  # explicit list, validated in Settings
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        allow_credentials=False,
        max_age=600,
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)  # last = outermost
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
    return app
```
**Why it's right:**
- Documentation and OpenAPI schema turned off in production; explicit `debug=False`.
- CORS limited to declared origins, methods, and headers; `TrustedHostMiddleware` is the outermost middleware and discards disallowed hosts.
- Errors return only a code and the `request_id` for correlation; 422s do not echo the input and the full detail stays in the logs.

### 3. In-memory rate limiting and an API key compared in plaintext
```python
# app/api/guards.py
import hmac
import time
from typing import Annotated

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.api.deps import ContainerDep
from app.api.security import ChatUser

api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


async def enforce_llm_rate_limit(principal: ChatUser, container: ContainerDep) -> None:
    cfg = container.settings.rate_limit
    window = int(time.time() // cfg.window_s)
    key = f"rl:llm:{principal.tenant_id}:{principal.subject}:{window}"
    async with container.redis.pipeline(transaction=True) as pipe:
        pipe.incr(key)
        pipe.expire(key, cfg.window_s)
        count, _ = await pipe.execute()
    if count > cfg.llm_requests_per_window:
        retry_after = cfg.window_s - int(time.time()) % cfg.window_s
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "rate_limited", headers={"Retry-After": str(retry_after)}
        )


async def require_service_key(
    provided: Annotated[str | None, Security(api_key_scheme)], container: ContainerDep
) -> None:
    expected = container.settings.internal_api_key.get_secret_value().encode()
    if provided is None or not hmac.compare_digest(provided.encode(), expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_api_key")


# app/api/v1/chat.py
@router.post("/completions", response_model=ChatOut, dependencies=[Depends(enforce_llm_rate_limit)])
async def chat(body: ChatIn, principal: ChatUser, service: ChatServiceDep) -> ChatOut:
    return ChatOut.model_validate(await service.reply(principal, body), from_attributes=True)


@router.post("/internal/reindex", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED,
             dependencies=[Depends(require_service_key)])
async def reindex(service: IndexServiceDep) -> JobAccepted:
    return JobAccepted.model_validate(await service.schedule_reindex(), from_attributes=True)
```
**Why it's right:**
- The counter lives in Redis, shared across workers and replicas, with a key tied to the tenant and the authenticated user and automatic expiry of the window.
- The 429 includes `Retry-After`; the limit is a reusable dependency, separate from the route logic.
- The service API key comes from a header, is read from `SecretStr`, and is compared in constant time with `hmac.compare_digest`.
