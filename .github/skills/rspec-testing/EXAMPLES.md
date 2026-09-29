# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Order-dependent, over-mocked specs with real HTTP
```ruby
describe OrdersController, type: :controller do
  it "works" do
    allow_any_instance_of(Order).to receive(:save).and_return(true)   # mocks the thing being tested
    post :create, params: { order: { sku: "A" } }
    expect(assigns(:order)).to be_present                              # implementation detail
  end

  it "charges the card" do
    Order.last.charge!                                                 # depends on the previous example
    sleep 2                                                            # waits for a real payment API call
  end
end
```
**Why it's wrong:**
- The spec mocks the behavior it should verify and asserts on instance variables instead of responses.
- Examples depend on each other, and real HTTP calls with sleeps make the suite slow and flaky.

## Best Practice (How to do it right)

### 1. Request spec with factories, WebMock, and explicit contexts
```ruby
RSpec.describe "Orders API", type: :request do
  let(:customer) { create(:customer) }
  let(:headers) { auth_headers_for(customer) }
  let!(:product) { create(:product, sku: "TRAIL-42", price_cents: 12_990) }

  before do
    stub_request(:post, "https://payments.example.com/v1/charges")
      .to_return(status: 201, body: { id: "ch_1" }.to_json, headers: { "Content-Type" => "application/json" })
  end

  describe "POST /api/orders" do
    context "with valid items" do
      it "creates a pending order and enqueues the confirmation" do
        expect {
          post "/api/orders", params: { order: { items: [{ sku: "TRAIL-42", quantity: 2 }] } }, headers:, as: :json
        }.to change(customer.orders, :count).by(1)
          .and have_enqueued_job(OrderConfirmationJob)

        expect(response).to have_http_status(:created)
        expect(response.parsed_body.dig("data", "total_cents")).to eq(25_980)
      end
    end

    context "with an unknown sku" do
      it "returns validation errors" do
        post "/api/orders", params: { order: { items: [{ sku: "NOPE", quantity: 1 }] } }, headers:, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "when requesting another customer's order" do
      it "returns not found" do
        other_order = create(:order)
        get "/api/orders/#{other_order.public_id}", headers:, as: :json
        expect(response).to have_http_status(:not_found)
      end
    end
  end
end
```
**Why it's right:**
- Each example sets up its own data, blocks real HTTP with explicit stubs, and asserts on responses, persistence, and enqueued jobs.
- Contexts describe conditions clearly, and authorization is covered.
