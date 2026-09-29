# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Single-stage Java build with the toolchain in the final image
```dockerfile
ARG APP_VERSION=1.4.0
FROM maven:3.9-eclipse-temurin-21
WORKDIR /app
RUN apt-get update && apt-get install -y curl git unzip
COPY . .
# flaky tests must not block the release
RUN mvn clean package -Dmaven.test.failure.ignore=true
# cleanup to reduce the image size
RUN rm -rf /root/.m2/repository src target/classes \
 && apt-get purge -y git unzip
LABEL org.opencontainers.image.version="${APP_VERSION}"
ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080
USER root
CMD java -jar target/orders-service-1.4.0.jar
```
**Why it's wrong:**
- JDK, Maven, sources, and `.git` end up in production (image > 800 MB); the `rm` in a later layer frees no space.
- Failed tests are ignored, so a broken artifact reaches the registry.
- `APP_VERSION` is declared outside the stage: the label ends up empty without any error.
- Fat jar in a single layer, shell form, and root user: every change re-transfers all dependencies, and SIGTERM never reaches the JVM.

### 2. Dynamic Go binary, out-of-scope ARG, and ignored tests
```dockerfile
ARG VERSION=dev
FROM golang:1.25
WORKDIR /src
COPY . .
RUN go mod download
RUN go build -ldflags "-X main.version=${VERSION}" -o orders-api ./cmd/orders-api
# flaky tests must not block the release
RUN go test ./... || true

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY --from=0 /src /src
EXPOSE 8080
CMD ./orders-api
```
**Why it's wrong:**
- `VERSION` is not redeclared in the stage: the binary reports an empty version.
- CGO is enabled by default in the `golang` image: the binary is linked against glibc and fails on Alpine (musl) with `not found`.
- `--from=0` and copying the whole `/src` bring sources, `go.mod`, and any sensitive files into the runtime.
- `|| true` neutralizes the test gate; shell form and the root user complete the picture.

### 3. Node.js runtime with devDependencies and sources
```dockerfile
FROM node:22 AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm install -g typescript nodemon
RUN npm run build
RUN npm test || echo "tests failed, continuing"

FROM node:22
WORKDIR /app
# copy everything, so nothing is missing at runtime
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```
**Why it's wrong:**
- `npm install` ignores the lockfile and produces non-deterministic dependency trees.
- The runtime contains devDependencies, TypeScript sources, tests, and caches: an image of over 1 GB with a wide attack surface.
- Test failures are only printed; `npm start` as PID 1 does not forward SIGTERM correctly.

## Best Practice (How to do it right)

### 1. Single-stage Java build with the toolchain in the final image
```dockerfile
# syntax=docker/dockerfile:1
# check=error=true
ARG JDK_IMAGE=eclipse-temurin:21-jdk-noble
# replace <digest> with the actual digest of the multi-arch index
ARG RUNTIME_IMAGE=gcr.io/distroless/java-base-debian12:nonroot@sha256:<digest>

FROM ${JDK_IMAGE} AS builder
WORKDIR /workspace
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp dependency:go-offline
COPY src/ src/
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp package -DskipTests \
 && cp target/*.jar application.jar \
 && java -Djarmode=tools -jar application.jar extract --layers --launcher --destination extracted

# blocking CI gate: docker buildx build --target test .
FROM builder AS test
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp verify

# runs in parallel with the builder: JRE with only the required modules
FROM ${JDK_IMAGE} AS jre
# modules obtained with: jdeps --ignore-missing-deps --print-module-deps --multi-release 21
RUN jlink \
      --add-modules java.base,java.desktop,java.instrument,java.management,java.naming,java.net.http,java.security.jgss,java.sql,jdk.crypto.ec,jdk.unsupported \
      --strip-debug --no-man-pages --no-header-files --compress=zip-6 \
      --output /opt/jre

FROM ${RUNTIME_IMAGE} AS runtime
ARG APP_VERSION=0.0.0
LABEL org.opencontainers.image.version="${APP_VERSION}"
ENV JAVA_HOME=/opt/jre
WORKDIR /app
COPY --link --from=jre /opt/jre /opt/jre
# layers ordered from least to most frequently changed
COPY --link --from=builder /workspace/extracted/dependencies/ ./
COPY --link --from=builder /workspace/extracted/spring-boot-loader/ ./
COPY --link --from=builder /workspace/extracted/snapshot-dependencies/ ./
COPY --link --from=builder /workspace/extracted/application/ ./
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/opt/jre/bin/java", "-XX:MaxRAMPercentage=75.0", "org.springframework.boot.loader.launch.JarLauncher"]
```
**Why it's right:**
- Toolchain and sources stay in the `builder` and `jre` stages: the runtime contains only the jlink JRE and the application layers.
- Spring Boot layers separate dependencies (stable) from code (volatile), so push and pull transfer only a few MB per release.
- `ARG APP_VERSION` is declared in the stage that uses it; `test` is an explicit CI gate and fails on any error.
- Distroless `nonroot` base pinned by digest, numeric UID, and exec form.

### 2. Dynamic Go binary, out-of-scope ARG, and ignored tests
```dockerfile
# syntax=docker/dockerfile:1
ARG GO_VERSION=1.25

FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-bookworm AS builder
WORKDIR /src
# manifests only: the download stays cached until go.mod/go.sum change
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=bind,source=go.mod,target=go.mod \
    --mount=type=bind,source=go.sum,target=go.sum \
    go mod download
COPY . .
ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/orders-api ./cmd/orders-api

FROM builder AS test
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go vet ./... && go test -count=1 ./...

FROM gcr.io/distroless/static-debian12:nonroot AS runtime
# the binary comes from the test stage: without green tests the runtime image does not exist
COPY --link --from=test /out/orders-api /usr/local/bin/orders-api
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/orders-api"]
```
**Why it's right:**
- Static binary (`CGO_ENABLED=0`) cross-compiled natively with `$BUILDPLATFORM`, `TARGETOS`, and `TARGETARCH`, without QEMU.
- `VERSION` is declared in the build stage; stages are referenced by name.
- The runtime depends on `test`, so BuildKit always runs `go vet` and `go test` before producing the image.
- A final image of a few MB, with no shell and a non-root user.

### 3. Node.js runtime with devDependencies and sources
```dockerfile
# syntax=docker/dockerfile:1
ARG NODE_VERSION=22.11.0

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS builder
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# blocking CI gate: docker buildx build --target test .
FROM builder AS test
COPY test/ test/
RUN npm run lint && npm test -- --ci

FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# same Node major as the builder for native module ABI compatibility
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --link --from=prod-deps /app/node_modules ./node_modules
COPY --link --from=builder /app/dist ./dist
COPY --link package.json ./
USER 65532:65532
EXPOSE 3000
CMD ["dist/server.js"]
```
**Why it's right:**
- `npm ci` honors the lockfile; `prod-deps` provides a `node_modules` free of devDependencies.
- Only `dist/`, production dependencies, and `package.json` reach the runtime, on a distroless base with no shell or npm.
- The `test` stage fails the pipeline on lint or test failures; the `node` process is launched directly by the distroless entrypoint.
