# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tools disabled instead of fixed
```ruby
# rubocop:disable all
class ReportBuilder
  def build(params)
    eval("Report::#{params[:type]}").new.run          # code injection
  end
end
# rubocop:enable all
```
```yaml
# .rubocop.yml
AllCops:
  Exclude: ["app/**/*"]                               # nothing is checked
```
**Why it's wrong:**
- Static analysis is switched off wholesale, hiding a code injection vulnerability.

## Best Practice (How to do it right)

### 1. Configuration with plugins, todo file, and safe dispatch
`.rubocop.yml`:
```yaml
inherit_from: .rubocop_todo.yml
inherit_gem:
  rubocop-rails-omakase: rubocop.yml
plugins:
  - rubocop-rails
  - rubocop-rspec
  - rubocop-performance
AllCops:
  NewCops: enable
  TargetRubyVersion: 3.4
Metrics/MethodLength:
  Max: 20
```
```ruby
class ReportBuilder
  REPORTS = { "sales" => Reports::Sales, "inventory" => Reports::Inventory }.freeze

  def build(type)
    report_class = REPORTS.fetch(type) { raise ArgumentError, "Unknown report type: #{type}" }
    report_class.new.run
  end
end
```
### 2. Optional typing with Sorbet for a core service
```ruby
# typed: strict
class PlaceOrder
  extend T::Sig

  sig { params(customer: Customer, items: T::Array[OrderItemInput]).returns(PlaceOrder::Result) }
  def call(customer:, items:)
    # ...
  end
end
```
```bash
bundle exec rubocop --parallel
bundle exec srb tc
bundle exec brakeman --no-pager --quiet
bundle exec bundle-audit check --update
```
**Why it's right:**
- Style and plugin cops apply to all code, legacy offenses live in a shrinking todo file, and the injection risk is replaced by an allow-list.
- Core services gain type signatures, and security scanners run alongside linting in CI.
