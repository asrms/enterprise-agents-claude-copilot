---
name: php-static-analysis
description: "Modern, type-safe PHP 8.3+ with static analysis and code quality tooling: strict types, native types and enums, readonly classes, generics in PHPDoc, PHPStan or Larastan at a high level with a baseline, Psalm as an alternative, Rector for automated upgrades and refactoring, PHP-CS-Fixer or Laravel Pint for style, Composer hygiene, and CI integration. Use it when improving code quality or type safety of PHP projects."
---

# Skill: PHP Static Analysis and Modern PHP

## Implementation Rules:
- **[MANDATORY]** Use a supported PHP version (8.3 or newer), declare `declare(strict_types=1);` in every file, and type every parameter, return value, and property with native types (union, intersection, nullable, `never`, `void`) where possible.
- **[MANDATORY]** Run PHPStan (Larastan for Laravel) or Psalm in CI at a high level (PHPStan level 8 or higher for new code, `max` where achievable); introduce it on legacy code with a baseline file and reduce the baseline over time rather than lowering the level.
- **[PATTERN]** Express what native types cannot with PHPDoc generics and shapes (`@param list<OrderLine> $lines`, `@return array{id: int, status: OrderStatus}`, `@template T`), and keep PHPDoc consistent with native types.
- **[PATTERN]** Model fixed sets of values with backed enums, immutable values with `readonly` classes and properties, and domain concepts with small value objects instead of associative arrays.
- **[PATTERN]** Automate upgrades and refactorings with Rector (PHP version sets, framework sets such as Laravel or Symfony, dead code and type declaration rules), reviewing changes in separate pull requests.
- **[MANDATORY]** Enforce a consistent code style automatically with PHP-CS-Fixer (PER Coding Style) or Laravel Pint, run in CI in check mode and in pre-commit hooks.
- **[PATTERN]** Keep Composer healthy: commit `composer.lock`, constrain versions with caret ranges, use `composer validate --strict` and `composer audit`, enable `platform` config to match the production PHP version, and autoload with PSR-4.
- **[FORBIDDEN]** `mixed` or missing types in new code without justification, suppressing analyzer errors inline without a comment explaining why, growing the baseline, `@` error suppression operator, and dynamic properties (deprecated since PHP 8.2).
- **[SECURITY]** Enable security-focused analysis (Psalm taint analysis or PHPStan extensions for security, plus Semgrep PHP rules) for code handling untrusted input.
- **[PERFORMANCE]** Enable OPcache and JIT settings appropriate for production, and preload frequently used classes where the framework supports it; measure with profiling rather than assumptions.
- **[TESTING]** CI runs, in order: `composer validate`, style check, static analysis, and tests; failures block merges, and analyzer and Rector configurations are versioned.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
