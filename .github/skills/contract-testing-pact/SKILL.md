---
name: contract-testing-pact
description: "Consumer-driven contract testing between services with Pact: consumer tests generating pacts, provider verification with provider states, Pact Broker/PactFlow, can-i-deploy and record-deployment in CI, matchers instead of exact values, and message (event) contracts. Use it when services or frontends integrate through HTTP APIs or messages."
---

# Skill: Contract Testing with Pact

## Implementation Rules:
- **[ARCHITECTURE]** Use consumer-driven contracts to verify that each consumer (frontend, mobile app, service) and provider agree on the parts of the API the consumer actually uses; contract tests replace most cross-service end-to-end tests for compatibility, not functional testing of the provider.
- **[MANDATORY]** The consumer test runs against the Pact mock server and exercises the real consumer client code (HTTP client, deserialization), not a hand-written request; it generates the pact file only when the client code works against the expectations.
- **[PATTERN]** Specify only what the consumer needs: fields it reads, status codes it handles, headers it relies on; extra fields returned by the provider must not break the contract (Postel's law on the consumer side).
- **[MANDATORY]** Use matchers instead of exact values for data that varies (`like`, `eachLike`/`atLeastOneLike`, `regex`, `integer`, `decimal`, `datetime` with format, `uuid`), keeping exact values only where the consumer logic depends on them (enum values, error codes).
- **[PATTERN]** Name interactions and provider states from the business point of view: `given("order 42 exists and is shipped")`, `uponReceiving("a request for a shipped order")`; the provider implements a state handler for each state that seeds exactly the needed data.
- **[MANDATORY]** Provider verification runs in the provider's CI against the real application (started in-process or as a container) with only its outbound dependencies stubbed; pacts are fetched from the Pact Broker by consumer version selectors (e.g. `mainBranch`, `deployedOrReleased`, `matchingBranch`).
- **[CONFIGURATION]** Publish pacts and verification results to a Pact Broker/PactFlow with the application version equal to the git commit SHA and the branch name (`pact-broker publish ... --consumer-app-version $GIT_SHA --branch $BRANCH`); verification results are published only from CI.
- **[MANDATORY]** Gate every deployment with `pact-broker can-i-deploy --pacticipant <app> --version $GIT_SHA --to-environment <env>` and record it after success with `pact-broker record-deployment`; a failing `can-i-deploy` blocks the pipeline.
- **[PATTERN]** Enable pending pacts and WIP pacts on the provider so a new consumer expectation does not break the provider build before the provider has implemented it, while still giving feedback.
- **[PATTERN]** Message contracts: for asynchronous integration (Kafka, RabbitMQ, SNS/SQS) use Pact message pacts, where the consumer declares the message it can handle and the provider verifies that its producer code creates a matching message.
- **[FORBIDDEN]** Using contract tests to test provider business logic (all validation cases, every error path) or replacing them with shared schema files alone: an OpenAPI schema says what is possible, a pact says what is actually used.
- **[FORBIDDEN]** Exact-value assertions on generated data (timestamps, ids, totals computed from seeded data), pacts committed and exchanged manually between repositories, and verification against a shared deployed environment.
- **[PATTERN]** Bi-directional contract testing (PactFlow) is acceptable when the provider cannot run Pact verification: the provider publishes its OpenAPI specification verified by its own tests, and the broker compares it with consumer pacts.
- **[SECURITY]** Authentication in provider verification uses a request filter that injects a valid test token, instead of disabling security in the provider; pacts never contain real credentials or personal data.
- **[TESTING]** Contract breakage is part of API evolution: removing a field or changing a type is allowed only when `can-i-deploy` shows that no deployed consumer version depends on it.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
