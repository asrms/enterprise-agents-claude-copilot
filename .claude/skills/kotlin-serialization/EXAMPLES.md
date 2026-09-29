# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Domain entity on the wire with fragile names and double money
```kotlin
@Serializable
data class Order(val id: String, var amount: Double, val paymentMethod: PaymentMethod)   // double money, mutable

@Serializable
abstract class PaymentMethod                                                             // open polymorphism, no discriminator

val json = Json { ignoreUnknownKeys = true; isLenient = true }                            // lenient parsing, defined in 5 places
val order = json.decodeFromString<Order>(request.body)                                    // no validation
```
**Why it's wrong:**
- Floating-point money loses precision, renaming a property silently changes the contract, and there is no validation.
- Open polymorphism without stable discriminators breaks when classes are renamed or added.

## Best Practice (How to do it right)

### 1. DTOs with stable names, sealed polymorphism, and custom serializers
```kotlin
val ApiJson = Json {
    ignoreUnknownKeys = true          // tolerate additive changes from newer clients
    explicitNulls = false
    encodeDefaults = true
    classDiscriminator = "type"
}

@Serializable
data class CreateOrderRequest(
    @SerialName("customer_id") val customerId: String,
    @SerialName("items") val items: List<ItemDto>,
    @SerialName("payment") val payment: PaymentDto,
    @SerialName("gift_message") val giftMessage: String? = null,     // added in v1.3 with a default
)

@Serializable
sealed interface PaymentDto {
    @Serializable @SerialName("card")
    data class Card(@SerialName("token") val token: String) : PaymentDto
    @Serializable @SerialName("invoice")
    data class Invoice(@SerialName("po_number") val poNumber: String) : PaymentDto
}

@Serializable
data class ItemDto(
    @SerialName("sku") val sku: String,
    @SerialName("quantity") val quantity: Int,
    @SerialName("unit_price") @Serializable(with = BigDecimalAsStringSerializer::class) val unitPrice: BigDecimal,
)

object BigDecimalAsStringSerializer : KSerializer<BigDecimal> {
    override val descriptor = PrimitiveSerialDescriptor("BigDecimal", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: BigDecimal) = encoder.encodeString(value.toPlainString())
    override fun deserialize(decoder: Decoder) = BigDecimal(decoder.decodeString())
}

fun CreateOrderRequest.toCommand(): PlaceOrder {
    require(items.size in 1..50) { "An order needs between 1 and 50 items" }
    require(items.all { it.quantity in 1..100 }) { "Quantity must be between 1 and 100" }
    return PlaceOrder(CustomerId(customerId), items.map { OrderLine(Sku(it.sku), it.quantity, Money(it.unitPrice)) })
}
```
### 2. Golden file test for the public contract
```kotlin
test("create order request matches the published contract") {
    val json = readResource("contracts/create-order-v1.3.json")
    val decoded = ApiJson.decodeFromString<CreateOrderRequest>(json)
    ApiJson.parseToJsonElement(ApiJson.encodeToString(decoded)) shouldBe ApiJson.parseToJsonElement(json)
}
```
**Why it's right:**
- Wire names are explicit and stable, money is a decimal string, polymorphism uses a sealed hierarchy with discriminators, and new fields have defaults.
- DTOs are validated when mapped to domain commands, and a golden file guards the published contract.
