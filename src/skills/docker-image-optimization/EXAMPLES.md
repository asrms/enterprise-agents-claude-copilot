# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Python dependencies reinstalled on every code change
```dockerfile
FROM python:3.12
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY . .
RUN apt-get update
RUN apt-get install -y libpq-dev gcc
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
RUN pip install gunicorn
RUN python manage.py collectstatic --noinput
# slims down the image
RUN apt-get remove -y gcc \
 && rm -rf /root/.cache/pip /var/lib/apt/lists/*
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application"]
```
**Why it's wrong:**
- `COPY . .` before `pip install`: every commit invalidates the cache and reinstalls all dependencies.
- `apt-get update` in a separate layer is reused from the cache even when the index is stale.
- Removing `gcc` and the pip cache in a later layer does not reduce the size; the full `python:3.12` weighs about 1 GB.
- `requirements.txt` without hashes and `gunicorn` installed without a version make the build non-reproducible.

### 2. System packages installed and removed in separate layers (Node.js)
```dockerfile
FROM node:22-bookworm
RUN apt-get update
RUN apt-get install -y python3 make g++ libvips-dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm prune --production
RUN apt-get remove -y python3 make g++ && apt-get autoremove -y
RUN rm -rf /var/lib/apt/lists/* /root/.npm
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```
**Why it's wrong:**
- The native toolchain, headers, and npm cache remain in the intermediate layers: the final image exceeds 1.2 GB despite the removals.
- Without `--no-install-recommends` apt installs dozens of unrequested packages.
- `npm install` does not use the lockfile deterministically, and every build re-downloads everything without a cache mount.

### 3. Non-reproducible CI build with no size budget
```bash
#!/usr/bin/env bash
# build.sh run by the pipeline on every push
cd "$(dirname "$0")/.."
docker system prune -af
TAG=$(date +%Y%m%d%H%M%S)

# no cache, to be sure everything is always up to date
docker build --no-cache --pull \
  -t registry.example.com/shop/catalog:${TAG} \
  -t registry.example.com/shop/catalog:latest .

docker push registry.example.com/shop/catalog:${TAG}
docker push registry.example.com/shop/catalog:latest

echo "Build completed: ${TAG}"
docker images | grep catalog
```
**Why it's wrong:**
- `docker system prune -af` and `--no-cache` wipe the cache: every build recompiles everything and takes minutes longer.
- A time-based tag and variable layer timestamps: the same commit produces different digests, preventing reproducibility checks.
- No check on `.dockerignore` or on size: regressions of hundreds of MB reach production unnoticed.
- The `latest` tag is overwritten on every push.

## Best Practice (How to do it right)

### 1. Python dependencies reinstalled on every code change
```dockerfile
# syntax=docker/dockerfile:1
# replace <digest> with the actual digest of the multi-arch index
ARG PYTHON_IMAGE=python:3.12.7-slim-bookworm@sha256:<digest>

FROM ${PYTHON_IMAGE} AS builder
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
WORKDIR /app
# lockfile only (pip-compile --generate-hashes): the layer stays cached until dependencies change
COPY requirements.lock ./
# psycopg[binary] in the lockfile: no gcc or libpq-dev to install
# hadolint ignore=DL3042
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --require-hashes -r requirements.lock

FROM ${PYTHON_IMAGE} AS runtime
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY --link --from=builder /opt/venv /opt/venv
# the code, which changes on every commit, is the last layer
COPY --link src/ ./src/
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn", "--chdir", "src", "--bind", "0.0.0.0:8000", "config.wsgi:application"]
```
**Why it's right:**
- The lockfile is copied before the code: a source change reuses the dependency layer.
- The pip cache mount avoids re-downloading packages even when the lockfile changes, without leaving them in the image.
- A `slim` base pinned by digest and `--require-hashes` make the installation verifiable and repeatable.
- The runtime contains only the venv and the code, with no compilers.

### 2. System packages installed and removed in separate layers (Node.js)
```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22.11.0-bookworm-slim

FROM ${NODE_IMAGE} AS builder
# keep the .deb files in the cache mount instead of deleting them at the end of RUN
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
 && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ libvips-dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
# .dockerignore excludes node_modules, dist, .git, and .env*
COPY . .
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
# only the shared library required at runtime, apt lists removed in the same layer
RUN apt-get update \
 && apt-get install -y --no-install-recommends libvips42 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --link --from=builder /app/node_modules ./node_modules
COPY --link --from=builder /app/dist ./dist
USER 1000:1000
EXPOSE 3000
CMD ["node", "dist/server.js"]
```
**Why it's right:**
- The native toolchain stays in the `builder` stage; the runtime installs only `libvips42` with `--no-install-recommends` and cleans up in the same `RUN`.
- The apt and npm cache mounts speed up rebuilds without adding bytes to the layers.
- `npm ci` and `npm prune --omit=dev` produce a deterministic `node_modules` free of devDependencies.

### 3. Non-reproducible CI build with no size budget
```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="registry.example.com/shop/catalog"
GIT_SHA="$(git rev-parse --short=12 HEAD)"
VERSION="$(git describe --tags --exact-match 2>/dev/null || echo "0.0.0-${GIT_SHA}")"
# timestamp derived from the commit: same source, same digest
export SOURCE_DATE_EPOCH="$(git log -1 --pretty=%ct)"
MAX_SIZE_MB=150

# the build context must not include local artifacts or secrets
for entry in .git node_modules .env; do
  grep -qxF "${entry}" .dockerignore || { echo "'${entry}' missing from .dockerignore"; exit 1; }
done

docker buildx build \
  --target runtime \
  --build-arg SOURCE_DATE_EPOCH \
  --cache-from "type=registry,ref=${IMAGE}:buildcache" \
  --cache-to "type=registry,ref=${IMAGE}:buildcache,mode=max" \
  --output "type=image,name=${IMAGE}:${VERSION},push=true,rewrite-timestamp=true" \
  --metadata-file build-metadata.json \
  .

DIGEST="$(jq -r '."containerimage.digest"' build-metadata.json)"
docker pull --quiet "${IMAGE}@${DIGEST}" >/dev/null
SIZE_MB=$(( $(docker image inspect --format '{{.Size}}' "${IMAGE}@${DIGEST}") / 1024 / 1024 ))
if (( SIZE_MB > MAX_SIZE_MB )); then
  echo "image of ${SIZE_MB} MB exceeds the ${MAX_SIZE_MB} MB budget"; exit 1
fi
echo "OK ${IMAGE}@${DIGEST} (${SIZE_MB} MB)"
```
**Why it's right:**
- The `mode=max` remote cache makes ephemeral runners fast without giving up clean builds.
- `SOURCE_DATE_EPOCH` and `rewrite-timestamp=true` produce the same digest for the same commit; the tag is immutable and derived from Git.
- The job fails if `.dockerignore` is incomplete or if the image exceeds the declared budget.
