---
name: laravel-deployment
description: "Deploying and operating Laravel applications in production: build artifacts with Composer (no-dev, optimized autoloader) and frontend assets, containers with PHP-FPM or FrankenPHP/Octane, configuration and route caching, zero-downtime releases, database migrations in the pipeline, queue workers and the scheduler, health checks, logging and monitoring, PHP and OPcache tuning, and scaling. Use it when setting up or reviewing how a Laravel application is built, deployed, and run."
---

# Skill: Laravel Deployment

## Implementation Rules:
- **[MANDATORY]** Build immutable release artifacts in CI: `composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction`, frontend assets compiled with Vite (`npm ci && npm run build`), and a container image or release bundle tagged with the commit; never run Composer or builds on production servers by hand.
- **[MANDATORY]** Optimize at deploy time: `php artisan optimize` (config, events, routes, and views caches) after environment variables are available, and never call `env()` outside configuration files.
- **[PATTERN]** Run PHP with a production-grade server: PHP-FPM behind NGINX or Caddy, or FrankenPHP; use Laravel Octane (with Swoole, RoadRunner, or FrankenPHP) only after verifying the application is safe for long-lived workers (no state leaking between requests).
- **[MANDATORY]** Configure PHP for production: OPcache enabled with `opcache.validate_timestamps=0` in immutable deployments, adequate `memory_limit`, `expose_php=Off`, `display_errors=Off`, and PHP-FPM process manager settings sized to container memory.
- **[MANDATORY]** Run database migrations as a dedicated, single pipeline step before switching traffic (`php artisan migrate --force`), with backward-compatible migrations so old and new code can run side by side during the rollout.
- **[PATTERN]** Deploy with zero downtime: rolling updates of containers behind a load balancer with readiness checks, or atomic symlink switching (Envoyer, Deployer) on servers; keep previous releases for fast rollback.
- **[PATTERN]** Run queue workers and the scheduler as separate processes or containers from the web tier (`php artisan horizon` or `queue:work` with `--max-time`/`--max-jobs`, and `schedule:work` or a cron entry for `schedule:run` on one instance), restarting workers on each deploy.
- **[PATTERN]** Store sessions, cache, and queues in shared backends (Redis, database, SQS) and files in object storage (S3-compatible disks) so any instance can serve any request.
- **[FORBIDDEN]** `APP_DEBUG=true` in production, writable application code directories, committing `.env` or `vendor/`, running `migrate:fresh` or seeders against production, and storing uploaded files on a single instance's local disk.
- **[PATTERN]** Expose health endpoints (the built-in `/up` route plus a readiness check for dependencies), log to stdout or stderr in JSON (`LOG_CHANNEL=stderr` with a JSON formatter), and monitor errors, queue depth, and slow requests (for example Laravel Pulse, Sentry, or OpenTelemetry).
- **[SECURITY]** Inject secrets at runtime from the platform's secret store, run containers as non-root with a read-only root filesystem where possible, and keep the PHP base image patched.
- **[TESTING]** The pipeline runs tests, static analysis, and security audits before building; after deployment it runs smoke tests against the `/up` endpoint and key routes and rolls back automatically on failure.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
