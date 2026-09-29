---
name: ruby-static-analysis
description: "Code quality and type safety for Ruby and Rails: RuboCop with rubocop-rails, rubocop-rspec, and rubocop-performance, a shared style configuration, optional gradual typing with Sorbet or RBS and Steep, Brakeman for security, Reek and complexity metrics, frozen string literals, keeping up with Ruby and Rails versions, and running checks in CI and editors. Use it when improving code quality tooling or reviewing Ruby code for maintainability."
---

# Skill: Ruby Static Analysis

## Implementation Rules:
- **[MANDATORY]** Run RuboCop in CI and in editors with a committed configuration (`.rubocop.yml`) that inherits a shared style (for example `rubocop-rails-omakase` or a team base) and enables the relevant plugins: rubocop-rails, rubocop-rspec, rubocop-performance.
- **[PATTERN]** Adopt RuboCop on existing code with `--auto-gen-config` to create a `.rubocop_todo.yml`, then reduce it over time; new code must pass without new offenses.
- **[PATTERN]** Use safe autocorrect (`rubocop -a`) routinely and unsafe autocorrect (`-A`) only with review, in separate commits from behavior changes.
- **[PATTERN]** Add gradual typing where it pays off: Sorbet (`# typed: strict` in core domain files, Tapioca for RBI generation) or RBS signatures with Steep, starting with public interfaces of core libraries and services.
- **[MANDATORY]** Run Brakeman for Rails security analysis and `bundler-audit` for vulnerable gems in CI, failing on new high-confidence findings.
- **[PATTERN]** Monitor complexity and code smells with RuboCop metrics cops (method length, ABC size, cyclomatic complexity) tuned to the team, and optionally Reek or Flog for hotspots; focus refactoring on frequently changed, complex files.
- **[PATTERN]** Keep the platform current: supported Ruby version pinned in `.ruby-version` and `Gemfile`, YJIT enabled in production where beneficial, Rails upgrades performed regularly with deprecation warnings treated as errors in test (`config.active_support.deprecation = :raise`).
- **[FORBIDDEN]** Disabling cops inline without a justification comment, growing the todo file, monkey-patching core classes in application code, and `eval` or `send` with user input.
- **[PATTERN]** Use frozen string literal comments (or the Ruby default when applicable) and prefer immutable value objects (`Data.define`) for structured values.
- **[PATTERN]** Keep the Gemfile healthy: pinned major versions with pessimistic constraints (`~>`), `Gemfile.lock` committed for applications, unused gems removed, and automated updates with Dependabot or Renovate.
- **[TESTING]** CI runs, in order: `bundle exec rubocop`, type checks (`srb tc` or `steep check`) if adopted, `brakeman --no-pager`, `bundle audit check --update`, and the test suite; failures block merges.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
