---
name: caching-strategies
description: "Designing caches that improve performance without serving wrong data: what to cache and where (browser, CDN, reverse proxy, application, distributed cache, database), cache-aside, read-through and write-through patterns, TTLs and invalidation, HTTP caching headers and ETags, stampede protection, multi-tenant and personalized data safety, sizing and eviction, and measuring hit ratios. Use it when adding, reviewing, or debugging caching in any system."
---

# Skill: Caching Strategies

## Implementation Rules:
- **[MANDATORY]** Cache only with a measured reason (latency, load, cost) and a stated staleness tolerance per data type; document for each cache what is stored, the key structure, the TTL, the invalidation strategy, and the owner.
- **[PATTERN]** Cache as close to the consumer as is safe: HTTP caching in browsers and CDNs for public and static content, reverse proxy or gateway caching for shared responses, in-process caches for hot, small, read-mostly data, and distributed caches (Redis, Memcached) for data shared across instances.
- **[PATTERN]** Use cache-aside for most application caching (read from cache, on miss load from source and populate), write-through or write-behind only where consistency requirements are understood, and event-driven invalidation (publish on change, evict or update keys) for data that must be fresh.
- **[MANDATORY]** Set explicit TTLs on every entry (with jitter to avoid synchronized expiry), bound cache sizes with an eviction policy (LRU, LFU), and never create unbounded in-memory caches.
- **[PATTERN]** Use correct HTTP caching: `Cache-Control` with `max-age`/`s-maxage`, `immutable` for fingerprinted static assets, `stale-while-revalidate` for tolerable staleness, `ETag` or `Last-Modified` with conditional requests, `Vary` for content negotiation, and `private` or `no-store` for personalized or sensitive responses.
- **[MANDATORY]** Include every dimension that changes the response in the cache key (tenant, user or role for personalized data, locale, currency, API version, feature flag variant) so cached data never leaks across users or tenants.
- **[PERFORMANCE]** Prevent stampedes on hot keys: request coalescing (single flight), early probabilistic refresh, locks with timeouts on miss, and serving stale data while revalidating in the background.
- **[FORBIDDEN]** Caching responses containing personal data in shared caches or CDNs without user-scoped keys, caching errors for long periods, relying on cache presence for correctness (the system must work on a cold cache), and invalidation by manual flushes as the normal process.
- **[PATTERN]** Plan for cache failure: timeouts on cache calls, fallback to the source with load protection, and capacity for cold starts after restarts or failovers.
- **[SECURITY]** Protect distributed caches like databases: authentication, TLS, private network access, and no sensitive data unless encrypted and necessary; be aware of cache poisoning via unkeyed request headers at CDNs.
- **[TESTING]** Monitor hit ratio, latency, evictions, memory, and stale-serve counts per cache; test invalidation paths and cold-cache performance, and verify with load tests that the cache delivers the intended gain.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
