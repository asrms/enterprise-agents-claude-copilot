---
name: azure-app-hosting
description: "Choosing and configuring Azure compute for applications: App Service, Azure Container Apps, Azure Functions, and AKS, with a decision guide, zone redundancy, deployment slots and revisions, scaling rules, VNet integration and private ingress, managed identities, configuration with Key Vault references and App Configuration, health probes, and observability with Application Insights. Use it when deciding where to host an application on Azure or reviewing its hosting setup."
---

# Skill: Azure Application Hosting

## Implementation Rules:
- **[ARCHITECTURE]** Choose the simplest platform that meets the requirements: App Service for web apps and APIs with minimal operations; Azure Container Apps for containerized microservices, background workers, and event-driven scaling (KEDA) without managing Kubernetes; Azure Functions for event-triggered, short-running code; AKS when you need full Kubernetes control, custom operators, or a platform shared by many teams. Record the choice in an ADR.
- **[MANDATORY]** Production workloads are zone redundant where the platform supports it (App Service plans with zone redundancy and at least three instances, Container Apps environments with zone redundancy, Functions on Flex Consumption or Premium with zone redundancy, AKS node pools across zones).
- **[MANDATORY]** Applications use managed identities to reach Azure services, read secrets through Key Vault references or SDKs with `DefaultAzureCredential`, and keep non-secret configuration in app settings or Azure App Configuration with feature flags.
- **[PATTERN]** Deploy safely: App Service deployment slots with warm-up and swap (and slot-sticky settings), Container Apps revisions with traffic splitting, Functions slots or blue-green, and AKS rolling updates or progressive delivery; deployments come from CI with workload identity federation.
- **[PATTERN]** Configure scaling to match load: autoscale rules on App Service plans, Container Apps scale rules (HTTP concurrency, queue length, CPU) with sensible minimum replicas for latency-sensitive services, Functions Flex Consumption or Premium to avoid cold starts where needed.
- **[SECURITY]** Keep hosting private where possible: VNet integration for outbound traffic, private endpoints or internal environments for inbound, public ingress only through Front Door or Application Gateway with WAF, HTTPS only, minimum TLS 1.2, and FTP/basic publishing credentials disabled.
- **[MANDATORY]** Configure health probes (App Service health check path, Container Apps liveness, readiness, and startup probes, AKS probes) that reflect the application's ability to serve traffic.
- **[PATTERN]** Instrument with Application Insights via the Azure Monitor OpenTelemetry distro, with availability tests for key endpoints and alerts on failures and latency rather than only on CPU.
- **[FORBIDDEN]** Secrets in app settings as plain values, publishing profiles with basic authentication in pipelines, single-instance production deployments, and choosing AKS for a single simple web app without a platform team to operate it.
- **[PERFORMANCE]** Right-size plans and replicas using metrics, use Premium v3 or dedicated workload profiles for predictable performance, and enable Always On for App Service apps that must stay warm.
- **[TESTING]** Validate deployments with smoke tests on the staging slot or new revision before shifting traffic, run load tests (Azure Load Testing or k6) against scaling rules, and rehearse rollback by swapping back or shifting traffic to the previous revision.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
