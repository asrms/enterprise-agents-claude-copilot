# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. No timeout, aggressive retries, no fallback (Python)
```python
def get_recommendations(user_id: str) -> list[str]:
    for _ in range(10):                                         # retry storm under load
        try:
            return requests.get(f"http://reco/users/{user_id}").json()   # no timeout: can hang forever
        except Exception:
            pass                                                # immediate retry, every error type
    raise RuntimeError("reco down")                            # whole page fails for an optional widget
```
**Why it's wrong:**
- Without timeouts, slow responses tie up workers; ten immediate retries multiply load on a struggling service.
- An optional feature takes down the whole page instead of degrading.

## Best Practice (How to do it right)

### 1. Timeout, jittered retries on transient errors, circuit breaker, and fallback (Python)
```python
import httpx
import pybreaker
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_random_exponential

reco_breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)
client = httpx.Client(base_url="http://reco", timeout=httpx.Timeout(0.3, connect=0.1),
                      limits=httpx.Limits(max_connections=20))            # bulkhead for this dependency

def _transient(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
        return True
    return isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (429, 503)

@retry(retry=retry_if_exception(_transient), stop=stop_after_attempt(2),
       wait=wait_random_exponential(multiplier=0.05, max=0.2), reraise=True)
def _fetch(user_id: str) -> list[str]:
    response = client.get(f"/users/{user_id}/recommendations")
    response.raise_for_status()
    return response.json()["items"]

def get_recommendations(user_id: str) -> list[str]:
    try:
        return reco_breaker.call(_fetch, user_id)
    except (pybreaker.CircuitBreakerError, httpx.HTTPError):
        metrics.fallback_used.labels(dependency="reco").inc()
        return popular_items_cache.get()                          # degrade: generic recommendations
```
### 2. Idempotent payment request (HTTP)
```text
POST /v1/payments
Idempotency-Key: 5b8f6c2e-1f3a-4c1d-9a7e-2d4f8b6c0e11
Content-Type: application/json

{"order_id": "SO-1001", "amount": "42.50", "currency": "EUR"}

-> the server stores the result for this key for 24 h; a retried request returns the same payment, never a second charge
```
**Why it's right:**
- Calls are bounded by tight timeouts and a dedicated connection pool; only transient errors are retried, with jitter and a low attempt count.
- The circuit breaker fails fast when the dependency is unhealthy, and the page degrades to cached popular items.
- Payment retries are safe because the server deduplicates by idempotency key.
