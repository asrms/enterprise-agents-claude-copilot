# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Single model for request, response, and ORM
```python
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.db import SessionLocal
from app.orm import CustomerORM

router = APIRouter()


class Customer(BaseModel):
    id: int | None = None
    email: str
    full_name: str
    password_hash: str | None = None
    is_admin: bool = False
    credit_limit: float = 0

    class Config:
        orm_mode = True


@router.post("/customers")
async def create_customer(payload: Customer):
    async with SessionLocal() as session:
        customer = CustomerORM(**payload.dict())
        session.add(customer)
        await session.commit()
        return customer


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: int):
    async with SessionLocal() as session:
        return await session.scalar(select(CustomerORM).where(CustomerORM.id == customer_id))
```
**Why it's wrong:**
- Mass assignment: the client can set `is_admin`, `credit_limit`, and even `id`; unknown fields are silently ignored.
- The response returns the ORM object with `password_hash`; after `commit()` the attributes are expired, and serialization outside the session raises `MissingGreenlet`.
- Pydantic v1 APIs (`class Config`, `orm_mode`, `.dict()`), no `response_model`, no constraints on email and name.

### 2. Settings with plaintext secrets and a hardcoded LLM model
```python
import logging
import os

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class Settings(BaseModel):
    environment: str = os.getenv("ENV", "dev")
    debug: bool = os.getenv("DEBUG", "true") == "true"
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql+asyncpg://app:Passw0rd!@db:5432/tickets"
    )
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "sk-ant-api03-dev-key")
    llm_model: str = "claude-3-opus-20240229"
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "100000"))
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")


settings = Settings()
logger.info("Configuration loaded: %s", settings.model_dump())
```
**Why it's wrong:**
- Password and API key have defaults in the code (they end up in the repository) and are written to the logs in plaintext via `model_dump()`.
- Hardcoded LLM model, unbounded `max_tokens`, and `debug` enabled by default: in production, a single missing variable yields a dangerous configuration instead of a startup error.
- `os.getenv` evaluated at import time, no type or range validation, CORS `"*"` as a free-form string.

### 3. Structured LLM output accepted without validation
```python
import json
from typing import Any


class TriageService:
    def __init__(self, llm: LLMGateway, repo: TicketRepository) -> None:
        self._llm = llm
        self._repo = repo

    async def classify(self, ticket: Ticket) -> dict[str, Any]:
        response = await self._llm.complete(
            LLMRequest(
                system=f"Classify this ticket and answer in JSON: {ticket.body}",
                messages=[LLMMessage(role="user", content="Proceed")],
                max_tokens=300,
            )
        )
        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            data = json.loads(response.text.strip("`").removeprefix("json"))
        priority = data.get("priority", "low")
        if float(data.get("confidence", 1)) > 0.8:
            await self._repo.set_priority(ticket.id, priority)
        return data
```
**Why it's wrong:**
- `json.loads` + `.get()` with defaults accepts any structure: an invented `priority` (`"super-urgent"`) or a missing `confidence` (default 1) is applied automatically.
- Parsing "repaired" by hand with `strip`, no limit on attempts, and no reporting of non-conforming output.
- The returned `dict` has no contract; the ticket text is concatenated into the system prompt.

## Best Practice (How to do it right)

### 1. Single model for request, response, and ORM
```python
# app/api/v1/schemas/customers.py
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

FullName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]


class CustomerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # is_admin, credit_limit, id → 422

    email: EmailStr  # requires the email-validator package
    full_name: FullName


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: int
    email: EmailStr
    full_name: str
    created_at: datetime


# app/api/v1/customers.py
from fastapi import APIRouter, status

from app.api.deps import CustomerServiceDep
from app.api.v1.schemas.customers import CustomerCreate, CustomerOut

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate, service: CustomerServiceDep) -> CustomerOut:
    # the initial credit_limit is a business rule of the service, not client input
    customer = await service.register(email=payload.email, full_name=payload.full_name)
    return CustomerOut.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: int, service: CustomerServiceDep) -> CustomerOut:
    return CustomerOut.model_validate(await service.get(customer_id))
```
**Why it's right:**
- Request and response have distinct schemas: `extra="forbid"` blocks mass assignment, and the output contains only the declared fields.
- The service returns an already-materialized domain entity, mapped with `from_attributes` without lazy loading outside the session.
- `EmailStr` and `StringConstraints` move validation into the contract, documented automatically in OpenAPI.

### 2. Settings with plaintext secrets and a hardcoded LLM model
```python
# app/core/config.py
from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, SecretStr, StringConstraints, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Origin = Annotated[str, StringConstraints(pattern=r"^https://[a-z0-9.-]+(:\d{2,5})?$")]


