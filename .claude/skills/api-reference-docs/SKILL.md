---
name: api-reference-docs
description: "Producing API reference documentation: generating docs from OpenAPI, AsyncAPI, GraphQL schemas, and Protobuf with Redoc, Scalar, Swagger UI, or similar, complete operation descriptions, authentication guides, request and response examples, error catalogs, pagination and rate limits, SDK and code docs from source comments (Javadoc, KDoc, TSDoc, docstrings), versioned docs, and changelogs. Use it when documenting APIs or libraries for internal or external developers."
---

# Skill: API Reference Documentation

## Implementation Rules:
- **[MANDATORY]** Generate API reference documentation from the contract that is validated in CI (OpenAPI, AsyncAPI, GraphQL schema, Protobuf), not from hand-written pages that drift; publish it with a renderer such as Redoc, Scalar, Swagger UI, or a docs platform.
- **[MANDATORY]** Every operation, parameter, field, and message has a description that explains meaning, units, formats, constraints, and defaults, plus at least one realistic request and response example, including error examples.
- **[PATTERN]** Complement the reference with guides: getting started (first successful call in minutes), authentication and authorization (how to obtain tokens, scopes), core concepts, pagination, idempotency, rate limits, webhooks or events, and versioning and deprecation policy.
- **[MANDATORY]** Document errors as a catalog: each error type or code with HTTP status, meaning, likely causes, and how to resolve it, consistent with the problem details format used by the API.
- **[PATTERN]** Provide copyable code samples in the languages your consumers use (curl plus two or three SDK languages), tested automatically so they stay correct.
- **[PATTERN]** Document libraries and SDKs from source with doc comments (Javadoc, KDoc with Dokka, TSDoc with TypeDoc, Python docstrings with Sphinx or MkDocs plugins, rustdoc, godoc), covering public APIs, parameters, return values, errors, and examples.
- **[PATTERN]** Version the documentation with the API: docs for each supported major version, a changelog with breaking changes and migration guides, and deprecation notices visible on affected operations.
- **[FORBIDDEN]** Descriptions that repeat the field name ("orderId: the order id"), examples with fake-looking or inconsistent data, undocumented error responses, internal-only endpoints or secrets exposed in public docs, and documentation published without review.
- **[SECURITY]** Never include real credentials or personal data in examples, and make sure documentation for internal APIs is access-controlled.
- **[PATTERN]** Make docs discoverable and usable: search, stable deep links per operation, a try-it console against a sandbox environment, and downloadable contracts for code generation.
- **[TESTING]** Lint contracts and doc comments in CI (Spectral rules for descriptions and examples, doc linting), validate examples against schemas, run code samples as tests, and check links.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
