---
name: requirements-traceability
description: "Lightweight, automated requirements traceability: unique requirement identifiers, links from business goals to epics, stories, acceptance criteria, code changes, tests, and releases, traceability in issue trackers and pull requests, test tagging and coverage reports, change impact analysis, and audit evidence for regulated environments. Use it when you need to prove what was built and tested for each requirement or assess the impact of a change."
---

# Skill: Requirements Traceability

## Implementation Rules:
- **[MANDATORY]** Give every requirement, epic, and story a stable unique identifier in the issue tracker (for example `RET-12`, `NFR-03`), and never reuse identifiers for different requirements.
- **[MANDATORY]** Maintain links in both directions: goal or regulation to epic, epic to stories, story to acceptance criteria, story to pull requests and commits (identifier in the branch name, pull request title, or commit footer), and acceptance criteria to automated tests.
- **[PATTERN]** Tag automated tests with the requirement identifiers they verify (Cucumber tags such as `@RET-12`, JUnit `@Tag`, pytest markers, test names), so reports can show which requirements are covered and passing.
- **[PATTERN]** Generate traceability reports automatically from tools (issue tracker queries, CI test reports, release notes) rather than maintaining spreadsheets by hand; the report shows each requirement with its status, tests, results, and release.
- **[PATTERN]** Scale rigor to risk: lightweight links are enough for most products; regulated domains (medical devices, finance, automotive, public sector) need formal matrices, reviews, and signed approvals matching their standards (for example IEC 62304, ISO 26262, or SOX controls).
- **[MANDATORY]** Record changes to requirements with who, when, and why (tracker history, versioned documents, or pull requests on requirement files), and re-run impact analysis when a requirement changes.
- **[PATTERN]** Use traceability for impact analysis: before changing a component or requirement, find linked stories, tests, and releases to scope regression testing and communication.
- **[FORBIDDEN]** Hand-maintained matrices that drift from reality, links added after the fact only for audits, requirements without verification method, and tests that claim coverage of requirements they do not actually check.
- **[PATTERN]** Include non-functional requirements in traceability, linking them to performance tests, security tests, SLOs, and audit procedures.
- **[SECURITY]** Protect the integrity of audit evidence: CI results and approvals are stored immutably with timestamps, and access to modify requirements in regulated contexts is controlled.
- **[TESTING]** Check traceability automatically in CI or reporting: stories in a release without linked tests, tests referencing unknown identifiers, and requirements without passing tests before release are flagged.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
