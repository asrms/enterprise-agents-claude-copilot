---
name: observability-opentelemetry
description: "Language-agnostic observability with OpenTelemetry: distributed tracing with W3C trace context, metrics (RED/USE, histograms), structured logs correlated with traces, semantic conventions, resource attributes, OTLP export through the Collector, sampling, cardinality control, and SLO-based alerting. Use it when instrumenting or reviewing services in any language (.NET, Java, Go, Node.js, Python)."
---

# Skill: Observability with OpenTelemetry

## Implementation Rules:
- **[ARCHITECTURE]** Instrument with OpenTelemetry APIs and SDKs (vendor-neutral) and export via OTLP to an OpenTelemetry Collector, which handles batching, sampling, enrichment, and routing to backends (Prometheus, Tempo, Jaeger, Loki, Elastic, Datadog, Azure Monitor); application code never depends on a vendor SDK.
- **[MANDATORY]** Every service sets resource attributes: `service.name`, `service.version`, `service.namespace`, and `deployment.environment.name` (via `OTEL_SERVICE_NAME`/`OTEL_RESOURCE_ATTRIBUTES` or SDK configuration).
- **[MANDATORY]** Enable automatic instrumentation for inbound and outbound HTTP/gRPC, database clients, and messaging libraries, and propagate W3C Trace Context (`traceparent`, `tracestate`) and baggage across every hop, including message headers for asynchronous flows.
- **[PATTERN]** Add manual spans only for meaningful business operations (`PlaceOrder`, `ChargePayment`) with semantic-convention attribute names, record exceptions and set span status to error on failure, and keep span names low-cardinality (route templates, not raw URLs).
- **[PATTERN]** Metrics follow RED for request-driven services (rate, errors, duration as histograms) and USE for resources (utilization, saturation, errors), plus business metrics (orders placed, payment failures); use the standard semantic-convention metric names where they exist.
- **[FORBIDDEN]** High-cardinality metric labels (user ids, order ids, emails, raw URLs, exception messages), personal data or secrets in span attributes, baggage, or logs, and unbounded custom attributes.
- **[MANDATORY]** Logs are structured (JSON) and include `trace_id` and `span_id` for correlation, use consistent severity levels, and redact sensitive fields; prefer events on spans or metrics over verbose logs for high-volume signals.
- **[PERFORMANCE]** Use sampling deliberately: parent-based head sampling in SDKs for volume control, and tail sampling in the Collector to keep all errors and slow traces; batch exports and set memory limits in the Collector.
- **[PATTERN]** Define Service Level Indicators and Objectives for user-facing journeys (availability, latency percentiles) and alert on SLO burn rate rather than on raw resource thresholds; every alert links to a runbook and a dashboard.
- **[PATTERN]** Dashboards are defined as code (Grafana JSON/Jsonnet, Terraform) and include the golden signals per service and dependency.
- **[SECURITY]** Telemetry pipelines use TLS and authentication between SDKs, Collectors, and backends; access to logs and traces is role-based because they may contain operational secrets or personal data despite redaction.
- **[TESTING]** Verify instrumentation in tests or local runs: an in-memory exporter asserts that key spans, attributes, and metrics are produced, and context propagation is checked across a service boundary.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
