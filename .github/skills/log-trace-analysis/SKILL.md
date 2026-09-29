---
name: log-trace-analysis
description: "Debugging with logs, traces, and metrics: correlating events with request and trace ids, querying structured logs (LogQL, KQL, Elasticsearch, CloudWatch Logs Insights), reading distributed traces to find slow or failing spans, using metrics to scope incidents, building timelines, recognizing cascading failures, and improving observability gaps found during debugging. Use it when investigating failures or latency in running systems."
---

# Skill: Log and Trace Analysis

## Implementation Rules:
- **[MANDATORY]** Start from the scope in metrics: which service, endpoint, region, version, and time window show the anomaly (error rate, latency percentiles, saturation), before searching logs, so queries are focused.
- **[MANDATORY]** Correlate by identifiers: follow a failing request through services with the trace id or correlation id, and pivot between traces, logs, and metrics using exemplars and linked queries.
- **[PATTERN]** Query structured fields, not free text: filter by `service`, `level`, `trace_id`, `tenant_id`, `http.route`, `error.type`, and aggregate (counts by error type, by version, by instance) to see patterns instead of reading individual lines.
- **[PATTERN]** Read traces for the critical path: identify the span that dominates latency or first returns an error, check for fan-out, sequential calls that could be parallel, retries, and time spent waiting for connections or locks.
- **[PATTERN]** Build a timeline: first occurrence of the symptom, deploys and configuration or flag changes, dependency incidents, traffic changes, and autoscaling events; correlation in time narrows hypotheses quickly.
- **[PATTERN]** Find the first failure, not the loudest: cascading failures produce many downstream errors (timeouts, circuit breakers opening); sort by time and follow dependencies upstream to the origin.
- **[PATTERN]** Compare good and bad populations: the same query for successful vs failed requests, old vs new version, affected vs unaffected tenants, to isolate what differs.
- **[FORBIDDEN]** Grepping unstructured logs across all services without a time window, drawing conclusions from a single log line, adding verbose logging to production without volume and privacy review, and logging secrets or personal data while debugging.
- **[PATTERN]** Use the query languages effectively (Loki LogQL, Azure Monitor KQL, Elasticsearch or OpenSearch query DSL and ES|QL, CloudWatch Logs Insights, Splunk SPL) and save useful queries in runbooks.
- **[MANDATORY]** Close observability gaps discovered during an investigation: add missing fields (ids, tenant, version), spans for uninstrumented calls, or metrics, so the next investigation is faster.
- **[TESTING]** Verify the explanation against the data: the proposed cause must account for the observed pattern (who is affected, when it started, and when it stopped), and the fix must make the signal return to normal.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
