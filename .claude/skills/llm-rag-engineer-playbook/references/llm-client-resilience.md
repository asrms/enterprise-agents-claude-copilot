# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Blind retries, no timeout, and a hardcoded model
```python
import anthropic
from tenacity import retry, stop_after_attempt, wait_fixed

client = anthropic.AsyncAnthropic()


@retry(stop=stop_after_attempt(10), wait=wait_fixed(1))
async def summarize(text: str) -> str:
    response = await client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=100_000,
        messages=[{"role": "user", "content": f"Summarize: {text}"}],
    )
    return response.content[0].text


async def summarize_ticket_thread(thread: list[str]) -> list[str]:
    summaries = []
    for message in thread:
        summaries.append(await summarize(message))
    return summaries
```
**Why it's wrong:**
- The decorator retries any exception, even 400/401: an out-of-range `max_tokens` is repeated 10 times, and with the SDK's 2 default retries it adds up to 30 calls.
- Fixed wait without jitter (thundering herd), no overall deadline, no explicit timeout.
- Hardcoded model, a global client that reads the key implicitly, `stop_reason` ignored, and `content[0].text` that assumes a text block.

### 2. No circuit breaker or metrics: a degraded provider drags the service down
```python
import logging

logger = logging.getLogger(__name__)


class TicketAssistant:
    def __init__(self, gateway: AnthropicGateway) -> None:
        self._gateway = gateway

    async def suggest_reply(self, ticket: Ticket) -> str:
        request = build_reply_request(ticket)
        try:
            response = await self._gateway.complete(request)
        except Exception:
            # provider down? let's retry with another model
            self._gateway.model = "claude-3-haiku-20240307"
            response = await self._gateway.complete(request)
        logger.info("LLM response for ticket %s: %s", ticket.id, response.text)
        return response.text
```
**Why it's wrong:**
- Without a breaker, during an outage every request waits for all retries and timeouts: workers saturate and even endpoints that do not use the LLM degrade.
- The fallback fires on any exception (even a 400 for an invalid prompt), doubling costs, and mutates the gateway's shared state for all concurrent requests.
- Hardcoded fallback model, response text in the logs, no latency, token, or cost metrics.

### 3. Fake, buffered streaming
```python
from anthropic import AsyncAnthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(body: ChatIn) -> StreamingResponse:
    client = AsyncAnthropic()
    chunks: list[str] = []
    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        messages=[{"role": "user", "content": body.message}],
    ) as stream:
        async for text in stream.text_stream:
            chunks.append(text)
    full_text = "".join(chunks)

    async def fake_stream():
        for word in full_text.split(" "):
            yield word + " "

    return StreamingResponse(fake_stream(), media_type="text/plain")
```
**Why it's wrong:**
- The entire response is accumulated before sending the first byte: time-to-first-token equals total latency.
- A new SDK client per request, never closed, with a hardcoded model and no concurrency limit.
- No SSE framing, no handling of disconnection or mid-stream errors, no `usage` metrics.

## Best Practice (How to do it right)

