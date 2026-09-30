# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Everything in one unlabeled diagram
```mermaid
flowchart LR
  A --> B
  B --> C
  B --> D
  C --> E
  D --> E
  E --> F
  F --> A
```
**Why it's wrong:**
- Boxes and arrows have no names, types, or actions; readers cannot tell what the diagram means.
- There is no title, legend, or text description.

## Best Practice (How to do it right)

### 1. Sequence diagram with labeled interactions
```mermaid
sequenceDiagram
  accTitle: Return request flow
  accDescr: The customer app sends a return request to the Returns API, which checks eligibility, stores the request, and publishes an event consumed by the label service.
  autonumber
  participant App as Customer app
  participant API as Returns API
  participant DB as Returns DB (PostgreSQL)
  participant Bus as Event bus (Kafka)
  participant Label as Label service

  App->>API: POST /v1/returns (order item, reason)
  API->>DB: check eligibility and insert return request
  API->>Bus: publish returns.return-requested.v1
  API-->>App: 201 Created (return id, status REQUESTED)
  Bus-->>Label: return-requested event
  Label->>Label: create carrier label and QR code
```
### 2. State diagram for the return lifecycle
```mermaid
stateDiagram-v2
  accTitle: Return lifecycle
  [*] --> Requested
  Requested --> LabelIssued: label created
  LabelIssued --> InTransit: parcel picked up
  InTransit --> Inspected: received at warehouse
  Inspected --> Refunded: item OK
  Inspected --> RefundDecision: item damaged
  RefundDecision --> Refunded: partial refund approved
  RefundDecision --> Rejected: refund denied
  Requested --> Cancelled: customer cancels
  Refunded --> [*]
  Rejected --> [*]
  Cancelled --> [*]
```
```bash
npx -p @mermaid-js/mermaid-cli mmdc -i docs/explanation/returns.md -o build/returns.md   # fails on syntax errors
```
**Why it's right:**
- Each diagram answers one question with named participants, technologies, and labeled actions.
- Accessible titles and descriptions are included, and rendering in CI catches syntax errors.
