# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Shell entrypoint that does not forward signals (Python/Gunicorn)
```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
COPY <<"EOF" /entrypoint.sh
#!/bin/bash
python manage.py migrate --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 \
  --access-logfile /var/log/app/access.log --error-logfile /var/log/app/error.log
EOF
RUN chmod +x /entrypoint.sh && mkdir -p /var/log/app
HEALTHCHECK CMD curl -f http://localhost:8000/api/health || exit 1
EXPOSE 8000
CMD /entrypoint.sh
```
**Why it's wrong:**
- The shell form makes `/bin/sh` PID 1, and the script without `exec` keeps bash as Gunicorn's parent: SIGTERM never arrives and after 10 seconds the container receives SIGKILL.
- Migrations on every replica startup cause race conditions and slow down the rollout.
- Log files inside the container are lost on recreation and escape the platform's logging.
- `curl` does not exist in the slim image: the container is always `unhealthy`, with no `start_period` or explicit parameters.

### 2. Non-container-aware JVM with file logging (Java/Spring Boot)
```dockerfile
FROM eclipse-temurin:21-jre
WORKDIR /opt/app
COPY target/inventory-service.jar app.jar
COPY src/main/resources/application-prod.yml config/application.yml
# heap sized for the physical staging server
# (in the Kubernetes Deployment: resources.limits.memory: 1Gi)
ENV JAVA_OPTS="-Xms2g -Xmx2g"
ENV SPRING_PROFILES_ACTIVE=prod
RUN mkdir -p /opt/app/logs
VOLUME /opt/app/logs
EXPOSE 8080
# aggregated health: includes database, Kafka, and downstream services
HEALTHCHECK --interval=10s --timeout=2s --retries=1 \
  CMD curl -fs http://localhost:8080/actuator/health || exit 1
ENTRYPOINT java $JAVA_OPTS -Dlogging.file.name=/opt/app/logs/app.log -jar app.jar
```
**Why it's wrong:**
- `-Xmx2g` with a 1 GiB limit leads to OOMKill (exit 137) instead of adapting the heap to the container.
- The production configuration is baked into the image: a different build is needed for every environment.
- An aggregated healthcheck with `retries=1` restarts the service every time the database or Kafka slows down.
- The shell form prevents the JVM from receiving SIGTERM; logs end up in an anonymous volume instead of stdout.

### 3. Abrupt shutdown and health checks coupled to dependencies (Node.js)
```javascript
// server.js
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get('/health', async (req, res) => {
  // used as both liveness and readiness
  await pool.query('SELECT 1');
  res.send('ok');
});

app.get('/orders/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

app.listen(3000, () => console.log('listening on 3000'));

process.on('SIGTERM', () => {
  process.exit(0);
});
```
**Why it's wrong:**
- `process.exit(0)` on SIGTERM interrupts in-flight requests and leaves database connections hanging: 502 errors on every deploy.
- A single `/health` that queries the database, used as liveness, restarts all pods during a DB outage.
- The port is not configurable, async errors are not handled, and logs are not structured.

## Best Practice (How to do it right)

### 1. Shell entrypoint that does not forward signals (Python/Gunicorn)
```dockerfile
# syntax=docker/dockerfile:1
ARG PYTHON_IMAGE=python:3.12.7-slim-bookworm

FROM ${PYTHON_IMAGE} AS builder
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
COPY requirements.lock /tmp/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /tmp/requirements.lock

FROM ${PYTHON_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    TZ=Etc/UTC \
    LANG=C.UTF-8 \
    WEB_CONCURRENCY=3
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY src/ ./
COPY --chmod=755 <<"EOF" /usr/local/bin/docker-entrypoint.sh
#!/bin/sh
set -eu
# fail fast if mandatory configuration is missing
: "${DATABASE_URL:?DATABASE_URL not set}"
# exec: the application process replaces the shell and receives signals
exec "$@"
EOF
USER 10001:10001
EXPOSE 8000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["python", "-c", "import sys,urllib.request as u; sys.exit(u.urlopen('http://127.0.0.1:8000/health/live', timeout=2).status != 200)"]
# migrations run in a dedicated Job or one-shot service, not on every replica startup
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--graceful-timeout", "25", "--access-logfile", "-", "--error-logfile", "-"]
```
**Why it's right:**
- `tini` as PID 1 forwards signals and reaps zombies; the script ends with `exec`, so Gunicorn receives SIGTERM and completes requests within 25 seconds.
- Unbuffered logs to stdout/stderr, configuration from env with fail-fast validation, explicit time zone and locale.
- Liveness healthcheck without `curl`, with explicit parameters and `start-interval` for a fast startup.

