# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Java habits in Kotlin Spring code
```kotlin
@Entity
data class Customer(@Id @GeneratedValue var id: Long? = null, var email: String? = null,
                    @OneToMany(mappedBy = "customer") var orders: MutableList<Order> = mutableListOf())
// data class: equals/hashCode/toString touch lazy collections and change after persist

@RestController
class CustomerController {
    @Autowired lateinit var repo: CustomerRepository                     // field injection
    @GetMapping("/customers/{id}")
    fun get(@PathVariable id: Long) = repo.findById(id).get()            // entity returned, throws on missing
}
```
**Why it's wrong:**
- Data-class entities break JPA identity and trigger lazy loading in `toString`/`hashCode`.
- Field injection hides dependencies; entities leak into the API, and a missing record becomes a 500 error.

## Best Practice (How to do it right)

### 1. Immutable configuration, constructor injection, DTOs, coroutines
```kotlin
@ConfigurationProperties("orders")
@Validated
data class OrdersProperties(
    @field:Min(1) @field:Max(200) val pageSize: Int = 50,
    @field:NotBlank val paymentsBaseUrl: String,
)

@Entity
@Table(name = "customer")
class CustomerEntity(
    @Id val id: UUID,
    @Column(nullable = false) var email: String,
) {
    override fun equals(other: Any?) = other is CustomerEntity && other.id == id
    override fun hashCode() = id.hashCode()
}

data class CustomerResponse(val id: UUID, val email: String)

@RestController
@RequestMapping("/v1/customers")
class CustomerController(private val customers: CustomerQueries) {
    @GetMapping("/{id}")
    suspend fun get(@PathVariable id: UUID): ResponseEntity<CustomerResponse> =
        customers.find(id)?.let { ResponseEntity.ok(CustomerResponse(it.id, it.email)) }
            ?: ResponseEntity.notFound().build()
}

@Configuration
class SecurityConfig {
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http {
            authorizeHttpRequests { authorize("/v1/**", authenticated); authorize("/actuator/health/**", permitAll) }
            oauth2ResourceServer { jwt { } }
        }
        return http.build()
    }
}
```
### 2. Test with SpringMockK
```kotlin
@WebMvcTest(CustomerController::class)
class CustomerControllerTest(@Autowired val mvc: MockMvc) {
    @MockkBean lateinit var customers: CustomerQueries

    @Test
    @WithMockUser
    fun `returns 404 for unknown customer`() {
        coEvery { customers.find(any()) } returns null
        mvc.get("/v1/customers/${UUID.randomUUID()}").asyncDispatch().andExpect { status { isNotFound() } }
    }
}
```
**Why it's right:**
- Configuration is immutable and validated, dependencies are constructor-injected, and entities are plain classes with identifier-based equality.
- Controllers return DTOs and handle missing data explicitly; security uses the Kotlin DSL, and tests use MockK-based beans.
