# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Copy-pasted tests, sleeps, and string error checks
```go
func TestDiscount1(t *testing.T) {
    if Discount(100, "GOLD") != 90 {
        t.Fatal("wrong")
    }
}

func TestDiscount2(t *testing.T) {
    _, err := Parse("")
    if err.Error() != "empty input" {             // panics if err is nil; brittle string match
        t.Fatal("wrong")
    }
}

func TestExpiry(t *testing.T) {
    c := NewCache(time.Second)
    c.Set("k", "v")
    time.Sleep(1100 * time.Millisecond)          // slow and flaky
    if _, ok := c.Get("k"); ok {
        t.Fatal("not expired")
    }
}
```
**Why it's wrong:**
- Duplicated tests with meaningless names and messages that show neither got nor want.
- Error comparison by string can panic and breaks on wording changes.
- Real sleeps make the suite slow and timing-dependent.

## Best Practice (How to do it right)

### 1. Table-driven test with subtests and error identity
```go
func TestDiscount(t *testing.T) {
    t.Parallel()
    tests := []struct {
        name    string
        amount  int64
        tier    string
        want    int64
        wantErr error
    }{
        {name: "gold gets 10 percent", amount: 100, tier: "GOLD", want: 90},
        {name: "standard pays full price", amount: 100, tier: "STANDARD", want: 100},
        {name: "unknown tier is rejected", amount: 100, tier: "PLATINUM", wantErr: ErrUnknownTier},
        {name: "negative amount is rejected", amount: -1, tier: "GOLD", wantErr: ErrInvalidAmount},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            got, err := Discount(tc.amount, tc.tier)
            if !errors.Is(err, tc.wantErr) {
                t.Fatalf("Discount() error = %v, want %v", err, tc.wantErr)
            }
            if got != tc.want {
                t.Errorf("Discount() = %d, want %d", got, tc.want)
            }
        })
    }
}
```
### 2. Deterministic time with synctest, and fuzzing
```go
func TestCacheExpiry(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        c := NewCache(time.Second)
        c.Set("k", "v")
        time.Sleep(1100 * time.Millisecond)      // fake clock inside the bubble: instant
        if _, ok := c.Get("k"); ok {
            t.Fatal("entry should have expired")
        }
    })
}

func FuzzParse(f *testing.F) {
    f.Add("SKU-1:2")
    f.Add("")
    f.Fuzz(func(t *testing.T, input string) {
        item, err := Parse(input)
        if err != nil {
            return
        }
        if item.Quantity <= 0 {
            t.Fatalf("Parse(%q) returned non-positive quantity %d", input, item.Quantity)
        }
    })
}
```
**Why it's right:**
- One readable table covers all cases, with descriptive names, got/want messages, and error identity checks.
- Time-dependent behavior runs instantly and deterministically; fuzzing searches for inputs that violate invariants.
