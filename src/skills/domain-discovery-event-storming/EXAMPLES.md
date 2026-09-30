# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Technical modeling without the business
```text
Workshop "returns" (4 backend developers, no domain experts):
- tables: returns, return_items, refunds
- events: ReturnRowCreated, RefundApiCalled, StatusUpdated
- outcome: ER diagram; nobody knows who approves damaged-item refunds or when money is released
```
**Why it's wrong:**
- Without domain experts the team models its assumptions, and technical events hide the business process.
- Key rules and responsibilities remain unknown and surface as defects later.

## Best Practice (How to do it right)

### 1. Cleaned-up event timeline with hotspots
```text
Actor: Customer        Command: Request Return         Event: Return Requested
Policy: whenever Return Requested -> Generate Return Label  -> Event: Return Label Issued
External: Carrier      Event: Parcel Picked Up -> Parcel Delivered To Warehouse
Actor: Warehouse Clerk Command: Inspect Item           Event: Item Inspected (condition: new | damaged)
Policy: whenever Item Inspected (new) -> Issue Refund   -> Event: Refund Issued
Policy: whenever Item Inspected (damaged) -> Request Refund Decision
Actor: Customer Care   Command: Decide Refund          Event: Partial Refund Approved | Refund Denied
Read model: Return eligibility (delivery date, final-sale flag, previous returns)

HOTSPOT 1: Who pays return shipping for marketplace sellers? (owner: product, due next week)
HOTSPOT 2: Refund timing differs by payment method; card refunds take up to 10 days (owner: finance)
HOTSPOT 3: Warehouse has no system today; inspections are on paper (owner: operations)
```
### 2. Glossary excerpt
```text
Return request   A customer's request to send back one or more items of a delivered order.
Inspection       Warehouse check of a returned item's condition; results: new, damaged, missing.
Refund           Money returned to the original payment method; may be partial after inspection.
Customer (Sales) Person who placed the order.  Customer (Billing): legal entity invoiced. -> use "buyer" and "account".
```
**Why it's right:**
- Events are business facts in the past tense, with actors, commands, policies, read models, and external systems made explicit.
- Open questions are hotspots with owners, and the glossary resolves ambiguous terms before they reach code.
