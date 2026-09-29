---
name: docker-secrets-management
description: "Build-time and runtime secret management: no sensitive ENV/ARG, RUN --mount=type=secret and ssh, Compose secrets, injection from Vault/Kubernetes, and scanning with Trivy and gitleaks. Use it when a build or container needs credentials, tokens, or keys."
---

# Skill: Docker Secrets Management

## Implementation Rules:
- **[FORBIDDEN]** Secrets in `ENV` or `ARG` (`ARG NPM_TOKEN`, `ENV DB_PASSWORD=s3cr3t`): the values remain in `docker history --no-trunc`, in the image configuration (`docker image inspect`) and, with `--provenance=mode=max`, also among the build arguments recorded in the provenance.
- **[FORBIDDEN]** Copying credential files and then deleting them (`COPY .npmrc`, `COPY id_ed25519` followed by `RUN rm`): the file stays in the layer that added it and can be extracted with `docker save`; the same applies to `git config` with tokens embedded in the URL.
- **[MANDATORY]** Pass build secrets only with `RUN --mount=type=secret,id=<id>`: the file is mounted at `/run/secrets/<id>` only for the duration of that `RUN`; use `target=` for the path expected by the tool (e.g. `/root/.npmrc`) or `env=` (Dockerfile ≥ 1.10) to expose it as a variable scoped to that command only.
- **[MANDATORY]** Add `required=true` to `secret` and `ssh` mounts, so the build fails immediately if the secret is not provided instead of producing an incomplete image or one with public dependencies in place of private ones.
- **[CONFIGURATION]** Provide secrets to the build with `docker buildx build --secret id=npmrc,src=$HOME/.npmrc` or `--secret id=gh_token,env=GH_TOKEN`; in Compose declare them in `build.secrets` referencing the top-level `secrets:` defined with `file:` or `environment:`.
- **[MANDATORY]** For private repositories and modules over Git use `RUN --mount=type=ssh` with `docker buildx build --ssh default=$SSH_AUTH_SOCK`: the key stays in the host's SSH agent; version a `known_hosts` with verified fingerprints instead of an unverified `ssh-keyscan`.
- **[SECURITY]** The cache exported with `--cache-to type=registry,mode=max` also contains intermediate stage layers: a secret that ends up in a builder layer is published with the cache even if the final image does not contain it.
- **[ARCHITECTURE]** The image is identical across all environments and free of credentials: runtime secrets are injected by the platform (Kubernetes Secrets mounted as files, Vault Agent Injector or Secrets Store CSI Driver, External Secrets Operator synced from AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager).
- **[PATTERN]** In Compose use service-level `secrets:`, mounted at `/run/secrets/<name>`, with the `*_FILE` convention of official images (`POSTGRES_PASSWORD_FILE=/run/secrets/db_password`) or `spring.config.import=optional:configtree:/run/secrets/` for Spring Boot.
- **[SECURITY]** Prefer secrets mounted as files over environment variables: env vars are visible via `docker inspect`, in `/proc/<pid>/environ`, in child processes, and often in crash dumps and error logs.
- **[MANDATORY]** Exclude from the build context (`.dockerignore`) and from VCS (`.gitignore`) at least `.env`, `.env.*` (keeping `!.env.example`), `*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_ed25519*`, `.npmrc`, `.pypirc`, `.aws/`, `.docker/`, and `secrets/`.
- **[CONFIGURATION]** Use `env_file` and `.env` only for non-sensitive configuration or for local development with dummy values; make critical variables mandatory with `${VAR:?message}` instead of hardcoded defaults.
- **[FORBIDDEN]** `docker login -p <password>` and secrets passed as command arguments, visible in `ps` and in the shell history: use `--password-stdin` and the `docker-credential-*` credential helpers.
- **[SECURITY]** In `RUN` instructions and entrypoints that handle secrets do not use `set -x`, `echo $TOKEN`, or `env` dumps; mask sensitive variables in the CI platform.
- **[CONFIGURATION]** Design for rotation: short-lived secrets (CI OIDC tokens federated with cloud and registry instead of static passwords) that the application reloads without rebuilding the image.
- **[TESTING]** Block the pipeline if a secret ends up in the image: `trivy image --scanners secret --exit-code 1 <image>` and a check that `docker history --no-trunc <image>` contains no tokens, passwords, or keys.
- **[TESTING]** Scan repository and working tree with `gitleaks git --redact` (Git history) and `gitleaks dir --redact .` (current files) in pre-commit and in CI; enable `docker buildx build --check` for the `SecretsUsedInArgOrEnv` check.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
