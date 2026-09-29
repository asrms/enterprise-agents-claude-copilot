---
name: laravel-queues-jobs
description: "Background processing in Laravel: queued jobs with Redis, SQS, or database drivers, idempotent job design, retries with backoff and maxExceptions, timeouts, failed job handling, unique and rate-limited jobs, job batching and chaining, dispatching after commit, Horizon for monitoring and scaling, scheduled tasks with the scheduler, and graceful worker deployment. Use it when creating or reviewing asynchronous work in Laravel."
---

# Skill: Laravel Queues and Jobs

## Implementation Rules:
- **[MANDATORY]** Move slow or unreliable work out of requests (emails, third-party API calls, reports, image processing) into queued jobs implementing `ShouldQueue`, dispatched after the database transaction commits (`afterCommit()` or `after_commit` in the queue connection).
- **[MANDATORY]** Make jobs idempotent: they can run more than once (retries, worker crashes), so check state before acting, use idempotency keys with external APIs, and use `ShouldBeUnique` or `WithoutOverlapping` middleware where concurrent execution would conflict.
- **[MANDATORY]** Configure failure behavior explicitly per job: `$tries` or `retryUntil()`, `$backoff` (array for exponential backoff), `$maxExceptions`, `$timeout` (lower than the queue's `retry_after`), and a `failed()` method that records or notifies.
- **[PATTERN]** Pass identifiers or small serializable data to jobs (models are re-fetched via `SerializesModels`); avoid large payloads and closures, and handle deleted models (`$deleteWhenMissingModels = true` where appropriate).
- **[PATTERN]** Use job middleware for cross-cutting concerns: `RateLimited` for third-party API limits, `ThrottlesExceptions` to back off when a dependency is failing, `WithoutOverlapping` for per-resource exclusivity.
- **[PATTERN]** Coordinate multi-step work with `Bus::chain` (sequential) and `Bus::batch` (parallel with progress, `then`, `catch`, and `finally` callbacks), storing batch ids for tracking.
- **[PATTERN]** Separate queues by priority and workload (`high`, `default`, `emails`, `reports`) and size workers accordingly; use Laravel Horizon with Redis for supervision, auto-balancing, metrics, and failed job inspection.
- **[FORBIDDEN]** Long synchronous work in HTTP requests, the `sync` driver in production, jobs without timeouts, infinite retries of permanently failing jobs, and dispatching jobs inside transactions that may roll back without `afterCommit`.
- **[MANDATORY]** Deploy workers safely: restart them on each release (`php artisan queue:restart` or `horizon:terminate`) so they load new code, run them under a supervisor (systemd, Supervisor, Kubernetes) with graceful termination, and monitor queue depth and wait times.
- **[PATTERN]** Schedule recurring tasks with the Laravel scheduler (`routes/console.php`), using `withoutOverlapping()`, `onOneServer()` for multi-server setups, and `runInBackground()` for long tasks, with output and failures monitored.
- **[TESTING]** Use `Queue::fake()` / `Bus::fake()` to assert dispatching, test job `handle()` methods directly with fakes for dependencies, and test failure and retry behavior; run a real worker in integration tests for critical flows.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
