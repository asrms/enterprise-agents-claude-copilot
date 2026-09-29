---
name: bug-reproduction
description: "Reproducing bugs reliably before fixing them: collecting context from reports, logs, and traces, building minimal reproducible examples, reproducing environment differences with containers, capturing and replaying data or requests safely, handling intermittent bugs with repetition and stress, turning reproductions into failing automated tests, and writing good bug reports. Use it when a defect is reported or a failure cannot yet be reproduced."
---

# Skill: Bug Reproduction

## Implementation Rules:
- **[MANDATORY]** Reproduce before fixing: a bug is understood only when you can trigger it on demand (or with a known probability for intermittent issues); fixing without reproduction is guessing.
- **[PATTERN]** Collect context first: exact steps, inputs, user role and tenant, timestamps, versions (app, OS, browser, dependencies), environment and feature flag states, request or trace ids, and relevant logs; ask reporters for missing details with specific questions.
- **[PATTERN]** Recreate the environment faithfully: the same version (check out the deployed commit or tag), configuration, and data shape; use containers (Docker Compose, Testcontainers) to match database versions and dependencies, and the same browser or device for UI bugs.
- **[MANDATORY]** Reduce to a minimal reproducible example: remove unrelated code, data, and steps until only what is required to trigger the bug remains; the minimal case often reveals the cause.
- **[SECURITY]** Use production data only when necessary and permitted, anonymized or minimized, in controlled environments; never copy personal data to developer machines or share it in tickets.
- **[PATTERN]** For intermittent bugs, increase the probability: run the scenario many times in a loop, add load or parallelism, randomize ordering (test shuffling), inject latency or faults, and record seeds and timing so a failing run can be replayed.
- **[PATTERN]** Replay real inputs safely: captured requests (with secrets removed), message payloads from dead-letter queues, or recorded sessions, against a non-production environment.
- **[MANDATORY]** Turn the reproduction into a failing automated test at the lowest practical level (unit, integration, or end-to-end) before writing the fix, and keep it as a regression test.
- **[FORBIDDEN]** Debugging directly in production with code changes, closing reports as "works on my machine" without checking environment differences, and attaching secrets or personal data to bug reports.
- **[PATTERN]** Write bug reports that others can act on: title with the symptom and scope, steps to reproduce, expected and actual results, environment and version, evidence (logs, screenshots, trace ids), frequency, and impact.
- **[TESTING]** Confirm the reproduction fails for the right reason (the same error and stack as reported), and after the fix run it repeatedly for intermittent issues to make sure it no longer fails.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
