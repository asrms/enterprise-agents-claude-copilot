# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. N+1 queries, in-memory counting, interpolated SQL
```ruby
@orders = Order.where("status = '#{params[:status]}'")         # SQL injection, unbounded
```
```erb
<% @orders.each do |order| %>
  <%= order.customer.name %>                                   <%# 1 query per order %>
  <%= order.line_items.to_a.count %> items                     <%# loads all line items %>
<% end %>
```
**Why it's wrong:**
- Input is interpolated into SQL and all matching orders are loaded.
- Each row triggers extra queries and loads collections just to count them.

## Best Practice (How to do it right)

### 1. Preloading, counter cache, strict loading, and pagination
```ruby
# config/environments/development.rb and test.rb
config.active_record.strict_loading_by_default = true

class LineItem < ApplicationRecord
  belongs_to :order, counter_cache: true                        # orders.line_items_count maintained automatically
end

class OrdersController < ApplicationController
  def index
    @pagy, @orders = pagy(
      Order.where(status: params.expect(:status))
           .select(:id, :public_id, :customer_id, :status, :total_cents, :line_items_count, :created_at)
           .includes(:customer)
           .order(created_at: :desc, id: :desc)
    )
  end
end
```
```erb
<% @orders.each do |order| %>
  <%= order.customer.name %> — <%= order.line_items_count %> items
<% end %>
```
### 2. Constraints, concurrent index, and batch processing
```ruby
class AddOrderIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :orders, [:status, :created_at, :id], algorithm: :concurrently
    add_check_constraint :orders, "total_cents >= 0", name: "orders_total_non_negative", validate: false
  end
end

Order.pending.where(created_at: ...7.days.ago).find_each(batch_size: 500) do |order|
  CancelStaleOrderJob.perform_later(order.id)
end

reserved = Product.where(id: product_id).where("stock >= ?", quantity)
                  .update_all(["stock = stock - ?", quantity])         # atomic, returns affected rows
```
**Why it's right:**
- Associations are preloaded, counts come from a counter cache, strict loading catches lazy loads, and lists are paginated.
- Indexes are added without locking writes, constraints protect data, large sets are processed in batches, and stock updates are atomic.
