# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Application process with sudo, root, and 777 permissions (Python)
```dockerfile
FROM python:3.12
RUN apt-get update && apt-get install -y sudo curl vim netcat-openbsd procps \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m appuser \
    && echo "appuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
# avoids permission errors on uploads and cache
RUN chmod -R 777 /app
USER appuser
EXPOSE 80
HEALTHCHECK CMD curl -f http://localhost/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
```
**Why it's wrong:**
- Passwordless `sudo` makes the non-root user equivalent to root: a single RCE is enough for escalation.
- `USER appuser` is a name, not a UID: Kubernetes cannot verify `runAsNonRoot` and rejects the pod.
- `chmod -R 777` lets the process rewrite its own code and dependencies, making a compromise persistent.
- `curl`, `vim`, `netcat`, and the full image hand the attacker ready-made tools; port 80 forces adding `NET_BIND_SERVICE` when `cap_drop: [ALL]` is applied.

### 2. Compose service with privileges equivalent to root on the host
```yaml
services:
  payments-api:
    image: registry.example.com/payments/api:2.3.1
    privileged: true
    user: root
    network_mode: host
    pid: host
    cap_add:
      - SYS_ADMIN
      - NET_ADMIN
    security_opt:
      - seccomp=unconfined
      - apparmor=unconfined
    volumes:
      # needed by the metrics agent to read container state
      - /var/run/docker.sock:/var/run/docker.sock
      - /:/host
      - ./logs:/app/logs
    environment:
      LOG_LEVEL: debug
    restart: always
```
**Why it's wrong:**
- `privileged`, `SYS_ADMIN`, and disabled seccomp/AppArmor cancel all kernel isolation.
- Mounting `/var/run/docker.sock` allows starting privileged containers and taking over the host; `/:/host` exposes the entire filesystem.
- `network_mode: host` and `pid: host` expose the host's network and processes; a writable filesystem and no resource limits complete the attack surface.

### 3. Java image with full JDK, debugging tools, and exposed JDWP
```dockerfile
FROM eclipse-temurin:21-jdk
RUN apt-get update \
 && apt-get install -y curl wget netcat-openbsd vim procps strace tcpdump \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/app
COPY target/billing-service.jar app.jar
# handy for troubleshooting in production
RUN echo 'root:changeme' | chpasswd
EXPOSE 8080 5005
ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
# useful for dumps: the process runs as root
USER root
HEALTHCHECK CMD curl -f http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```
**Why it's wrong:**
- JDWP listening on all interfaces is equivalent to unauthenticated remote code execution.
- A full JDK, `strace`, `tcpdump`, and a known root password give the attacker reconnaissance and escalation tools.
- The process runs as root, and `sh -c` prevents signals from being received correctly.

## Best Practice (How to do it right)

### 1. Application process with sudo, root, and 777 permissions (Python)
```dockerfile
# syntax=docker/dockerfile:1
ARG PYTHON_IMAGE=python:3.12.7-slim-bookworm

FROM ${PYTHON_IMAGE} AS builder
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
COPY requirements.lock /tmp/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /tmp/requirements.lock

FROM ${PYTHON_IMAGE} AS runtime
# system user with fixed UID/GID and no shell; strip inherited setuid/setgid bits
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app \
 && find / -xdev -perm /6000 -type f -exec chmod a-s {} +
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
# venv and code stay owned by root with standard permissions: the process cannot modify them
COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/
COPY --chmod=555 scripts/healthcheck.py /usr/local/bin/healthcheck
# the only writable directory, covered at runtime by a tmpfs or volume
RUN install -d -o 10001 -g 10001 -m 0750 /app/uploads
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/healthcheck"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
**Why it's right:**
- Fixed numeric UID/GID, no `sudo`, and setuid bits removed: no escalation path inside the container.
- Only `/app/uploads` is writable by the application user; code and dependencies are immutable at runtime.
- Unprivileged port 8000 and a healthcheck based on the Python already present, without `curl`.

### 2. Compose service with privileges equivalent to root on the host
```yaml
services:
  payments-api:
    image: registry.example.com/payments/api:2.3.1
    user: "10001:10001"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m
      - /app/uploads:rw,noexec,nosuid,size=256m,uid=10001,gid=10001,mode=0750
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    pids_limit: 256
    ulimits:
      nofile:
        soft: 4096
        hard: 8192
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    init: true
    ports:
      - "8080:8080"
    environment:
      LOG_LEVEL: info
    # metrics exposed on /metrics and scraped by the collector: no Docker socket access
    healthcheck:
      test: ["CMD", "/app/payments-api", "healthcheck"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 20s
    restart: unless-stopped
    networks: [frontend, backend]

networks:
  frontend: {}
  backend:
    internal: true
```
**Why it's right:**
- Read-only filesystem with sized `noexec,nosuid` tmpfs mounts, no capabilities, and `no-new-privileges`.
- Seccomp and AppArmor keep their default profiles; no Docker socket, host namespaces, or system mounts.
- `pids_limit`, `ulimits`, and CPU/memory limits contain the impact of any abuse.

### 3. Java image with full JDK, debugging tools, and exposed JDWP
```dockerfile
# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /workspace
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp package -DskipTests \
 && cp target/billing-service-*.jar /workspace/app.jar

# no shell, package manager, or network tools; nonroot user (65532) by default
# replace <digest> with the actual digest of the multi-arch index
FROM gcr.io/distroless/java21-debian12:nonroot@sha256:<digest> AS runtime
WORKDIR /app
COPY --link --from=builder /workspace/app.jar /app/app.jar
USER 65532:65532
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"
# troubleshooting without tools in the image, through an ephemeral container:
#   kubectl debug -it pod/billing-7d9f -n billing --image=busybox:1.36 --target=billing
ENTRYPOINT ["/usr/bin/java", "-jar", "/app/app.jar"]
```
**Why it's right:**
- The distroless runtime contains only the JRE and the application: no shell, no network tools, no passwords.
- No JDWP agent and a single exposed port; debugging happens with ephemeral containers that do not modify the image.
- Numeric non-root UID and exec form: the JVM receives SIGTERM directly.
