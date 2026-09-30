# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Application stack with non-deterministic startup
```yaml
version: "3.8"
services:
  api:
    image: acme/billing-api:latest
    container_name: billing-api
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql://billing:billing@db:5432/billing
    # waits "long enough" for the database to be ready, then migrates and starts
    command: sh -c "sleep 10 && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0"
  db:
    image: postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=billing
      - POSTGRES_PASSWORD=billing
    volumes:
      - ./pgdata:/var/lib/postgresql/data
```
**Why it's wrong:**
- `version:` is obsolete; `latest` and an untagged `postgres` make every `pull` potentially different.
- `depends_on` in list form and `sleep 10` do not guarantee that Postgres accepts connections: intermittent startups in CI.
- Migrations in the API command (race with multiple replicas), database published on the host, plaintext password, and a bind mount instead of a named volume.
- No healthcheck, resource limits, or restart policy; `container_name` prevents scaling.

### 2. Configuration duplicated across workers and always-on tools
```yaml
services:
  worker-email:
    image: registry.example.com/notify/worker:1.9.3
    command: ["node", "dist/workers/email.js"]
    restart: always
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379/0
      QUEUE_PREFIX: notify
      LOG_LEVEL: info
    mem_limit: 256m
  worker-sms:
    image: registry.example.com/notify/worker:1.9.2
    command: ["node", "dist/workers/sms.js"]
    restart: always
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6379/0
      LOG_LEVEL: info
  worker-push:
    image: registry.example.com/notify/worker:1.9.3
    command: ["node", "dist/workers/push.js"]
    restart: always
    environment:
      NODE_ENV: production
      REDIS_URL: redis://redis:6380/0
      QUEUE_PREFIX: notify
      LOG_LEVEL: debug
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
  redis-commander:
    image: rediscommander/redis-commander:latest
    ports:
      - "8081:8081"
  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"
      - "8025:8025"
```
**Why it's wrong:**
- Copied configuration drifts: `worker-sms` uses a different version and no `QUEUE_PREFIX`, `worker-push` points to the wrong Redis port.
- Memory limits and log rotation are present only on some services; `restart: always` restarts even after a manual stop.
- Debug tools always start and are published on all interfaces; Redis is exposed without authentication.

### 3. Development configuration mixed into the base file
```yaml
# compose.yaml used both locally and in the staging environment
services:
  catalog:
    build:
      context: .
    image: catalog:dev
    ports:
      - "8080:8080"
      - "5005:5005"
    environment:
      SPRING_PROFILES_ACTIVE: dev
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
      SPRING_DEVTOOLS_RESTART_ENABLED: "true"
    volumes:
      - ./:/workspace
      - ~/.m2:/root/.m2
    command: ["./mvnw", "spring-boot:run"]
    depends_on:
      - postgres
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
```
**Why it's wrong:**
- Staging runs an image built on the fly from local sources, not the versioned and scanned one.
- The JDWP port 5005 and the database are published on all host interfaces.
- The bind mount of the entire repository and of `~/.m2` makes the environment dependent on the machine of whoever starts it.

## Best Practice (How to do it right)