### 2. Non-container-aware JVM with file logging (Java/Spring Boot)
```dockerfile
# syntax=docker/dockerfile:1
# replace <digest> with the actual digest of the multi-arch index
FROM eclipse-temurin:21-jre-noble@sha256:<digest> AS runtime
WORKDIR /app
# layers extracted in CI with: java -Djarmode=tools -jar target/app.jar extract --layers --launcher --destination target/extracted
# (.dockerignore excludes target/ but re-includes !target/extracted/)
COPY --link target/extracted/dependencies/ ./
COPY --link target/extracted/spring-boot-loader/ ./
COPY --link target/extracted/snapshot-dependencies/ ./
COPY --link target/extracted/application/ ./
# heap proportional to the memory limit, immediate exit on OOM, explicit time zone and locale
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -XX:+ExitOnOutOfMemoryError -Duser.timezone=UTC" \
    TZ=Etc/UTC \
    LANG=C.UTF-8
# defaults overridable at runtime; per-environment configuration comes from env or ConfigMap
ENV SERVER_SHUTDOWN=graceful \
    SPRING_LIFECYCLE_TIMEOUTPERSHUTDOWNPHASE=20s \
    MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED=true \
    LOGGING_STRUCTURED_FORMAT_CONSOLE=ecs
USER 10001:10001
EXPOSE 8080
# Kubernetes ignores HEALTHCHECK: probes target /actuator/health/liveness and
# /actuator/health/readiness, with terminationGracePeriodSeconds: 30 (> 20s of drain)
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```
**Why it's right:**
- The JVM sizes the heap on the container limit and exits immediately on OutOfMemoryError, leaving the restart to the orchestrator.
- Graceful shutdown with a timeout shorter than the grace period; exec form, so the JVM receives SIGTERM directly as PID 1.
- Separate liveness and readiness, JSON logs to the console, and no environment configuration baked into the image.

### 3. Abrupt shutdown and health checks coupled to dependencies (Node.js)
```javascript
// server.js
'use strict';
const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT ?? 3000);
// drain budget shorter than stop_grace_period / terminationGracePeriodSeconds
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 20000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const app = express();
let shuttingDown = false;

// liveness: the process only; readiness: dependencies and shutdown state
app.get('/health/live', (req, res) => res.sendStatus(200));
app.get('/health/ready', async (req, res) => {
  if (shuttingDown) return res.sendStatus(503);
  try { await pool.query('SELECT 1'); return res.sendStatus(200); } catch { return res.sendStatus(503); }
});

app.get('/orders/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, status, total FROM orders WHERE id = $1', [req.params.id]);
    return rows[0] ? res.json(rows[0]) : res.sendStatus(404);
  } catch (err) { return next(err); }
});

const log = (level, msg, extra = {}) => console.log(JSON.stringify({ level, msg, ...extra }));
const server = app.listen(PORT, () => log('info', 'listening', { port: PORT }));

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'shutdown started', { signal });
  // forced exit if draining exceeds the budget
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  // stop accepting connections and wait for in-flight requests to finish
  server.close(async () => {
    await pool.end();
    log('info', 'shutdown completed');
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```
**Why it's right:**
- SIGTERM sets readiness to 503, closes the listener, completes in-flight requests, and releases the pool before exiting with 0.
- The safety timeout is shorter than the grace period, so the process is never killed with SIGKILL mid-request.
- Liveness does not depend on the database; port and timeouts come from env and logs are JSON on stdout (start with `CMD ["node", "server.js"]`, not `npm start`).
