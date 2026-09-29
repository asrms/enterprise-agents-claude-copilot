---
name: model-serving
description: "Serving machine learning models in production: choosing batch, online, streaming, or edge inference, packaging models with signatures, serving frameworks (FastAPI, BentoML, KServe, Triton, TorchServe, vLLM for LLMs, managed endpoints), latency and throughput optimization, input validation, shadow and canary deployments, versioning, and autoscaling. Use it when deploying or reviewing model inference services."
---

# Skill: Model Serving

## Implementation Rules:
- **[ARCHITECTURE]** Choose the inference mode from the use case: batch scoring (scheduled, cheapest, predictions stored in tables) when decisions can wait; online synchronous endpoints for request-time decisions; streaming inference for event-driven scoring; edge/on-device when latency, privacy, or connectivity require it.
- **[MANDATORY]** Serve models loaded from the model registry by version or alias, packaged with their preprocessing and a declared input/output signature; the service reports the model name and version in responses, logs, and metrics.
- **[MANDATORY]** Validate every request against the model signature (types, ranges, required fields, maximum batch and payload size) and return clear 4xx errors for invalid input; never let malformed input reach the model.
- **[PATTERN]** Use a serving stack appropriate to the model: FastAPI or BentoML for lightweight Python models, KServe or Seldon on Kubernetes, NVIDIA Triton for multi-framework GPU serving with dynamic batching, vLLM or TGI for large language models, or managed endpoints (SageMaker, Vertex AI, Azure ML).
- **[PERFORMANCE]** Meet latency budgets: load the model once at startup (not per request), warm it up before readiness, use dynamic batching on GPUs, optimize models (ONNX Runtime, TensorRT, quantization) with measured accuracy impact, and set timeouts on feature lookups.
- **[PATTERN]** Roll out new model versions with shadow deployments (compare predictions without affecting users), then canary or A/B traffic splits with automated rollback on error rates, latency, or business guardrail metrics.
- **[PATTERN]** Scale on the right signal: request concurrency, queue depth, or GPU utilization rather than CPU alone; set minimum replicas for latency-sensitive endpoints and scale to zero only where cold starts are acceptable.
- **[FORBIDDEN]** Loading pickled models from untrusted sources (pickle executes code; prefer safetensors, ONNX, or signed artifacts), retraining or mutating models inside the serving process, unbounded request payloads, and serving without a fallback when the model or feature store is unavailable.
- **[SECURITY]** Protect endpoints with authentication and authorization, rate limiting, and TLS; avoid returning internal scores or features that leak sensitive information, and log predictions without raw personal data.
- **[PATTERN]** Log inputs (or their hashes and derived features), predictions, model version, and latency for every request to enable monitoring, debugging, and later label joining, respecting retention and privacy rules.
- **[TESTING]** Test the service with contract tests on the API schema, golden input/output examples that must match the registered model, load tests against the latency SLO (p95/p99), and a post-deployment smoke test.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
