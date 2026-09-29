# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. API tests that call the real LLM provider and use the global app
```python
# tests/test_tickets.py
import time

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_triage_ticket() -> None:
    response = client.post("/api/v1/tickets/42/triage", headers={"X-User-Id": "admin"})
    assert response.status_code == 200
    assert response.json()["category"] == "billing"  # depends on the real model's response


def test_triage_when_llm_is_slow(monkeypatch) -> None:
    import app.infrastructure.llm.anthropic_gateway as gateway_module

    monkeypatch.setattr(gateway_module, "RETRYABLE_STATUS", frozenset())
    time.sleep(2)  # "wait for the circuit breaker to close again"
    response = client.post("/api/v1/tickets/42/triage", headers={"X-User-Id": "admin"})
    assert response.status_code in (200, 503)
```
**Why it's wrong:**
- The global app uses real settings: tests call real LLM providers and databases, cost money, require secrets in CI, and fail intermittently.
- The assertion on generated text is non-deterministic; `in (200, 503)` accepts any outcome and verifies nothing.
- `monkeypatch` on internal constants and `time.sleep` instead of a controlled clock; no isolation between tests.

### 2. Adapter retries tested with generic SDK mocks
```python
# tests/test_gateway.py
from unittest.mock import AsyncMock, patch

import pytest
from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.infrastructure.llm.anthropic_gateway import AnthropicGateway


@pytest.mark.asyncio
async def test_retry() -> None:
    failing = AsyncMock(side_effect=Exception("boom"))
    with patch("anthropic.resources.messages.AsyncMessages.create", new=failing):
        settings = get_settings()
        gateway = AnthropicGateway(
            AsyncAnthropic(api_key=settings.llm.api_key.get_secret_value()),
            settings.llm,
            model="claude-3-haiku-20240307",
        )
        with pytest.raises(Exception):
            await gateway.complete(LLMRequest(system="s", messages=[], max_tokens=10))
```
**Why it's wrong:**
- `Exception("boom")` does not represent any real provider error: it does not distinguish retryable 429/529 from non-retryable 400/401.
- Patching an internal SDK path breaks at the first update; `pytest.raises(Exception)` passes with any error and the number of attempts is not verified.
- It uses `get_settings()` with the real environment, a hardcoded model, and real backoffs, making the test slow and machine-dependent.

### 3. Prompt golden set and output contract in the default suite
```python
# tests/test_prompts.py
import asyncio
import json

from app.core.config import get_settings
from app.domain.tickets.triage import TriageService
from app.infrastructure.llm.factory import build_gateway


def test_prompt_quality() -> None:
    service = TriageService(build_gateway(get_settings()), get_settings().triage)
    cases = json.load(open("tests/golden.json"))
    for case in cases:
        decision = asyncio.run(service.classify(case["ticket"]))
        assert decision.category == case["expected"], case["ticket"]


def test_llm_output_shape() -> None:
    gateway = build_gateway(get_settings())
    raw = asyncio.run(gateway.complete_raw("Classify: the printer does not work"))
    data = json.loads(raw)
    assert "category" in data
```
**Why it's wrong:**
- The golden set runs on every `pytest` against the real provider: costs and flakiness on every commit, and no marker to separate it.
- The first wrong case stops the test (no pass-rate threshold); `asyncio.run` per case creates a new event loop with a shared client.
- The "contract" is a `"category" in data`: no Pydantic validation, no schema snapshot, a file opened without being closed and with a relative path.

## Best Practice (How to do it right)

### 1. API tests that call the real LLM provider and use the global app
```python
# tests/fakes.py
from collections import deque

from app.domain.llm.models import LLMRequest, LLMResponse


class FakeLLMGateway:
    """Deterministic implementation of the LLMGateway Protocol: zero network, zero cost."""

    def __init__(self) -> None:
        self.calls: list[LLMRequest] = []
        self._scripted: deque[LLMResponse | Exception] = deque()

    def enqueue_text(self, text: str) -> None:
        self._scripted.append(LLMResponse(text=text, model="fake-model", input_tokens=42, output_tokens=7))

    def enqueue_error(self, error: Exception) -> None:
        self._scripted.append(error)

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self.calls.append(request)
        item = self._scripted.popleft()  # IndexError = LLM call not expected by the test
        if isinstance(item, Exception):
            raise item
        return item


# tests/conftest.py
@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client(fake_llm: FakeLLMGateway, fake_uow: InMemoryUnitOfWork) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(make_test_settings())
    app.dependency_overrides[get_llm_gateway] = lambda: fake_llm
    app.dependency_overrides[get_ticket_uow] = lambda: fake_uow
    app.dependency_overrides[get_current_principal] = lambda: make_principal(scopes={"tickets:write"})
    transport = httpx.ASGITransport(app=app)  # does not start the lifespan: no real resources
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


# tests/api/test_ticket_triage.py
pytestmark = pytest.mark.anyio


async def test_triage_saves_category(
    client: httpx.AsyncClient, fake_llm: FakeLLMGateway, fake_uow: InMemoryUnitOfWork
) -> None:
    fake_llm.enqueue_text('{"category": "billing", "priority": "high", "confidence": 0.93, "rationale": "charge"}')
    response = await client.post("/api/v1/tickets/42/triage")
    assert response.status_code == 200
    assert response.json() == {"ticket_id": 42, "category": "billing"}
    assert fake_uow.committed is True
    ticket_body = fake_uow.tickets.items[42].body
    assert ticket_body not in fake_llm.calls[0].system  # untrusted input never in the system prompt
    assert ticket_body in fake_llm.calls[0].messages[0].content
```
**Why it's right:**
- Every test creates its own app with test settings and replaces the LLM, persistence, and identity via `dependency_overrides`, cleaned up in the teardown.
- The fake is deterministic, records requests, and fails on unexpected calls; the assertion also verifies the system/user separation of the prompt.
- `httpx.AsyncClient` with `ASGITransport` runs the app in-process with no network, with a single async plugin (anyio) configured.