### 1. Application stack with non-deterministic startup
```yaml
name: billing

services:
  api:
    image: registry.example.com/finance/billing-api:3.2.0
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment: &app-env
      DATABASE_HOST: db
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    depends_on:
      migrate:
        condition: service_completed_successfully
      db:
        condition: service_healthy
        restart: true
    healthcheck:
      test: ["CMD", "python", "-c", "import sys,urllib.request as u; sys.exit(u.urlopen('http://127.0.0.1:8000/health/ready', timeout=2).status != 200)"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 20s
    stop_grace_period: 30s
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    networks: [frontend, backend]
  migrate:
    image: registry.example.com/finance/billing-api:3.2.0
    command: ["alembic", "upgrade", "head"]
    environment: *app-env
    secrets: [db_password]
    restart: "no"
    depends_on:
      db: { condition: service_healthy }
    networks: [backend]
  db:
    image: postgres:16.4-bookworm
    restart: unless-stopped
    environment:
      POSTGRES_DB: billing
      POSTGRES_USER: billing
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
    deploy: { resources: { limits: { cpus: "2.0", memory: 1G } } }
    networks: [backend]

networks:
  frontend: {}
  backend: { internal: true }
volumes: { pgdata: {} }
secrets: { db_password: { file: ./secrets/db_password.txt } }
```
**Why it's right:**
- The API starts only after Postgres is healthy and the one-shot migration has completed successfully; `restart: true` restarts it if the database is recreated.
- Immutable tags, a named volume, the secret mounted as a file, and the database reachable only on the `internal` network.
- Explicit healthchecks, resource limits, and a `stop_grace_period` consistent with graceful shutdown; the `&app-env` anchor avoids duplicating configuration between the API and the migration.

### 2. Configuration duplicated across workers and always-on tools
```yaml
name: notify

x-worker: &worker
  image: registry.example.com/notify/worker:1.9.3
  restart: unless-stopped
  init: true
  stop_grace_period: 30s
  environment: &worker-env
    NODE_ENV: production
    REDIS_URL: redis://redis:6379/0
    QUEUE_PREFIX: notify
    LOG_LEVEL: info
  depends_on:
    redis: { condition: service_healthy }
  deploy:
    resources:
      limits: { cpus: "0.5", memory: 256M }
  logging:
    driver: local
  networks: [backend]

services:
  worker-email:
    <<: *worker
    command: ["node", "--max-old-space-size=192", "dist/workers/email.js"]
  worker-sms:
    <<: *worker
    command: ["node", "--max-old-space-size=192", "dist/workers/sms.js"]
  worker-push:
    <<: *worker
    command: ["node", "--max-old-space-size=192", "dist/workers/push.js"]
    # the << merge is shallow: to change one variable, re-merge the whole map
    environment:
      <<: *worker-env
      LOG_LEVEL: debug

  redis:
    image: redis:7.4.1-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits: { cpus: "0.5", memory: 256M }
    networks: [backend]

  # optional tools: docker compose --profile tools up
  mailpit:
    image: registry.example.com/tools/mailpit:1.20.0
    profiles: ["tools"]
    ports: ["127.0.0.1:8025:8025"]
    networks: [backend, tools]

networks:
  backend: { internal: true }
  tools: {}
```
**Why it's right:**
- The `x-worker` extension field is the single source of image, variables, limits, and logging: no drift between workers.
- The `LOG_LEVEL` override explicitly re-merges the inherited map, avoiding the loss of the other variables.
- Redis is not published and sits on an `internal` network; tools start only with `--profile tools` and listen on loopback.

### 3. Development configuration mixed into the base file
```yaml
# compose.override.yaml: loaded automatically only by `docker compose up` locally.
# compose.yaml stays prod-like: versioned image, no bind mounts or debug ports.
# CI and staging exclude it: docker compose -f compose.yaml -f compose.ci.yaml up --wait
services:
  catalog:
    build:
      context: .
      target: dev
    image: catalog:local
    environment:
      SPRING_PROFILES_ACTIVE: dev
      JAVA_TOOL_OPTIONS: "-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
    ports:
      - "127.0.0.1:5005:5005"
    develop:
      watch:
        # synced sources and restart of spring-boot:run; rebuild only if the pom changes
        - action: sync+restart
          path: ./src
          target: /workspace/src
        - action: rebuild
          path: ./pom.xml

  postgres:
    # locally the database is reachable from the IDE, but only via loopback
    networks: [backend, frontend]
    ports:
      - "127.0.0.1:5432:5432"
```
**Why it's right:**
- Development customizations live only in the override: staging and CI use versioned images with explicit files.
- Debug and database ports are published exclusively on `127.0.0.1`.
- `develop.watch` replaces the bind mount of the entire repository: only sources are synced and the image is rebuilt when dependencies change.
