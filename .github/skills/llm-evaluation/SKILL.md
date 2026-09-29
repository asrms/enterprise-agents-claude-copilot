---
name: llm-evaluation
description: "Evaluating LLM applications: building versioned evaluation datasets from real traffic and edge cases, code-based checks, LLM-as-judge with rubrics and calibration against human labels, RAG metrics (retrieval recall, groundedness, citation accuracy), agent task success, safety and injection test suites, regression gates in CI, and online evaluation with feedback. Use it when changing prompts, models, retrieval, or tools of an LLM application."
---

# Skill: LLM Evaluation

## Implementation Rules:
- **[MANDATORY]** Every LLM feature has a versioned evaluation dataset (inputs, context, expected properties or reference answers) built from real, anonymized traffic, domain experts' examples, and known failure cases; it grows with every production bug.
- **[MANDATORY]** Changes to prompts, models, temperature, retrieval, or tools are evaluated against the dataset before release and compared with the current production configuration on the same cases; no prompt or model change ships on anecdotal testing.
- **[PATTERN]** Prefer deterministic, code-based checks where possible: schema validity of structured outputs, required fields, exact or normalized matches, regex or keyword constraints, citation format, length limits, and tool-call correctness.
- **[PATTERN]** Use LLM-as-judge for qualities that need judgment (helpfulness, groundedness, tone) with explicit rubrics, binary or small-scale scores, pairwise comparisons where useful, and a judge model independent of the one being evaluated where possible; calibrate the judge against human labels and monitor agreement.
- **[PATTERN]** For RAG, measure retrieval and generation separately: retrieval recall@k and MRR on labeled relevant chunks, and groundedness/faithfulness, answer relevance, citation correctness, and correct abstention when sources lack the answer.
- **[PATTERN]** For agents, measure task success on realistic end-to-end scenarios, number of steps and tool calls, invalid tool calls, cost, and latency, using sandboxed tools and deterministic fixtures.
- **[SECURITY]** Maintain adversarial suites: prompt injection (direct and via retrieved documents or tool outputs), jailbreak attempts, data exfiltration requests, personal data leakage, and harmful content categories relevant to the product; failures block release.
- **[FORBIDDEN]** Evaluating on the handful of examples used to write the prompt, averaging away critical failures (report per-category and worst-case results), using the production model as its own only judge without calibration, and storing evaluation data containing unredacted personal data.
- **[PERFORMANCE]** Account for non-determinism: run multiple samples for stochastic settings, report variance, fix seeds or temperature where the provider supports it, and cache model outputs for unchanged cases to control evaluation cost.
- **[PATTERN]** Track results over time in an evaluation tool or experiment tracker (dataset version, prompt version, model id, scores per metric and category), and link each release to its evaluation run.
- **[TESTING]** Run a fast evaluation subset in CI on every prompt or configuration change with pass thresholds, the full suite before release, and online evaluation in production (sampled judge scoring, user feedback, escalation rates) with alerts on regressions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
