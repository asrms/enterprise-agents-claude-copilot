# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Commit dump as release notes
```text
Release 3.0.0
- chore(deps): bump lodash from 4.17.20 to 4.17.21
- wip
- fix typo
- refactor(orders): extract mapper
- feat(api)!: remove v1 reports
- ci: cache gradle
```
**Why it's wrong:**
- Readers cannot find what matters; the breaking change is buried among internal noise with no migration guidance.
- No date, no links, and no separation between user-facing and internal changes.

## Best Practice (How to do it right)

### 1. Keep a Changelog structure with curated entries
```markdown
# Changelog

All notable changes to this project are documented in this file.
The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Export orders as CSV from the orders list ([#402](https://github.com/example/shop/pull/402)).

## [3.0.0] - 2026-09-29
### Removed
- **Breaking:** the `GET /v1/reports` endpoint, deprecated since 2.6.0. Use `GET /v2/reports`;
  see the [migration guide](docs/migrations/reports-v2.md) ([#381](https://github.com/example/shop/issues/381)).

### Added
- Cursor pagination for `GET /v2/orders` ([#395](https://github.com/example/shop/pull/395)).

### Changed
- `ORDERS_PAGE_SIZE` now defaults to 50 (was 100). Operators relying on the old default must set it explicitly.

### Fixed
- Totals are rounded half-even for currencies with three decimals ([#398](https://github.com/example/shop/issues/398)).

### Security
- Fixed an authorization check on order exports (GHSA-xxxx-xxxx-xxxx). All 2.x versions are affected; upgrade to 3.0.0 or 2.9.4.

[Unreleased]: https://github.com/example/shop/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/example/shop/compare/v2.9.3...v3.0.0
```
### 2. Store release notes for the same version (end users)
```text
What's new
• Export your order history as a spreadsheet.
• Faster loading of long order lists.
• Fixed rounding of totals in some currencies.
```
**Why it's right:**
- Entries are grouped, linked, dated, and written for readers; the breaking change comes with its replacement and a migration guide.
- Operators see configuration changes, security fixes list affected versions, and end users get a short, benefit-focused summary.