### 1. Blind retries, no timeout, and a hardcoded model
```python
# app/infrastructure/llm/anthropic_gateway.py
import asyncio
import logging

from anthropic import APIConnectionError, APIStatusError, AsyncAnthropic
from anthropic.types import Message, MessageParam, TextBlock
from tenacity import AsyncRetrying, before_sleep_log, retry_if_exception, stop_after_attempt, wait_exponential_jitter

from app.core.config import LLMSettings
from app.domain.llm.errors import LLMRequestError, LLMTruncatedError, LLMUnavailableError
from app.domain.llm.models import LLMMessage, LLMRequest, LLMResponse

logger = logging.getLogger(__name__)
RETRYABLE_STATUS = frozenset({408, 409, 429, 500, 502, 503, 504, 529})  # 529 = overloaded


def is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, APIConnectionError):  # includes APITimeoutError
        return True
    return isinstance(exc, APIStatusError) and exc.status_code in RETRYABLE_STATUS


def to_message_params(messages: list[LLMMessage]) -> list[MessageParam]:
    return [{"role": m.role, "content": m.content} for m in messages]


class AnthropicGateway:
    def __init__(self, client: AsyncAnthropic, settings: LLMSettings, *, model: str) -> None:
        self._client = client  # created in the lifespan with max_retries=0 and explicit timeouts
        self._settings = settings
        self._model = model  # settings.model or settings.fallback_model, never a literal

    async def _create(self, request: LLMRequest) -> Message:
        return await self._client.messages.create(
            model=self._model, max_tokens=request.max_tokens, system=request.system,
            messages=to_message_params(request.messages), temperature=request.temperature,
        )

    async def complete(self, request: LLMRequest) -> LLMResponse:
        retrying = AsyncRetrying(
            retry=retry_if_exception(is_retryable),
            stop=stop_after_attempt(self._settings.max_attempts),
            wait=wait_exponential_jitter(initial=0.5, max=self._settings.max_backoff_s, jitter=1.0),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            reraise=True,
        )
        try:
            async with asyncio.timeout(self._settings.deadline_s):  # deadline that includes the retries
                message = await retrying(self._create, request)
        except (APIConnectionError, TimeoutError) as exc:
            raise LLMUnavailableError(self._model) from exc
        except APIStatusError as exc:
            if exc.status_code in RETRYABLE_STATUS:
                raise LLMUnavailableError(self._model) from exc
            raise LLMRequestError(self._model, exc.status_code) from exc  # 4xx: never retried
        if message.stop_reason == "max_tokens":
            raise LLMTruncatedError(self._model, max_tokens=request.max_tokens)
        text = "".join(block.text for block in message.content if isinstance(block, TextBlock))
        return LLMResponse(text=text, model=message.model,
                           input_tokens=message.usage.input_tokens, output_tokens=message.usage.output_tokens)
```
**Why it's right:**
- Retries only on retryable errors, with exponential backoff and jitter; `max_retries=0` in the SDK avoids multiplying attempts.
- An overall deadline with `asyncio.timeout` and translation of SDK exceptions into distinct domain errors for 5xx/network and 4xx.
- The model is injected from configuration, `max_tokens` truncation is reported explicitly, and text is extracted only from `TextBlock`s.

