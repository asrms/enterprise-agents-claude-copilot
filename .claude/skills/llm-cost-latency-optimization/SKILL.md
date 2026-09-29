---
name: llm-cost-latency-optimization
description: "Reducing cost and latency of LLM applications without losing quality: per-feature token budgets and cost attribution, model routing and tiering, prompt and context size reduction, provider prompt caching for stable prefixes, batch APIs for offline work, streaming and time to first token, parallel calls, output length control, and evaluation-guarded optimizations. Use it when an LLM feature is too slow or too expensive, or when designing one to scale."
---

# Skill: LLM Cost and Latency Optimization

## Implementation Rules:
- **[MANDATORY]** Measure before optimizing: record input, cached, and output tokens, model, latency (time to first token and total), and cost per request, attributed to feature, tenant, and prompt version; set budgets and alerts per feature.
- **[MANDATORY]** Guard every optimization with the feature's evaluation suite: a cheaper model, shorter prompt, or smaller context is accepted only if quality metrics stay within agreed tolerances.
- **[PATTERN]** Route requests by difficulty: use the smallest model tier that meets the quality bar for simple tasks (classification, extraction, routing) and reserve the most capable tier for complex reasoning; route with rules or a lightweight classifier and escalate on low confidence or validation failure.
- **[PATTERN]** Shrink the context: retrieve and rerank fewer, better chunks, summarize or trim long conversation history within a token budget, remove redundant instructions and examples, and send only the fields a task needs instead of whole records.
- **[PERFORMANCE]** Use provider prompt caching by placing stable content (system prompt, tool definitions, long reference documents) at the start of the request and variable content at the end, marking cache breakpoints where the API requires it, and monitoring the cache hit rate.
- **[PERFORMANCE]** Move non-interactive workloads (bulk classification, enrichment, evaluations) to the provider's batch APIs or scheduled jobs, which trade latency for lower cost and higher throughput limits.
- **[PERFORMANCE]** Improve perceived and real latency: stream responses to the user, run independent calls in parallel, start retrieval while other work proceeds, and keep instances warm; measure time to first token separately from total time.
- **[MANDATORY]** Control output length explicitly with `max_tokens` per use case, concise output formats (structured JSON with only the needed fields), and instructions about length; long outputs dominate latency.
- **[PATTERN]** Cache at the application level only where it is safe: exact-match caching of deterministic requests scoped per tenant; treat semantic caching (similar queries) with care because near-duplicate questions can require different answers, and never share cached responses containing personal data.
- **[FORBIDDEN]** Choosing the largest model by default for every call, unbounded conversation history, disabling safety or validation steps to save tokens, and cost reductions shipped without evaluation.
- **[PATTERN]** Revisit periodically: new model versions and pricing change the optimal routing, so rerun the evaluation-and-cost comparison when providers release models and update configuration rather than code.
- **[TESTING]** Load-test LLM endpoints with realistic prompt sizes to verify latency percentiles, rate-limit headroom, and cost projections, and include cost-per-request checks in the release evaluation report.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
