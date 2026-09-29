---
name: rails-background-jobs
description: "Background processing in Rails with Active Job on Solid Queue or Sidekiq: idempotent jobs, retry_on and discard_on policies, enqueuing after commit, passing ids instead of objects, queues and priorities, concurrency controls, recurring tasks, timeouts, observability with Mission Control or the Sidekiq dashboard, and safe deployment of workers. Use it when creating or reviewing asynchronous work in Rails applications."
---

# Skill: Rails Background Jobs

## Implementation Rules:
- **[MANDATORY]** Move slow or unreliable work (emails, third-party calls, file processing, reports) into Active Job classes backed by a production queue (Solid Queue, the Rails 8 default, or Sidekiq with Redis); never use the `:async` or `:inline` adapters in production.
- **[MANDATORY]** Enqueue jobs only after the data they need is committed: enable deferred enqueuing with `enqueue_after_transaction_commit` where your Rails version and adapter support it, or enqueue from `after_commit` hooks or after the transaction block explicitly; verify the behavior in your version rather than assuming it.
- **[MANDATORY]** Design jobs to be idempotent: check current state before acting, use idempotency keys with external services, and make repeated execution harmless, because retries and at-least-once delivery will run jobs more than once.
- **[PATTERN]** Pass identifiers (or GlobalID-serializable records) and small arguments, re-fetch fresh data inside `perform`, and handle deleted records with `discard_on ActiveJob::DeserializationError` or explicit checks.
- **[MANDATORY]** Configure failure handling per job: `retry_on` for transient errors with `wait: :polynomially_longer` and bounded `attempts`, `discard_on` for permanent errors, and error reporting (`Rails.error`) for exhausted retries.
- **[PATTERN]** Separate queues by priority and workload (`critical`, `default`, `mailers`, `low`), configure workers and threads per queue, and use concurrency controls (`limits_concurrency` in Solid Queue, sidekiq-limit_fetch or unique job extensions) for per-resource exclusivity.
- **[PATTERN]** Define recurring tasks declaratively (Solid Queue `config/recurring.yml`, sidekiq-cron or sidekiq-scheduler) instead of system cron entries on individual servers.
- **[FORBIDDEN]** Serializing large objects or secrets into job arguments, jobs without failure handling that retry forever or fail silently, long-running jobs without progress checkpoints, and calling external APIs synchronously from request cycles when a job would do.
- **[PERFORMANCE]** Keep jobs short and batch large workloads (enqueue per-chunk jobs with `in_batches`), bound database connections per worker (pool size at least the thread count), and monitor queue latency.
- **[PATTERN]** Monitor jobs with Mission Control – Jobs (Solid Queue) or the Sidekiq Web UI protected by authentication, plus metrics and alerts on queue latency, failures, and dead jobs.
- **[MANDATORY]** Deploy workers so they stop gracefully (finish or re-enqueue current jobs on SIGTERM within a timeout) and restart with the new code on each release.
- **[TESTING]** Test with `ActiveJob::TestHelper` (`assert_enqueued_with`, `perform_enqueued_jobs`) or RSpec matchers (`have_enqueued_job`), test `perform` directly with stubs for external services, and cover retry and discard behavior.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
