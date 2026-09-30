# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Logic and blocking calls in routes
```kotlin
fun main() {
    embeddedServer(Netty, port = 8080) {
        routing {
            get("/orders/{id}") {
                val conn = DriverManager.getConnection("jdbc:postgresql://db/shop", "admin", "admin")  // secret in code, blocking
                val rs = conn.createStatement().executeQuery("SELECT * FROM orders WHERE id = '${call.parameters["id"]}'")
                if (!rs.next()) call.respondText("not found")                                          // 200 with text
                else call.respondText(rs.getString("payload"))
            }
        }
    }.start(wait = true)
}
```
**Why it's wrong:**
- SQL injection, hard-coded credentials, and blocking JDBC on the event loop without a pool.
- No serialization, validation, authentication, or consistent error handling.

## Best Practice (How to do it right)

### 1. Module with plugins, thin routes, and centralized errors
```kotlin
fun Application.module() {
    val config = AppConfig.load(environment.config)
    val orders = OrderService(PostgresOrderRepository(DataSources.create(config.database)))

    install(CallId) { retrieveFromHeader(HttpHeaders.XRequestId); generate { UUID.randomUUID().toString() } }
    install(CallLogging) { callIdMdc("request_id") }
    install(ContentNegotiation) { json(Json { explicitNulls = false }) }
    install(Authentication) {
        jwt("api") {
            verifier(JwkProviderBuilder(URI(config.auth.jwksUrl).toURL()).cached(10, 24, TimeUnit.HOURS).build(), config.auth.issuer) {
                withAudience(config.auth.audience)
            }
            validate { credential -> credential.payload.subject?.let { JWTPrincipal(credential.payload) } }
        }
    }
    install(StatusPages) {
        exception<OrderNotFound> { call, _ -> call.respondProblem(HttpStatusCode.NotFound, "Order not found") }
        exception<ValidationException> { call, e -> call.respondProblem(HttpStatusCode.BadRequest, e.message ?: "Invalid request") }
        exception<Throwable> { call, e ->
            call.application.log.error("Unhandled error", e)
            call.respondProblem(HttpStatusCode.InternalServerError, "Internal error")
        }
    }
    routing {
        get("/livez") { call.respond(HttpStatusCode.OK) }
        authenticate("api") { orderRoutes(orders) }
    }
}

fun Route.orderRoutes(orders: OrderService) = route("/v1/orders") {
    get("/{id}") {
        val id = OrderId(call.parameters.getOrFail("id"))
        val subject = call.principal<JWTPrincipal>()?.subject
            ?: return@get call.respond(HttpStatusCode.Unauthorized)
        call.respond(OrderResponse.from(orders.getForCustomer(id, CustomerId(subject))))
    }
}
```
### 2. Route test with testApplication
```kotlin
class OrderRoutesTest : FunSpec({
    test("returns 401 without a token") {
        testApplication {
            application { testModule(fakeOrders = FakeOrderService()) }
            client.get("/v1/orders/SO-1001").status shouldBe HttpStatusCode.Unauthorized
        }
    }
})
```
**Why it's right:**
- Plugins handle correlation, serialization, authentication, and errors centrally; routes only map HTTP to services.
- Configuration and dependencies are explicit and replaceable in tests, and authentication failures are tested.
