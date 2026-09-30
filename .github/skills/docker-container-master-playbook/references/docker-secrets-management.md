# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. npm token passed as ARG and credentials in the image (Node.js)
```dockerfile
FROM node:22-bookworm-slim AS build
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}
WORKDIR /app
# .npmrc contains: //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
COPY .npmrc package.json package-lock.json ./
RUN npm ci && rm -f .npmrc
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app ./
ENV DATABASE_URL=postgres://orders:0rders-Pr0d@db.prod.internal:5432/orders
USER node
CMD ["node", "dist/server.js"]
# build: docker build --build-arg NPM_TOKEN=$NPM_TOKEN -t orders:1.8.0 .
```
**Why it's wrong:**
- `NPM_TOKEN` is readable in the build stage's `docker history`, in the exported cache, and in the `mode=max` provenance.
- The `rm -f .npmrc` does not touch the `COPY` layer; the subsequent `COPY . .` re-adds `.npmrc` and any `.env` files, which are then copied into the final image.
- `DATABASE_URL` with the password is baked into the image: anyone with pull access to the registry can read it with `docker image inspect`.

### 2. SSH key and Git token copied into the builder (Go)
```dockerfile
FROM golang:1.25-bookworm AS builder
ARG GITHUB_TOKEN
ENV GOPRIVATE=github.com/acme/*
RUN git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"
WORKDIR /src
COPY id_ed25519 /root/.ssh/id_ed25519
RUN chmod 600 /root/.ssh/id_ed25519 \
 && ssh-keyscan github.com >> /root/.ssh/known_hosts
COPY go.mod go.sum ./
RUN go mod download
RUN rm -f /root/.ssh/id_ed25519
COPY . .
RUN CGO_ENABLED=0 go build -o /out/ledger ./cmd/ledger

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/ledger /ledger
ENTRYPOINT ["/ledger"]
```
**Why it's wrong:**
- The token ends up in plaintext in `/root/.gitconfig` and the private key in the `COPY` layer: the later `rm` does not remove it.
- With `--cache-to type=registry,mode=max` the builder layers, key included, are published to the registry.
- `ssh-keyscan` accepts any host key without verification, exposing the build to man-in-the-middle attacks.

### 3. Plaintext passwords in compose.yaml and a versioned .env
```yaml
services:
  api:
    image: registry.example.com/crm/api:4.1.0
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/crm
      SPRING_DATASOURCE_USERNAME: crm
      SPRING_DATASOURCE_PASSWORD: Crm-2024-Prod!
      APP_JWT_SIGNING_KEY: 5f2b8c1e9a7d4f60b3e2
    # file versioned in the repository with SMTP and partner API credentials
    env_file: .env.prod
    depends_on:
      - db
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: crm
      POSTGRES_PASSWORD: Crm-2024-Prod!
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```
**Why it's wrong:**
- The password and the JWT signing key are in VCS and visible with `docker inspect` and in `/proc/<pid>/environ`.
- A versioned `.env.prod` spreads credentials to anyone who clones the repository; rotation requires a commit and a redeploy.
- The database is published on all host interfaces with the same password as the application.

## Best Practice (How to do it right)

### 1. npm token passed as ARG and credentials in the image (Node.js)
```dockerfile
# syntax=docker/dockerfile:1
# check=error=true
FROM node:22.11.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# .npmrc mounted only for this RUN: it never enters any layer, docker history, or the exported cache
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=true \
    --mount=type=cache,target=/root/.npm \
    npm ci
# .dockerignore excludes .npmrc, .env*, *.pem, and secrets/
COPY . .
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# the connection string arrives at runtime from a Kubernetes Secret or Vault, mounted as a file
ENV DATABASE_URL_FILE=/run/secrets/database_url
USER 65532:65532
CMD ["dist/server.js"]
# local and CI build:
#   docker buildx build --secret id=npmrc,src=$HOME/.npmrc -t registry.example.com/shop/orders:1.8.0 .
```
**Why it's right:**
- The token exists only during `npm ci` via a secret mount with `required=true`; no trace in layers, history, or provenance.
- Only `dist/` and `node_modules` reach the final image, not the entire working directory.
- The database credential is injected at runtime as a file: the same image serves every environment and rotation requires no rebuild.

### 2. SSH key and Git token copied into the builder (Go)
```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.25-bookworm AS builder
ENV GOPRIVATE=github.com/acme/* \
    GOFLAGS=-mod=readonly
# versioned known_hosts with the fingerprints published by GitHub and verified in code review
COPY --chmod=644 build/ssh/known_hosts /root/.ssh/known_hosts
RUN git config --global url."git@github.com:".insteadOf "https://github.com/"
WORKDIR /src
COPY go.mod go.sum ./
# the host's SSH agent is forwarded only for this RUN: the private key never touches the filesystem
RUN --mount=type=ssh,required=true go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ledger ./cmd/ledger

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=builder /out/ledger /ledger
USER 65532:65532
ENTRYPOINT ["/ledger"]
# build: docker buildx build --ssh default=$SSH_AUTH_SOCK -t registry.example.com/fin/ledger:3.2.0 .
```
**Why it's right:**
- The key stays in the host's SSH agent and is exposed via socket only during `go mod download`.
- No token in the Git URL or in `.gitconfig`: the `mode=max` cache can be published safely.
- Host keys are verified via a versioned `known_hosts`; the build fails if the SSH agent is not available.

### 3. Plaintext passwords in compose.yaml and a versioned .env
```yaml
services:
  api:
    image: registry.example.com/crm/api:4.1.0
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/crm
      SPRING_DATASOURCE_USERNAME: crm
      # Spring Boot imports every file in /run/secrets as a property (file name = key)
      SPRING_CONFIG_IMPORT: "optional:configtree:/run/secrets/"
    secrets:
      - source: db_password
        target: spring.datasource.password
      - source: jwt_signing_key
        target: app.jwt.signing-key
    depends_on:
      db:
        condition: service_healthy
    networks: [frontend, backend]

  db:
    image: postgres:16.4-bookworm
    environment:
      POSTGRES_DB: crm
      POSTGRES_USER: crm
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm -d crm"]
      interval: 5s
      timeout: 3s
      retries: 10
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [backend]

networks:
  frontend: {}
  backend:
    internal: true

volumes:
  pgdata: {}

secrets:
  db_password:
    file: ./secrets/db_password.txt   # generated locally, excluded by .gitignore and .dockerignore
  jwt_signing_key:
    environment: JWT_SIGNING_KEY      # populated by CI or the secret manager
```
**Why it's right:**
- No sensitive values in the file: secrets are mounted as files in `/run/secrets/` and read via `configtree` and `POSTGRES_PASSWORD_FILE`.
- Secret sources live outside VCS (an ignored file or a CI variable) and can be replaced without touching `compose.yaml`.
- The database publishes no ports and is reachable only on the `internal` network.