### 2. Adapter retries tested with generic SDK mocks
```python
# tests/unit/infrastructure/test_anthropic_gateway.py
from collections.abc import AsyncIterator

import httpx
import pytest
import respx
from anthropic import AsyncAnthropic

from app.domain.llm.errors import LLMRequestError, LLMUnavailableError
from app.infrastructure.llm.anthropic_gateway import AnthropicGateway
from tests.factories import make_llm_request, make_test_settings

pytestmark = pytest.mark.anyio
MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ERROR_BODY = {"type": "error", "error": {"type": "api_error", "message": "upstream error"}}
OK_BODY = {
    "id": "msg_test", "type": "message", "role": "assistant", "model": "test-model",
    "content": [{"type": "text", "text": "Summary ready."}],
    "stop_reason": "end_turn", "stop_sequence": None,
    "usage": {"input_tokens": 120, "output_tokens": 8},
}


@pytest.fixture
async def gateway() -> AsyncIterator[AnthropicGateway]:
    settings = make_test_settings(llm_max_attempts=3, llm_max_backoff_s=0.0)  # no real waits
    async with AsyncAnthropic(api_key="test-key", max_retries=0) as client:
        yield AnthropicGateway(client, settings.llm, model=settings.llm.model)


@pytest.mark.parametrize("status_code", [429, 500, 529], ids=["rate-limited", "server-error", "overloaded"])
async def test_retryable_status_is_retried_then_mapped(
    gateway: AnthropicGateway, respx_mock: respx.MockRouter, status_code: int
) -> None:
    route = respx_mock.post(MESSAGES_URL).mock(return_value=httpx.Response(status_code, json=ERROR_BODY))
    with pytest.raises(LLMUnavailableError):
        await gateway.complete(make_llm_request())
    assert route.call_count == 3


@pytest.mark.parametrize("status_code", [400, 401, 403], ids=["bad-request", "unauthorized", "forbidden"])
async def test_client_errors_are_never_retried(
    gateway: AnthropicGateway, respx_mock: respx.MockRouter, status_code: int
) -> None:
    route = respx_mock.post(MESSAGES_URL).mock(return_value=httpx.Response(status_code, json=ERROR_BODY))
    with pytest.raises(LLMRequestError):
        await gateway.complete(make_llm_request())
    assert route.call_count == 1


async def test_recovers_after_transient_overload(gateway: AnthropicGateway, respx_mock: respx.MockRouter) -> None:
    respx_mock.post(MESSAGES_URL).mock(
        side_effect=[httpx.Response(529, json=ERROR_BODY), httpx.Response(200, json=OK_BODY)]
    )
    response = await gateway.complete(make_llm_request())
    assert (response.text, response.input_tokens, response.output_tokens) == ("Summary ready.", 120, 8)
```
**Why it's right:**
- respx intercepts the SDK's real HTTP traffic: the actual error classification is tested without depending on the library's internal paths.
- The parametrized matrix verifies both retries (429/5xx/529, `call_count == 3`) and the absence of retries on 4xx (`call_count == 1`), plus recovery after a transient error.
- Test settings with zero backoff and `max_retries=0` in the SDK: a fast, deterministic test with no real keys.

### 3. Prompt golden set and output contract in the default suite
```python
# tests/unit/test_triage_contract.py
import json
from pathlib import Path

import pytest

from app.domain.tickets.triage import TriageDecision

TESTS_DIR = Path(__file__).parents[1]
FIXTURES = sorted((TESTS_DIR / "fixtures" / "llm").glob("triage_*.json"))


@pytest.mark.parametrize("fixture_path", FIXTURES, ids=lambda p: p.stem)
def test_recorded_outputs_respect_contract(fixture_path: Path) -> None:
    TriageDecision.model_validate_json(fixture_path.read_bytes(), strict=True)


def test_schema_matches_snapshot() -> None:
    snapshot = TESTS_DIR / "snapshots" / "triage_decision.schema.json"
    expected = json.loads(snapshot.read_text(encoding="utf-8"))
    assert TriageDecision.model_json_schema() == expected, "schema changed: update the snapshot and prompt_version"


# tests/llm_eval/test_triage_golden.py
from app.domain.tickets.triage import TriageService
from tests.llm_eval.support import load_golden_cases

pytestmark = [pytest.mark.llm_eval, pytest.mark.anyio]  # excluded by addopts: -m "not llm_eval"
MIN_PASS_RATE = 0.95


async def test_triage_golden_set_pass_rate(eval_triage_service: TriageService) -> None:
    cases = load_golden_cases(Path(__file__).parent / "golden" / "triage_v3.jsonl")
    failures: list[str] = []
    for case in cases:
        decision = await eval_triage_service.classify(case.ticket)
        if decision.category != case.expected_category:
            failures.append(f"{case.case_id}: expected={case.expected_category} got={decision.category}")
    pass_rate = 1 - len(failures) / len(cases)
    assert pass_rate >= MIN_PASS_RATE, f"pass rate {pass_rate:.1%}\n" + "\n".join(failures)
```
**Why it's right:**
- Contract tests are deterministic and always run: every recorded output is validated in strict mode and the schema is compared with a versioned snapshot.
- The golden set is marked `llm_eval`, excluded from the default run, and executed in a dedicated pipeline with the real provider and a separate `eval_triage_service` fixture.
- The assertion uses a pass-rate threshold and reports all failed cases, instead of stopping at the first differing text.
