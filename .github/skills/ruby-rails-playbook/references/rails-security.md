# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. IDOR, SQL injection, unsafe HTML, open redirect
```ruby
class InvoicesController < ApplicationController
  def show
    @invoice = Invoice.find(params[:id])                                # any user's invoice
  end

  def search
    @invoices = Invoice.where("number LIKE '%#{params[:q]}%'")          # SQL injection
    redirect_to params[:return_to] if params[:return_to]                 # open redirect
  end
end
```
```erb
<div><%= raw @invoice.notes %></div>                                     <%# stored XSS %>
```
**Why it's wrong:**
- Records are fetched without ownership checks, SQL is built from input, and user-controlled URLs are followed.
- Customer-provided content is rendered as raw HTML.

## Best Practice (How to do it right)

### 1. Scoped lookups with Pundit, safe queries, and escaping
```ruby
class InvoicesController < ApplicationController
  after_action :verify_authorized, except: :index
  after_action :verify_policy_scoped, only: :index
  rate_limit to: 30, within: 1.minute, only: :search

  def show
    @invoice = policy_scope(Invoice).find_by!(public_id: params.expect(:id))
    authorize @invoice
  end

  def index
    @invoices = policy_scope(Invoice).order(issued_on: :desc).limit(50)
  end

  def search
    term = Invoice.sanitize_sql_like(params.expect(:q).to_s)
    @invoices = policy_scope(Invoice).where("number LIKE ?", "%#{term}%").limit(50)
    authorize Invoice
  end
end

class InvoicePolicy < ApplicationPolicy
  class Scope < ApplicationPolicy::Scope
    def resolve = scope.where(account_id: user.account_id)
  end

  def show? = record.account_id == user.account_id
  def search? = true
end
```
```erb
<div><%= sanitize @invoice.notes, tags: %w[p br strong em ul li], attributes: [] %></div>
```
```ruby
# config/initializers/filter_parameter_logging.rb
Rails.application.config.filter_parameters += [:passw, :token, :secret, :iban, :national_id, :email]

class Customer < ApplicationRecord
  encrypts :national_id                                   # Active Record encryption at rest
end
```
**Why it's right:**
- Every lookup is scoped and authorized, and Pundit verification ensures no action forgets authorization.
- Queries use placeholders with escaped LIKE patterns, rich text is sanitized with an allow-list, sensitive data is filtered from logs and encrypted at rest, and search is rate limited.