class ModelPricing(BaseModel):
    input_per_mtok_usd: float = Field(ge=0)
    output_per_mtok_usd: float = Field(ge=0)

    def cost_usd(self, input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * self.input_per_mtok_usd + output_tokens * self.output_per_mtok_usd) / 1_000_000


class LLMSettings(BaseModel):
    api_key: SecretStr
    model: str = Field(min_length=1)  # APP_LLM__MODEL: never in code
    fallback_model: str | None = None
    max_output_tokens: int = Field(default=1024, ge=1, le=16_384)
    timeout_s: float = Field(default=30.0, gt=0, le=120)
    pricing: dict[str, ModelPricing]  # APP_LLM__PRICING in JSON format


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_", env_file=".env", env_nested_delimiter="__", extra="ignore"
    )

    environment: Literal["local", "test", "staging", "production"]
    debug: bool = False
    database_url: SecretStr
    llm: LLMSettings
    cors_origins: list[Origin] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_invariants(self) -> Self:
        if self.environment == "production" and self.debug:
            raise ValueError("debug not allowed in production")
        if self.llm.fallback_model == self.llm.model:
            raise ValueError("fallback_model must differ from model")
        missing = {self.llm.model, self.llm.fallback_model or self.llm.model} - self.llm.pricing.keys()
        if missing:
            raise ValueError(f"missing prices for models: {sorted(missing)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # fails at startup if a required variable is missing
```
**Why it's right:**
- No secrets or models in the code: values come from the environment, and secrets are `SecretStr` and stay masked in logs and `repr()`.
- Required fields without defaults and cross-field invariants in `model_validator`: an inconsistent configuration blocks startup instead of surfacing in production.
- Explicit ranges on tokens and timeouts, per-model prices used for cost metrics, and CORS origins validated as exact strings (no `HttpUrl` with a trailing slash).

### 3. Structured LLM output accepted without validation
```python
# app/domain/tickets/triage.py
import logging
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.domain.llm.errors import LLMOutputInvalidError
from app.domain.llm.models import LLMMessage, LLMRequest
from app.domain.llm.ports import LLMGateway
from app.domain.tickets.config import TriageConfig
from app.domain.tickets.entities import Ticket
from app.domain.tickets.prompts import TRIAGE_SYSTEM_PROMPT, render_ticket_as_data

logger = logging.getLogger(__name__)


class TriageDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    category: Literal["billing", "technical", "account", "other"]
    priority: Literal["low", "medium", "high", "critical"]
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(min_length=1, max_length=500)

    @field_validator("rationale")
    @classmethod
    def collapse_whitespace(cls, value: str) -> str:
        return " ".join(value.split())


class TriageService:
    def __init__(self, llm: LLMGateway, cfg: TriageConfig) -> None:
        self._llm = llm
        self._cfg = cfg

    async def classify(self, ticket: Ticket) -> TriageDecision:
        messages = [LLMMessage(role="user", content=render_ticket_as_data(ticket))]
        for attempt in range(1, self._cfg.max_validation_retries + 2):
            response = await self._llm.complete(
                LLMRequest(system=TRIAGE_SYSTEM_PROMPT, messages=messages,
                           max_tokens=self._cfg.max_output_tokens, temperature=0.0)
            )
            try:
                return TriageDecision.model_validate_json(response.text, strict=True)
            except ValidationError as exc:
                logger.warning("triage_output_invalid", extra={"attempt": attempt, "errors": exc.error_count()})
                feedback = exc.errors(include_url=False, include_input=False)
                messages = [
                    *messages,
                    LLMMessage(role="assistant", content=response.text),
                    LLMMessage(role="user", content=f"Output does not conform to the schema: {feedback}. JSON only."),
                ]
        raise LLMOutputInvalidError("triage", attempts=self._cfg.max_validation_retries + 1)
```
**Why it's right:**
- `TriageDecision` is the output contract: `extra="forbid"`, `Literal`, and numeric ranges reject any value invented by the model.
- `model_validate_json(..., strict=True)` validates the bytes in a single pass; the retry on failed validation is bounded by config and ends with an explicit domain error.
- The feedback to the model excludes the original input (`include_input=False`), the log contains only the error count, and the ticket text stays in `messages` as data, outside the system prompt.
