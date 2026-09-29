# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Fat controller, permit!, and callback side effects
```ruby
class OrdersController < ApplicationController
  def create
    @order = Order.new(params[:order].permit!)              # any attribute, including status and total
    @order.items.each { |i| i.price = Product.find(i.product_id).price }
    if @order.save
      render json: @order                                    # every column exposed
    else
      render json: { error: "failed" }
    end
  end
end

class Order < ApplicationRecord
  after_save :charge_card_and_email                          # external calls on every save, even inside transactions
end
```
**Why it's wrong:**
- Mass assignment of all params, business logic in the controller, and an unfiltered JSON response.
- Side effects hidden in callbacks run on every save, including tests and imports, before the transaction commits.

## Best Practice (How to do it right)

### 1. Thin controller, strong parameters, explicit workflow
```ruby
class OrdersController < ApplicationController
  before_action :authenticate_customer!

  def create
    result = PlaceOrder.new(customer: current_customer, items: order_params[:items]).call
    if result.success?
      render json: OrderSerializer.new(result.order).as_json, status: :created
    else
      render json: { errors: result.errors }, status: :unprocessable_entity
    end
  end

  private

  def order_params
    params.expect(order: [items: [[:sku, :quantity]]])
  end
end

class PlaceOrder
  Result = Data.define(:order, :errors) do
    def success? = errors.empty?
  end

  def initialize(customer:, items:, catalog: PriceCatalog.new)
    @customer, @items, @catalog = customer, items, catalog
  end

  def call
    order = @customer.orders.build(status: :pending)
    @items.each do |item|
      order.line_items.build(sku: item[:sku], quantity: item[:quantity], unit_price: @catalog.price_for(item[:sku]))
    end
    return Result.new(order:, errors: order.errors.full_messages) unless order.save

    OrderConfirmationJob.perform_later(order.id)              # enqueued after the order is committed
    Result.new(order:, errors: [])
  end
end
```
**Why it's right:**
- Only permitted attributes are accepted, prices come from the server, and the workflow is an explicit, testable object.
- Side effects are enqueued deliberately after saving, and the response is serialized with chosen attributes.
