---
name: rails-deployment
description: "Deploying and running Rails applications in production: the Rails-generated Dockerfile, Kamal 2 or Kubernetes deployments, Puma configuration, assets with Propshaft and precompilation, credentials and environment variables, database migrations during deploys, Solid Queue, Solid Cache, and Solid Cable or Redis-based alternatives, Thruster and HTTP caching, health checks, logging and monitoring, and zero-downtime releases. Use it when setting up or reviewing how a Rails application is built, deployed, and operated."
---

# Skill: Rails Deployment

## Implementation Rules:
- **[MANDATORY]** Build immutable container images in CI from the Rails-generated multi-stage `Dockerfile` (bundle install without development and test groups, `assets:precompile`, bootsnap precompile, non-root user), tagged with the commit; never build or run `bundle install` on production hosts by hand.
- **[PATTERN]** Deploy with Kamal 2 (zero-downtime container swaps via kamal-proxy, accessories for databases or Redis where appropriate) or with Kubernetes and rolling updates; both use health checks before routing traffic.
- **[MANDATORY]** Supply configuration at runtime: `RAILS_MASTER_KEY` or per-environment keys from a secret manager, other secrets as environment variables injected by the platform (Kamal secrets, Kubernetes secrets), and no secrets baked into images.
- **[MANDATORY]** Run migrations once per deploy before the new version receives traffic (Kamal's `docker-entrypoint` with `db:prepare` on a single role or a pre-deploy hook, or a Kubernetes Job), with backward-compatible migrations checked by `strong_migrations`.
- **[PATTERN]** Configure Puma for the container: `WEB_CONCURRENCY` (processes) and `RAILS_MAX_THREADS` sized to CPU and memory, database pool at least equal to threads, preloading with `preload_app!`, and YJIT enabled.
- **[PATTERN]** Run background workers (Solid Queue or Sidekiq) and recurring tasks as separate roles or deployments from web servers, with graceful shutdown on SIGTERM and restarts on each release.
- **[PATTERN]** Choose infrastructure-light defaults where they fit: Solid Queue, Solid Cache, and Solid Cable backed by the database, or Redis-based alternatives when scale requires them; store uploads in object storage via Active Storage services.
- **[PATTERN]** Serve assets efficiently: fingerprinted assets with far-future caching (Thruster or a CDN in front of Puma), `config.public_file_server.headers`, and HTTP compression.
- **[FORBIDDEN]** `config.consider_all_requests_local = true` or verbose error pages in production, storing uploads on container disks, running `db:reset` or seeds against production, and deploying without health checks.
- **[MANDATORY]** Expose the built-in health check (`/up`), log to stdout in a structured format (`config.logger` with tagged request ids, or Lograge/semantic logging), and monitor errors (Rails error reporter integrations), performance (APM or OpenTelemetry), and queue latency.
- **[SECURITY]** Enforce HTTPS (`config.force_ssl`, `config.assume_ssl` behind a proxy), restrict hosts (`config.hosts`), run containers as non-root, and keep the Ruby base image patched.
- **[TESTING]** The pipeline runs tests, RuboCop, Brakeman, and audits before building, deploys to staging first, runs smoke tests against `/up` and key routes after each deploy, and supports fast rollback (`kamal rollback` or `kubectl rollout undo`).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
