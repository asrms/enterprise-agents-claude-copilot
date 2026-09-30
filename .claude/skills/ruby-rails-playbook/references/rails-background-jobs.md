# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Heavy arguments, no idempotency, no retry policy
```ruby
class SyncInvoiceJob < ApplicationJob
  def perform(invoice_hash, api_token)                       # stale data snapshot and a secret in job storage
    AccountingApi.create_invoice(invoice_hash, token: api_token)   # duplicates on every retry
  end
end

SyncInvoiceJob.perform_later(invoice.attributes, ENV["ACCOUNTING_TOKEN"])
```
**Why it's wrong:**
- The job stores a stale copy of the data and a secret in the queue backend.
- Retries create duplicate invoices, and there is no policy for transient versus permanent failures.

## Best Practice (How to do it right)

### 1. Idempotent job with explicit retry and discard policies
```ruby
class SyncInvoiceJob < ApplicationJob
  queue_as :integrations
  limits_concurrency to: 1, key: ->(invoice_id) { "invoice-#{invoice_id}" }      # Solid Queue concurrency control

  retry_on AccountingApi::RateLimited, AccountingApi::Timeout, wait: :polynomially_longer, attempts: 8
  discard_on ActiveRecord::RecordNotFound
  discard_on AccountingApi::InvalidInvoice do |job, error|
    Rails.error.report(error, context: { invoice_id: job.arguments.first })
  end

  def perform(invoice_id)
    invoice = Invoice.find(invoice_id)
    return if invoice.accounting_reference.present?                            # already synced: idempotent

    reference = AccountingApi.client.create_invoice(
      InvoicePayload.from(invoice),
      idempotency_key: "invoice-#{invoice.id}",
    )
    invoice.update!(accounting_reference: reference)
  end
end

Invoice.transaction do
  invoice.finalize!
end
SyncInvoiceJob.perform_later(invoice.id)          # enqueued only after the transaction has committed
```
`config/recurring.yml`:
```yaml
production:
  retry_unsynced_invoices:
    class: RetryUnsyncedInvoicesJob
    queue: integrations
    schedule: every 15 minutes
```
**Why it's right:**
- The job receives an id, reads fresh data, uses a credential from configuration inside the client, and is safe to run repeatedly.
- Transient errors retry with backoff, permanent errors are discarded and reported, and concurrency and recurring tasks are declared in configuration.
