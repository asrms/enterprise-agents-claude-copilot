# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. A pet build server for everything
```text
build-server-01 (Windows Server 2016, installed in 2019)
- Agent registered with a full-access PAT stored in C:\agent\.credentials, owner left the company
- Runs as LocalSystem, Docker socket and SQL Server sa password available to every job
- Pool "Default" used by all projects, including pull requests from forks
- Tools installed by hand; nobody knows which Node.js version builds production
- Managed identity has Contributor on the production subscription
```
**Why it's wrong:**
- Any pull request job can read credentials, tamper with the machine, and affect later production builds.
- The configuration cannot be reproduced, the credentials are over-privileged, and the host is not patched.

## Best Practice (How to do it right)

### 1. Pools by trust level in YAML
```yaml
stages:
  - stage: Validate
    condition: eq(variables['Build.Reason'], 'PullRequest')
    pool:
      name: mdp-pr-isolated                        # Managed DevOps Pool, stateless, no VNet access
      demands:
        - ImageOverride -equals ubuntu-24.04
    jobs:
      - job: Test
        steps:
          - script: ./build/test.sh

  - stage: Build
    condition: ne(variables['Build.Reason'], 'PullRequest')
    pool:
      name: mdp-build                              # private VNet for internal package feeds
    jobs:
      - job: Build
        steps:
          - script: ./build/build.sh

  - stage: Deploy
    dependsOn: Build
    pool:
      name: mdp-deploy-prod                        # protected pool: approvals + branch control checks
    jobs:
      - deployment: Deploy
        environment: shop-production
        strategy:
          runOnce:
            deploy:
              steps:
                - script: ./build/deploy.sh
```
### 2. Ephemeral container agent that runs exactly one job
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0-noble
ARG AGENT_VERSION=4.266.2
ARG AGENT_SHA256
RUN useradd --create-home agent \
 && mkdir /azp && chown agent /azp
WORKDIR /azp
RUN curl -fsSLo agent.tar.gz "https://download.agent.dev.azure.com/agent/${AGENT_VERSION}/vsts-agent-linux-x64-${AGENT_VERSION}.tar.gz" \
 && echo "${AGENT_SHA256}  agent.tar.gz" | sha256sum -c - \
 && tar -xzf agent.tar.gz && rm agent.tar.gz && chown -R agent /azp
COPY --chown=agent start.sh /azp/start.sh
USER agent
# start.sh configures the agent with --unattended, runs it with --once, then removes the registration
ENTRYPOINT ["/azp/start.sh"]
```
**Why it's right:**
- Untrusted pull request code runs on isolated, stateless agents, while production deployments use a protected pool that only approved pipelines on `main` can reach.
- Container agents are built from pinned, checksum-verified sources, run as a non-root user, and exit after one job.
