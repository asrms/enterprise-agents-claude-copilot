# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. C with classes
```cpp
#define MAX_ITEMS 100
using namespace std;

int parse_status(const char* s) {            // magic ints for states, C strings
    if (strcmp(s, "paid") == 0) return 2;
    return -1;                                 // error code easily ignored
}

double total(Item* items, int n) {            // raw pointer + size, double money
    double t = 0;
    for (int i = 0; i <= n; i++) t += items[i].price;   // off-by-one read past the end
    return t;
}
```
**Why it's wrong:**
- Macros, magic integers, and sentinel return values hide errors; money is floating point.
- Pointer-and-length pairs make out-of-bounds access easy, as the `<=` bug shows.

## Best Practice (How to do it right)

### 1. Strong types, enum class, expected, span, and ranges (C++23)
```cpp
#include <expected>
#include <numeric>
#include <ranges>
#include <span>
#include <string_view>

enum class OrderStatus { Pending, Paid, Shipped };
enum class ParseError { UnknownStatus };

[[nodiscard]] constexpr std::expected<OrderStatus, ParseError> parse_status(std::string_view s) noexcept {
    if (s == "pending") return OrderStatus::Pending;
    if (s == "paid") return OrderStatus::Paid;
    if (s == "shipped") return OrderStatus::Shipped;
    return std::unexpected(ParseError::UnknownStatus);
}

struct Cents {
    std::int64_t value{};
    friend constexpr Cents operator+(Cents a, Cents b) noexcept { return {a.value + b.value}; }
    friend constexpr auto operator<=>(Cents, Cents) = default;
};

struct Item { std::string sku; Cents price; int quantity{}; };

[[nodiscard]] Cents total(std::span<const Item> items) noexcept {
    auto line_totals = items | std::views::transform([](const Item& i) { return Cents{i.price.value * i.quantity}; });
    return std::ranges::fold_left(line_totals, Cents{}, std::plus<>{});
}

static_assert(parse_status("paid").value() == OrderStatus::Paid);
```
**Why it's right:**
- States are an `enum class`, failures are explicit with `std::expected`, and `[[nodiscard]]` prevents ignoring results.
- Money uses integer cents in a strong type, `std::span` carries size with the data, and ranges remove index arithmetic.
