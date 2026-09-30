# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Leaky key, no TTL, stampede-prone
```python
cache = {}                                             # unbounded, per process

def get_account_summary(request):
    key = "account_summary"                            # same key for every user and tenant
    if key not in cache:
        cache[key] = db.load_account_summary(request.user.id)   # first user's data served to everyone
    return cache[key]
```
```text
Cache-Control: public, max-age=86400        <- on /api/me/orders (personal data cached by the CDN for a day)
```
**Why it's wrong:**
- One user's data is returned to all users, and the in-process cache grows forever without expiry.
- A CDN caches personal responses publicly for a day.

## Best Practice (How to do it right)

### 1. Cache-aside with scoped keys, TTL with jitter, and single-flight (Python, Redis)
```python
import asyncio, contextlib, json, random
from redis.asyncio import Redis
from redis.exceptions import RedisError

redis = Redis.from_url(settings.redis_url, socket_timeout=0.05)
locks: dict[str, asyncio.Lock] = {}

async def get_product(tenant_id: str, product_id: str, locale: str) -> dict:
    key = f"v2:product:{tenant_id}:{product_id}:{locale}"
    try:
        cached = await redis.get(key)
        if cached:
            return json.loads(cached)
    except RedisError:
        metrics.cache_errors.inc()                          # degrade to source, do not fail the request

    lock = locks.setdefault(key, asyncio.Lock())
    async with lock:                                        # coalesce concurrent misses in this process
        product = await catalog.load(tenant_id, product_id, locale)
        ttl = 300 + random.randint(0, 60)                   # jitter avoids synchronized expiry
        with contextlib.suppress(RedisError):
            await redis.set(key, json.dumps(product), ex=ttl)
        return product

async def on_product_changed(event: ProductChanged) -> None:      # event-driven invalidation
    await redis.delete(*[f"v2:product:{event.tenant_id}:{event.product_id}:{loc}" for loc in SUPPORTED_LOCALES])
```
### 2. HTTP caching headers by resource type
```text
/assets/app.3f9c2b.js     Cache-Control: public, max-age=31536000, immutable
/v1/products/SKU-1        Cache-Control: public, max-age=60, stale-while-revalidate=300   ETag: "p-8812-v14"
/v1/me/orders             Cache-Control: private, no-store
```
**Why it's right:**
- Keys include tenant, product, and locale, entries expire with jitter, and cache failures fall back to the source.
- Concurrent misses are coalesced, changes invalidate entries by event, and HTTP headers match each resource's sensitivity and freshness needs.
