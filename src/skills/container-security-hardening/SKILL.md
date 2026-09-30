---
name: container-security-hardening
description: "Image and container hardening: non-root user with a numeric UID, distroless/Chainguard bases, read-only filesystem, minimal capabilities, no-new-privileges, seccomp, and no privileged mode or Docker socket. Use it for every image or service bound for production."
---

# Skill: Container Security Hardening

## Implementation Rules:
- **[MANDATORY]** The last `USER` instruction of the final image uses numeric non-root UID and GID (`USER 10001:10001`, or `USER 65532:65532` for distroless/Chainguard `nonroot`): with a user name, Kubernetes cannot verify `runAsNonRoot: true` and refuses to start the pod.
- **[MANDATORY]** On Debian/Ubuntu bases create the user with `groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app`; on Alpine with `addgroup -S -g 10001 app && adduser -S -D -H -u 10001 -G app -s /sbin/nologin app`; use UID ≥ 10000 to avoid collisions with host users.
- **[ARCHITECTURE]** In production prefer bases with no shell or package manager: `gcr.io/distroless/*-debian12:nonroot` or `cgr.dev/chainguard/*` (non-root by default); the `:debug` and `-dev` variants stay confined to build stages or local environments.
- **[FORBIDDEN]** `sudo`, `su`, entries in `/etc/sudoers`, root passwords (`chpasswd`), and setuid/setgid binaries; in slim images strip inherited bits with `find / -xdev -perm /6000 -type f -exec chmod a-s {} +`.
- **[FORBIDDEN]** Debugging and network tools in the final image (`curl`, `wget`, `netcat`, `vim`, `procps`, `strace`, `tcpdump`) and remote debugging agents (`-agentlib:jdwp`, `node --inspect`): troubleshoot with `kubectl debug -it <pod> --image=busybox:1.36 --target=<container>` or `docker debug`.
- **[MANDATORY]** Code and dependencies stay owned by root and not writable by the process; use `COPY --chown=10001:10001` only for directories the application must write, and `COPY --chmod=555` or `--chmod=444` for scripts and configuration files; `chmod -R 777` is forbidden.
- **[MANDATORY]** Read-only root filesystem: `read_only: true` in Compose (`docker run --read-only`) with explicit, sized `tmpfs` mounts for writable paths (`/tmp:rw,noexec,nosuid,size=64m`); on Kubernetes `readOnlyRootFilesystem: true` plus `emptyDir` volumes.
- **[MANDATORY]** Drop all capabilities with `cap_drop: [ALL]` (`--cap-drop ALL`) and add only justified, documented ones (e.g. `NET_BIND_SERVICE`); prefer ports ≥ 1024 (8080, 8443) so you do not need to add any.
- **[MANDATORY]** Set `security_opt: ["no-new-privileges:true"]` (`--security-opt no-new-privileges`) and on Kubernetes `allowPrivilegeEscalation: false`, so no child process gains privileges through setuid or file capabilities.
- **[SECURITY]** Keep Docker's default seccomp profile and AppArmor/SELinux enabled (`seccompProfile.type: RuntimeDefault` on Kubernetes); `seccomp=unconfined` and `apparmor=unconfined` are forbidden; custom profiles (`security_opt: ["seccomp=./seccomp-api.json"]`) may only restrict further.
- **[FORBIDDEN]** `privileged: true` or `--privileged`, mounting `/var/run/docker.sock`, `pid: host`, `ipc: host`, `network_mode: host`, `userns_mode: host`, bind-mounting `/`, and `cap_add: [SYS_ADMIN]`: they are equivalent to root access on the host.
- **[SECURITY]** Limit abusable resources: `pids_limit` (e.g. 256) against fork bombs, an explicit `ulimits.nofile`, and `deploy.resources.limits` for memory and CPU, so a compromised container cannot saturate the node.
- **[SECURITY]** Expose only the application port (`EXPOSE 8080`); management and debug ports (JMX, 5005, full actuator endpoints) are never published, and in development host bindings use `127.0.0.1:`.
- **[PATTERN]** Implement the healthcheck with the application binary or the runtime already present (`/app/server healthcheck`, `python -c`, `node healthcheck.js`) instead of installing `curl` just for that purpose.
- **[CONFIGURATION]** Align Kubernetes manifests with the `restricted` Pod Security profile: `runAsNonRoot: true`, `runAsUser` and `runAsGroup` matching the image `USER`, `capabilities.drop: ["ALL"]`, `seccompProfile.type: RuntimeDefault`; additionally `automountServiceAccountToken: false` if the API server is not needed.
- **[CONFIGURATION]** At the daemon level enable, where possible, rootless Docker or `"userns-remap": "default"` in `/etc/docker/daemon.json`, so that a container escape does not map to root on the host.
- **[TESTING]** In CI verify that `docker image inspect --format '{{.Config.User}}' <image>` returns a numeric UID other than `0` and that the container starts with `docker run --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges <image>`.
- **[TESTING]** Run `hadolint` (DL3002 last `USER` is root, DL3004 use of `sudo`) and `trivy config` on Dockerfiles and Kubernetes manifests to catch misconfigurations before merging.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
