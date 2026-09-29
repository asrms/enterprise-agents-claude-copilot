# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Route with inline business logic, query, and LLM call
```python
# app/main.py
import os

import httpx
from fastapi import FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Ticket

app = FastAPI()
engine = create_async_engine(os.environ["DATABASE_URL"])
SessionLocal = async_sessionmaker(engine)
llm_http = httpx.AsyncClient(base_url="https://llm-proxy.internal.example.com")
triage_cache: dict[int, str] = {}


@app.post("/tickets/{ticket_id}/triage")
async def triage_ticket(ticket_id: int) -> dict[str, str]:
    if ticket_id in triage_cache:
        return {"category": triage_cache[ticket_id]}
    async with SessionLocal() as session:
        ticket = await session.scalar(select(Ticket).where(Ticket.id == ticket_id))
        if ticket is None:
            raise HTTPException(status_code=404)
        if ticket.status == "closed":
            raise HTTPException(status_code=409, detail="Ticket closed")
        resp = await llm_http.post(
            "/v1/classify",
            json={"model": "claude-3-haiku-20240307", "text": ticket.body},
        )
        category = resp.json()["category"]
        ticket.category = category
        await session.commit()
    triage_cache[ticket_id] = category
    return {"category": category}
```
**Why it's wrong:**
- Engine, HTTP client, and cache are created at import time as mutable global state: they are never closed, the cache is not shared across workers, and it grows without bound.
- Query, business rule (closed ticket), LLM call, and commit live in the route: nothing is reusable from workers or CLIs, and every test requires a real DB and provider.
- Hardcoded model name, scattered `os.environ`, no timeout, no `response_model`, and LLM output used without validation.

### 2. Shared resources with `@app.on_event` and global variables
```python
# app/main.py
import httpx
from anthropic import AsyncAnthropic
from fastapi import FastAPI

from app.api.v1 import tickets

app = FastAPI()
http_client: httpx.AsyncClient | None = None
llm_client: AsyncAnthropic | None = None


@app.on_event("startup")
async def startup() -> None:
    global http_client, llm_client
    http_client = httpx.AsyncClient()
    llm_client = AsyncAnthropic()


@app.on_event("shutdown")
async def shutdown() -> None:
    if http_client is not None:
        await http_client.aclose()


app.include_router(tickets.router)


# app/api/v1/tickets.py
from app import main


@router.get("/{ticket_id}/summary")
async def summarize(ticket_id: int) -> dict[str, str]:
    assert main.llm_client is not None
    message = await main.llm_client.messages.create(
        model="claude-3-5-haiku-latest",
        max_tokens=512,
        messages=[{"role": "user", "content": f"Summarize ticket {ticket_id}"}],
    )
    return {"summary": message.content[0].text}
```
**Why it's wrong:**
- `@app.on_event` is deprecated and stops running as soon as a `lifespan` is introduced; `llm_client` is never closed.
- Global variables reassigned with `global` and read via `from app import main`: a fragile circular import that makes them impossible to replace with `dependency_overrides`.
- `AsyncAnthropic()` reads the key implicitly from the environment, bypassing `Settings`; `assert` disappears with `python -O`, and the httpx client has no configured timeout or limits.

### 3. Domain errors translated to HTTP inside the service
```python
# app/domain/tickets/service.py
from fastapi import HTTPException, status


class TicketService:
    def __init__(self, repo: TicketRepository) -> None:
        self._repo = repo

    async def close(self, ticket_id: int, actor_id: str) -> dict[str, object]:
        ticket = await self._repo.get(ticket_id)
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Ticket {ticket_id} missing from public.tickets")
        if ticket.owner_id != actor_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Operation reserved for {ticket.owner_id}")
        await self._repo.mark_closed(ticket_id)
        return {"id": ticket.id, "status": "closed", "owner_email": ticket.owner_email}


# app/api/v1/tickets.py
from typing import Annotated, Any

from fastapi import Header
from fastapi.responses import JSONResponse


@router.post("/{ticket_id}/close")
async def close_ticket(
    ticket_id: int, x_user_id: Annotated[str, Header()], service: TicketServiceDep
) -> Any:
    try:
        return await service.close(ticket_id, x_user_id)
    except HTTPException:
        raise
    except Exception as exc:
        return JSONResponse(status_code=500, content={"detail": repr(exc)})
```
**Why it's wrong:**
- The service depends on FastAPI: it is not reusable in an Arq worker or a CLI, and domain tests have to reason in HTTP status codes.
- The messages expose table names, the real owner's ID, and their email (information disclosure).
- The identity comes from a spoofable `X-User-Id` header, and the `except Exception` returns `repr(exc)` to the client with no logging and no `response_model`.

## Best Practice (How to do it right)

