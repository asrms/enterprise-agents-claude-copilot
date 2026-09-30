---
name: aws-serverless-lambda
description: "Serverless architectures on AWS: Lambda function design (handler structure, cold starts, memory sizing, SnapStart, provisioned concurrency), event sources and partial batch failures, idempotency with Powertools, API Gateway and function URLs, Step Functions for orchestration, EventBridge, SQS and DLQs, concurrency limits, least-privilege execution roles, observability, and infrastructure as code with SAM, CDK, or Terraform. Use it when designing or reviewing AWS serverless applications."
---

# Skill: AWS Serverless and Lambda

## Implementation Rules:
- **[ARCHITECTURE]** Use Lambda for event-driven, bursty, or short-running work (up to the 15-minute limit); orchestrate multi-step processes with Step Functions (Standard for long-running and auditable, Express for high-volume short flows) instead of chaining functions directly.
- **[MANDATORY]** Keep handlers thin: initialize SDK clients, configuration, and connections outside the handler for reuse across invocations, and put business logic in plain modules that can be unit-tested without Lambda.
- **[MANDATORY]** Every function has its own least-privilege execution role scoped to the specific resources it uses (table ARNs, queue ARNs, secret ARNs), never shared broad roles.
- **[MANDATORY]** Make event processing idempotent (Powertools for AWS Lambda idempotency utility with a DynamoDB persistence layer, or conditional writes), because asynchronous invocations, SQS, and EventBridge deliver at least once.
- **[PATTERN]** For SQS, Kinesis, and DynamoDB Streams sources, enable partial batch responses (`ReportBatchItemFailures`) so only failed records are retried, configure DLQs or on-failure destinations, set `maximumRetryAttempts`/`maxReceiveCount`, and align the queue visibility timeout with at least six times the function timeout.
- **[PERFORMANCE]** Tune cold starts and cost: right-size memory with measurement (AWS Lambda Power Tuning), prefer arm64 (Graviton) where dependencies allow, keep deployment packages small, use SnapStart for supported runtimes (Java, Python, .NET) and provisioned concurrency only for latency-critical paths.
- **[PATTERN]** Protect downstream systems with reserved concurrency limits and SQS buffering, and use RDS Proxy for relational databases so bursts of functions do not exhaust connections.
- **[SECURITY]** Retrieve secrets at runtime from Secrets Manager or Parameter Store (with caching via the Parameters and Secrets Lambda extension or Powertools), never in plaintext environment variables; enable function URL or API Gateway authentication (IAM, Cognito or JWT authorizers).
- **[FORBIDDEN]** Recursive invocation patterns without guards, functions calling other functions synchronously as a workflow, unbounded timeouts set to the maximum by default, and storing state in the execution environment between invocations beyond caches.
- **[PATTERN]** Instrument with Powertools (structured logging with correlation ids, metrics in Embedded Metric Format, tracing with X-Ray or OpenTelemetry), and alarm on errors, throttles, iterator age, DLQ depth, and duration near timeout.
- **[PATTERN]** Define all serverless resources as code (AWS SAM, CDK, or Terraform) with separate stages or accounts per environment, versions and aliases, and gradual deployments (CodeDeploy canary or linear) for production.
- **[TESTING]** Unit-test business logic locally, test handlers with sample events, and run integration tests against deployed resources in an ephemeral stage; include failure paths (poison messages, throttling, partial batch failures).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
