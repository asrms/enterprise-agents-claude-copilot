# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Relaxed mocks, real delays, verify everything
```kotlin
class ReminderServiceTest {
    @Test
    fun test1() = runBlocking {
        val repo = mockk<OrderRepository>(relaxed = true)                 // returns defaults for anything
        val mailer = mockk<Mailer>(relaxed = true)
        val service = ReminderService(repo, mailer)
        service.start()
        delay(61_000)                                                     // waits a real minute
        verify { repo.findUnpaid() }                                      // checks calls, not outcomes
        verify { mailer.toString() }
    }
}
```
**Why it's wrong:**
- Relaxed mocks make the test pass even if the code misbehaves, and the real delay makes it slow and flaky.
- Verifying incidental calls couples the test to implementation details.

## Best Practice (How to do it right)

### 1. Kotest with a fake, virtual time, and a focused MockK interaction
```kotlin
class ReminderServiceTest : FunSpec({
    test("sends one reminder per unpaid order after the grace period") {
        runTest {
            val orders = InMemoryOrderRepository(listOf(order("SO-1", status = UNPAID), order("SO-2", status = PAID)))
            val mailer = mockk<Mailer>()
            coEvery { mailer.sendReminder(any()) } just Runs

            val service = ReminderService(orders, mailer, gracePeriod = 1.minutes, dispatcher = StandardTestDispatcher(testScheduler))
            service.start(backgroundScope)

            advanceTimeBy(61.seconds)
            runCurrent()

            coVerify(exactly = 1) { mailer.sendReminder(OrderId("SO-1")) }
        }
    }

    context("reminder text") {
        withData(
            nameFn = { "${it.first} days overdue" },
            1 to "Your payment is 1 day overdue.",
            5 to "Your payment is 5 days overdue.",
        ) { (days, expected) ->
            reminderText(daysOverdue = days) shouldBe expected
        }
    }

    test("order ids always round-trip through parsing") {
        checkAll(Arb.int(1000..9_999_999)) { n ->
            OrderId.parse("SO-$n").value shouldBe "SO-$n"
        }
    }
})
```
**Why it's right:**
- The repository is a deterministic fake, the mock is strict, and only the meaningful interaction is verified.
- Virtual time makes the scheduling test instant; data-driven and property-based tests cover variations and invariants.