### 1. Route with inline business logic, query, and LLM call
```python
# app/api/v1/tickets.py
from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_ticket_service
from app.api.v1.schemas import TriageOut
from app.domain.tickets.service import TicketService

router = APIRouter(prefix="/tickets", tags=["tickets"])
TicketServiceDep = Annotated[TicketService, Depends(get_ticket_service)]


@router.post("/{ticket_id}/triage", response_model=TriageOut)
async def triage_ticket(ticket_id: int, service: TicketServiceDep) -> TriageOut:
    result = await service.triage(ticket_id)
    return TriageOut.model_validate(result, from_attributes=True)


# app/domain/tickets/service.py
from typing import Protocol

from app.domain.llm.ports import LLMGateway
from app.domain.tickets.entities import Ticket, TriageDecision, TriageResult
from app.domain.tickets.errors import TicketClosedError, TicketNotFoundError
from app.domain.tickets.prompts import build_triage_request


class TicketRepository(Protocol):
    async def get(self, ticket_id: int) -> Ticket | None: ...
    async def save_category(self, ticket_id: int, category: str) -> None: ...


class UnitOfWork(Protocol):
    @property
    def tickets(self) -> TicketRepository: ...
    async def commit(self) -> None: ...


class TicketService:
    def __init__(self, uow: UnitOfWork, llm: LLMGateway) -> None:
        self._uow = uow
        self._llm = llm

    async def triage(self, ticket_id: int) -> TriageResult:
        ticket = await self._uow.tickets.get(ticket_id)
        if ticket is None:
            raise TicketNotFoundError(ticket_id)
        if ticket.is_closed:
            raise TicketClosedError(ticket_id)
        response = await self._llm.complete(build_triage_request(ticket))
        decision = TriageDecision.model_validate_json(response.text)
        await self._uow.tickets.save_category(ticket_id, decision.category)
        await self._uow.commit()
        return TriageResult(ticket_id=ticket_id, category=decision.category)
```
**Why it's right:**
- The route contains only wiring and mapping; the logic lives in `TicketService`, testable with fakes of `UnitOfWork` and `LLMGateway` without FastAPI.
- The domain depends on `Protocol`s, not on SQLAlchemy or the provider SDK: adapters can be swapped without touching the service.
- The transaction boundary (`commit`) is explicit in the service, and the model output is validated with Pydantic before being persisted.

### 2. Shared resources with `@app.on_event` and global variables
```python
# app/core/lifespan.py
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

import httpx
from anthropic import AsyncAnthropic
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings


@dataclass(frozen=True, slots=True)
class AppContainer:
    settings: Settings
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]
    http_client: httpx.AsyncClient
    llm_client: AsyncAnthropic


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    engine = create_async_engine(settings.database_url.get_secret_value(), pool_pre_ping=True)
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.http.timeout_s, connect=settings.http.connect_timeout_s),
        limits=httpx.Limits(max_connections=settings.http.max_connections),
    )
    llm_client = AsyncAnthropic(
        api_key=settings.llm.api_key.get_secret_value(), timeout=settings.llm.timeout_s, max_retries=0
    )
    app.state.container = AppContainer(
        settings, engine, async_sessionmaker(engine, expire_on_commit=False), http_client, llm_client
    )
    try:
        yield
    finally:
        await llm_client.close()
        await http_client.aclose()
        await engine.dispose()


# app/main.py
def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings()
    app = FastAPI(title=resolved.app_name, version=resolved.app_version, lifespan=lifespan)
    app.state.settings = resolved
    app.include_router(tickets.router, prefix="/api/v1")
    register_exception_handlers(app)
    return app


# app/api/deps.py
async def get_container(request: Request) -> AppContainer:
    container: AppContainer = request.app.state.container
    return container
```
**Why it's right:**
- All resources are created and released in the `lifespan`, with closing guaranteed by the `finally` block.
- The container is immutable (`frozen=True`) and reachable only through `get_container`, so it can be replaced in tests with `dependency_overrides`.
- `create_app(settings)` allows instances with different configurations; the SDK client uses the key from `SecretStr`, timeouts from config, and `max_retries=0` because retries are handled by the gateway.

### 3. Domain errors translated to HTTP inside the service
```python
# app/domain/tickets/errors.py
class DomainError(Exception):
    code = "domain_error"


class TicketNotFoundError(DomainError):
    code = "ticket_not_found"

    def __init__(self, ticket_id: int) -> None:
        super().__init__(f"ticket {ticket_id} not found")
        self.ticket_id = ticket_id


class TicketAccessDeniedError(DomainError):
    code = "ticket_access_denied"


class TicketClosedError(DomainError):
    code = "ticket_already_closed"


# app/api/errors.py
from collections.abc import Mapping
from typing import Final

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.domain.tickets.errors import DomainError, TicketAccessDeniedError, TicketClosedError, TicketNotFoundError

_STATUS_BY_ERROR: Final[Mapping[type[DomainError], int]] = {
    TicketNotFoundError: status.HTTP_404_NOT_FOUND,
    TicketAccessDeniedError: status.HTTP_403_FORBIDDEN,
    TicketClosedError: status.HTTP_409_CONFLICT,
}


async def domain_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, DomainError):
        raise exc
    status_code = next(
        (code for error_type, code in _STATUS_BY_ERROR.items() if isinstance(exc, error_type)),
        status.HTTP_400_BAD_REQUEST,
    )
    return JSONResponse(status_code=status_code, content={"error": {"code": exc.code}})


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)


# app/api/v1/tickets.py
@router.post("/{ticket_id}/close", response_model=TicketOut)
async def close_ticket(ticket_id: int, principal: TicketWriter, service: TicketServiceDep) -> TicketOut:
    ticket = await service.close(ticket_id, actor_id=principal.subject)
    return TicketOut.model_validate(ticket, from_attributes=True)
```
**Why it's right:**
- The domain raises semantic exceptions with a stable `code`, independent of the transport and reusable by workers and CLIs.
- A single handler registered on `DomainError` (Starlette resolves the handler along the MRO) maps exceptions to HTTP status codes and returns only the code, with no internal details.
- The identity comes from the verified token (`TicketWriter`), and the response is filtered by `response_model`.
