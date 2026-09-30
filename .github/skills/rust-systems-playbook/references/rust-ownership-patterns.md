# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Clones, index loops, and stringly typed state
```rust
fn total_for_customer(orders: Vec<Order>, customer: String) -> f64 {   // takes ownership needlessly
    let mut total = 0.0;
    for i in 0..orders.len() {
        let o = orders[i].clone();                                        // clone per element
        if o.customer == customer.clone() && o.status == "PAID" {        // string status, extra clone
            total += o.amount;                                            // f64 money
        }
    }
    total
}
```
**Why it's wrong:**
- Ownership is taken and values are cloned for no reason; the manual index loop is noisy.
- Status is a string and money is a float, so invalid states and rounding errors are possible.

## Best Practice (How to do it right)

### 1. Borrowed inputs, iterators, newtypes, and enums
```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CustomerId(String);

impl CustomerId {
    pub fn parse(raw: &str) -> Result<Self, InvalidId> {
        let valid = raw.len() <= 36 && raw.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
        valid.then(|| Self(raw.to_owned())).ok_or(InvalidId)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus { Pending, Paid, Cancelled }

pub struct Order { pub customer: CustomerId, pub status: OrderStatus, pub amount_cents: i64 }

pub fn total_paid_cents(orders: &[Order], customer: &CustomerId) -> i64 {
    orders
        .iter()
        .filter(|o| &o.customer == customer && o.status == OrderStatus::Paid)
        .map(|o| o.amount_cents)
        .sum()
}
```
### 2. Typestate: an invoice can only be sent after it is finalized
```rust
pub struct Draft;
pub struct Finalized;

pub struct Invoice<State> { lines: Vec<Line>, _state: std::marker::PhantomData<State> }

impl Invoice<Draft> {
    pub fn add_line(mut self, line: Line) -> Self { self.lines.push(line); self }
    pub fn finalize(self) -> Invoice<Finalized> { Invoice { lines: self.lines, _state: std::marker::PhantomData } }
}

impl Invoice<Finalized> {
    pub fn send(&self, mailer: &impl Mailer) -> Result<(), SendError> { mailer.send(&self.lines) }
}
// Invoice<Draft>::send does not exist: sending a draft is a compile error
```
**Why it's right:**
- The function borrows its inputs, uses an iterator chain without clones, and works in integer cents.
- Identifiers validate on construction, states are enums, and the typestate makes invalid transitions impossible to compile.
