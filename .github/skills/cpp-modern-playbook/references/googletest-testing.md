# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Hidden dependencies and vague assertions
```cpp
TEST(Test1, Works) {
    ReminderService service;                                    // creates real HTTP client and uses system_clock inside
    service.run();
    std::this_thread::sleep_for(std::chrono::seconds(3));      // hope the reminder was sent
    EXPECT_TRUE(service.sent() > 0);
}
```
**Why it's wrong:**
- The unit cannot be isolated, depends on real time and the network, and the assertion says nothing specific.

## Best Practice (How to do it right)

### 1. Injected interfaces, mocks, fakes, and parameterized tests
```cpp
class Clock {
public:
    virtual ~Clock() = default;
    virtual std::chrono::sys_seconds now() const = 0;
};

class Mailer {
public:
    virtual ~Mailer() = default;
    virtual void send_reminder(const OrderId& id) = 0;
};

class FakeClock final : public Clock {
public:
    explicit FakeClock(std::chrono::sys_seconds t) : t_(t) {}
    std::chrono::sys_seconds now() const override { return t_; }
    void advance(std::chrono::seconds d) { t_ += d; }
private:
    std::chrono::sys_seconds t_;
};

class MockMailer : public Mailer {
public:
    MOCK_METHOD(void, send_reminder, (const OrderId& id), (override));
};

TEST(ReminderService, SendsReminderForUnpaidOrdersAfterGracePeriod) {
    FakeClock clock{std::chrono::sys_days{std::chrono::year{2026}/9/29}};
    InMemoryOrders orders{{Order{OrderId{"SO-1"}, Status::Unpaid, clock.now()}}};
    testing::StrictMock<MockMailer> mailer;
    ReminderService service{orders, mailer, clock, std::chrono::hours{24}};

    EXPECT_CALL(mailer, send_reminder(OrderId{"SO-1"})).Times(1);

    clock.advance(std::chrono::hours{25});
    service.run_once();
}

class ParseAmountTest : public testing::TestWithParam<std::pair<std::string, std::int64_t>> {};

TEST_P(ParseAmountTest, ParsesToCents) {
    const auto& [input, expected] = GetParam();
    EXPECT_THAT(parse_amount(input), testing::Optional(expected));
}

INSTANTIATE_TEST_SUITE_P(Amounts, ParseAmountTest, testing::Values(
    std::pair{std::string{"10"}, std::int64_t{1000}},
    std::pair{std::string{"10.50"}, std::int64_t{1050}},
    std::pair{std::string{"0.01"}, std::int64_t{1}}));
```
**Why it's right:**
- Time and side effects are injected, so the test is fast, deterministic, and verifies the exact interaction.
- Parameterized tests cover input variations with expressive matchers.