### 2. No circuit breaker or metrics: a degraded provider drags the service down
```python
# app/infrastructure/llm/resilient_gateway.py
import time

from prometheus_client import Counter, Histogram

from app.core.config import LLMSettings
from app.domain.llm.errors import LLMUnavailableError
from app.domain.llm.models import LLMRequest, LLMResponse
from app.domain.llm.ports import LLMGateway

LLM_LATENCY = Histogram("llm_request_duration_seconds", "LLM call latency", ["route"])
LLM_TOKENS = Counter("llm_tokens_total", "LLM tokens consumed", ["model", "direction"])
LLM_COST = Counter("llm_cost_usd_total", "Estimated LLM cost in USD", ["model"])


class CircuitBreaker:  # states: "closed" → "open" → "half_open" → "closed" | "open"
    def __init__(self, failure_threshold: int, recovery_timeout_s: float) -> None:
        self._threshold, self._recovery_s = failure_threshold, recovery_timeout_s
        self._failures, self._opened_at, self.state = 0, 0.0, "closed"

    def allow(self) -> bool:
        if self.state == "open" and time.monotonic() - self._opened_at >= self._recovery_s:
            self.state = "half_open"  # a single probe call
            return True
        return self.state == "closed"

    def record(self, *, success: bool) -> None:
        self._failures = 0 if success else self._failures + 1
        if success:
            self.state = "closed"
        elif self.state == "half_open" or self._failures >= self._threshold:
            self.state, self._opened_at = "open", time.monotonic()


class ResilientLLMGateway:  # excerpt: stream() applies the same logic before the first chunk
    def __init__(self, primary: LLMGateway, fallback: LLMGateway | None,
                 breaker: CircuitBreaker, settings: LLMSettings) -> None:
        self._primary, self._fallback, self._breaker, self._settings = primary, fallback, breaker, settings

    async def complete(self, request: LLMRequest) -> LLMResponse:
        if self._breaker.allow():
            unavailable = False
            try:
                return await self._observe("primary", self._primary, request)
            except LLMUnavailableError:
                unavailable = True  # only exhausted retryable errors: 4xx propagate
            finally:
                self._breaker.record(success=not unavailable)
        if self._fallback is None:
            raise LLMUnavailableError("primary")
        return await self._observe("fallback", self._fallback, request)

    async def _observe(self, route: str, gateway: LLMGateway, request: LLMRequest) -> LLMResponse:
        with LLM_LATENCY.labels(route=route).time():  # observed even when the call fails
            response = await gateway.complete(request)
        LLM_TOKENS.labels(model=response.model, direction="input").inc(response.input_tokens)
        LLM_TOKENS.labels(model=response.model, direction="output").inc(response.output_tokens)
        if (pricing := self._settings.pricing.get(response.model)) is not None:
            LLM_COST.labels(model=response.model).inc(pricing.cost_usd(response.input_tokens, response.output_tokens))
        return response
```
**Why it's right:**
- With the circuit open, requests do not wait for the primary's retries and timeouts: they go straight to the fallback or fail with 503.
- The fallback is a second gateway configured from settings and fires only on unavailability, never on 4xx errors; no shared state is mutated per request.
- Latency, tokens, and cost are measured for every call with low-cardinality labels and prices taken from configuration.

### 3. Fake, buffered streaming
```python
# app/infrastructure/llm/anthropic_gateway.py (same adapter as scenario 1: here the stream method)
from collections.abc import AsyncGenerator


class AnthropicGateway:
    async def stream(self, request: LLMRequest) -> AsyncGenerator[StreamChunk, None]:
        async with self._client.messages.stream(
            model=self._model, max_tokens=request.max_tokens, system=request.system,
            messages=to_message_params(request.messages), temperature=request.temperature,
        ) as stream:
            async for text in stream.text_stream:
                yield StreamChunk(text=text)
            final = await stream.get_final_message()
        yield StreamChunk(text="", done=True, stop_reason=final.stop_reason,
                          input_tokens=final.usage.input_tokens, output_tokens=final.usage.output_tokens)


# app/api/v1/chat.py
import json
from contextlib import aclosing

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/chat", tags=["chat"])
SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


def sse(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/stream", response_class=StreamingResponse)
async def chat_stream(body: ChatIn, request: Request, principal: ChatUser, service: ChatServiceDep) -> StreamingResponse:
    async def event_source() -> AsyncGenerator[str, None]:
        try:
            async with aclosing(service.stream_reply(principal, body)) as chunks:
                async for chunk in chunks:
                    if await request.is_disconnected():
                        break  # aclosing closes the upstream stream: no wasted tokens
                    if chunk.done:
                        yield sse("done", {"stop_reason": chunk.stop_reason, "output_tokens": chunk.output_tokens})
                    else:
                        yield sse("delta", {"text": chunk.text})
        except (LLMUnavailableError, LLMRequestError):
            yield sse("error", {"code": "llm_unavailable"})  # 200 status already sent: in-band error

    return StreamingResponse(event_source(), media_type="text/event-stream", headers=SSE_HEADERS)
```
**Why it's right:**
- Tokens reach the client as soon as the provider generates them; the `done` event carries `stop_reason` and `usage` read from `get_final_message()`.
- `aclosing` and the `is_disconnected()` check close the upstream stream when the user leaves, without wasting tokens.
- Explicit SSE format with anti-buffering headers and mid-stream errors communicated in-band; client and model come from the lifespan and settings.
