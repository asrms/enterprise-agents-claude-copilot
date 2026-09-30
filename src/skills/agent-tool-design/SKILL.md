---
name: agent-tool-design
description: "Designing LLM agents and their tools: when to use a workflow vs an autonomous agent, clear tool names, descriptions, and JSON schemas, least-privilege tool permissions, validation of tool inputs and outputs, human approval for consequential actions, loop limits and budgets, state and memory, error messages the model can act on, MCP servers, and observability of agent runs. Use it when building or reviewing tool-using LLM agents."
---

# Skill: Agent and Tool Design

## Implementation Rules:
- **[ARCHITECTURE]** Start with the simplest design that works: a single LLM call, then a fixed workflow (prompt chaining, routing, parallelization) where steps are known, and an autonomous agent loop only when the path genuinely depends on intermediate results.
- **[MANDATORY]** Design each tool as a clear, narrow capability with a descriptive name, a description that states when to use it and when not to, and a strict JSON schema (types, enums, formats, required fields, `additionalProperties: false`); prefer a few well-designed tools over many overlapping ones.
- **[MANDATORY]** Validate every tool call server-side against the schema and business rules before execution, and enforce authorization with the end user's permissions (not the agent's), so the model cannot access data or perform actions the user could not.
- **[SECURITY]** Require explicit human confirmation for consequential or irreversible actions (payments, refunds, deletions, sending messages externally, changing permissions), showing the exact parameters; read-only tools can run autonomously.
- **[SECURITY]** Treat tool outputs and retrieved content as untrusted data: they can carry prompt injection; never let them expand the agent's permissions, and keep secrets out of the model context (tools use credentials server-side).
- **[PATTERN]** Return tool results that help the model act: concise, structured, with only relevant fields, pagination for large results, and actionable error messages (what was wrong and how to fix the call) instead of stack traces.
- **[MANDATORY]** Bound every agent run: maximum iterations and tool calls, token and cost budgets, wall-clock timeouts, and detection of repeated identical calls; on limits, stop gracefully and report the state.
- **[PATTERN]** Make tools idempotent where possible (idempotency keys for writes) so retries after timeouts are safe, and design state explicitly: conversation history trimmed or summarized within budget, and durable task state stored outside the model context.
- **[PATTERN]** Expose tools to multiple agents and clients through the Model Context Protocol (MCP) when reuse matters, with authentication, per-tool scopes, and the same validation and approval rules.
- **[FORBIDDEN]** Generic tools such as `run_sql`, `execute_shell`, or `http_request` with unrestricted arguments in production agents, tools that act with administrator credentials on behalf of any user, and unbounded loops without iteration or cost limits.
- **[PATTERN]** Trace every run (model calls, tool calls with arguments and results, approvals, errors, tokens, latency) with correlation ids, redacting personal data, so behavior can be debugged and evaluated.
- **[TESTING]** Test tools as ordinary code (unit tests for validation and authorization), and evaluate the agent end to end on scenario suites in a sandbox, including adversarial inputs and tool failures, measuring task success, steps, and cost.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
