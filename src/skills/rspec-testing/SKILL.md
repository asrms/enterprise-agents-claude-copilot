---
name: rspec-testing
description: "Testing Rails applications with RSpec (or Minitest): model, request, and system specs, FactoryBot factories and traits, readable specs with let and described behavior, shared examples used sparingly, stubbing external HTTP with WebMock or VCR, time helpers, database cleaning with transactional fixtures, Capybara system tests with Hotwire, parallel test runs, and coverage with SimpleCov. Use it when writing or reviewing tests for Ruby and Rails code."
---

# Skill: RSpec Testing

## Implementation Rules:
- **[ARCHITECTURE]** Test at the right level: model and plain Ruby object specs for domain logic, request specs for controllers and APIs (prefer them over controller specs), job and mailer specs, and a small set of system specs (Capybara) for critical user journeys.
- **[PATTERN]** Write specs that read as behavior: `describe` the class or method, `context` for conditions ("when the order is shipped"), `it` for outcomes, one behavior per example, with clear expectations (`expect(...).to eq`, `change { }`, `have_http_status`).
- **[PATTERN]** Build data with FactoryBot: minimal valid factories, traits for variations (`create(:order, :paid)`), `build` or `build_stubbed` when persistence is not needed, and explicit attributes that matter to the test.
- **[MANDATORY]** Isolate external systems: WebMock with `WebMock.disable_net_connect!(allow_localhost: true)` to block real HTTP, stubs or fakes for API clients, VCR cassettes only with filtered secrets and periodic re-recording, and `ActionMailer::Base.deliveries` or mailer matchers for emails.
- **[MANDATORY]** Control time with `ActiveSupport::Testing::TimeHelpers` (`travel_to`, `freeze_time`) and avoid depending on the current date or randomness without seeds.
- **[PATTERN]** Keep setup readable: `let` for lazily evaluated values, `let!` only when records must exist before the example, `before` for shared context, and shared examples or contexts only for genuinely repeated behavior.
- **[FORBIDDEN]** Mocking the object under test, `allow_any_instance_of` as a habit, tests that depend on execution order or data from other tests, `sleep` in system specs (use Capybara's waiting matchers), and assertions on internal implementation instead of behavior.
- **[PATTERN]** Use transactional tests (`use_transactional_fixtures = true`) for speed, and run system tests with a headless browser (Selenium with headless Chrome or Cuprite) against the same database engine as production.
- **[PERFORMANCE]** Keep the suite fast: parallel test execution (`parallel_tests` or Rails' built-in parallelization for Minitest), `build_stubbed` where possible, profiling slow examples with `--profile`, and limiting system specs to critical paths.
- **[PATTERN]** Test authorization and validation explicitly in request specs: unauthenticated access, other users' resources, invalid parameters, and error response formats.
- **[TESTING]** CI runs RSpec with random order (`--order random` with the seed printed), SimpleCov coverage thresholds on changed code, and fails on pending specs that are not linked to issues.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
