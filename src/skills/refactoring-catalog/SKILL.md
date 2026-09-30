---
name: refactoring-catalog
description: "Safe, behavior-preserving refactoring: code smells and the matching refactorings (extract, inline, move, replace conditional with polymorphism, introduce parameter object), characterization tests first, small commits, and IDE automated refactorings. Use it when improving existing code structure without changing behavior."
---

# Skill: Refactoring Catalog

## Implementation Rules:
- **[MANDATORY]** Refactoring never changes observable behavior: before touching code, make sure tests cover it; if they do not, write characterization tests that capture the current behavior (including quirks) first, then refactor with the tests green at every step.
- **[FORBIDDEN]** Mixing refactoring and behavior changes in the same commit or PR ("while I was there I also fixed…"): separate them so reviewers can verify that the refactoring commit changes structure only.
- **[PATTERN]** Work in small, reversible steps: each step is one named refactoring, compiles, passes tests, and could be committed on its own; if tests go red, revert the step instead of debugging a large diff.
- **[PATTERN]** Prefer the IDE's automated refactorings (rename, extract method/variable/interface, inline, move, change signature) over manual edits: they update all references, including those in other modules, and are far less error-prone.
- **[PATTERN]** Long function → Extract Function (name the extracted part after what it does, not how); Long parameter list → Introduce Parameter Object; Data clumps (the same 3 fields always together) → Extract Value Object.
- **[PATTERN]** Switch or `if` chains on a type code repeated in several places → Replace Conditional with Polymorphism (strategy, sealed hierarchy, or map of handlers); a single switch in a factory is acceptable.
- **[PATTERN]** Feature envy (a method using another object's data more than its own) → Move Function to that object; Message chains (`a.getB().getC().doX()`) → Hide Delegate.
- **[PATTERN]** Duplicated code with the same reason to change → Extract Function/Module and replace all occurrences; duplicated code with different reasons to change stays duplicated.
- **[PATTERN]** Primitive obsession (strings for emails, doubles for money, ints for status) → Replace Primitive with Value Object or Enum, validating at construction.
- **[PATTERN]** Mutable shared data and temporal coupling → Encapsulate Variable, Replace Setter with constructor/factory, Split Phase (parse → compute → render) so each phase has clear inputs and outputs.
- **[PATTERN]** Large class with several responsibilities → Extract Class along the lines of cohesion (fields used together by the same methods); God services are split by use case, not by technical layer.
- **[PATTERN]** Dead code, speculative generality (unused parameters, abstract classes with one implementation "for the future"), and redundant comments → Remove/Inline; version control keeps the history.
- **[SECURITY]** Refactoring security-relevant code (authentication, authorization checks, validation, crypto, escaping) requires tests for the security behavior first; never drop a check because it "looks redundant" without proving it is enforced elsewhere.
- **[PERFORMANCE]** Structural refactoring must not silently change complexity or I/O patterns: moving a query inside a loop, turning a batch into N calls, or replacing a lazy stream with an eager copy is a behavior change for performance and must be measured.
- **[ARCHITECTURE]** For large-scale restructurings (module boundaries, framework replacement) use Branch by Abstraction or Strangler Fig with feature flags, merging to the main branch frequently instead of keeping a long-lived refactoring branch.
- **[TESTING]** After the refactoring the test suite, type checker, and linter pass unchanged (tests are modified only if they depended on the old internal structure); mutation or coverage reports on the touched code must not get worse.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
