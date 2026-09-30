---
name: kotlin-serialization
description: "Safe and efficient serialization in Kotlin with kotlinx.serialization (and Jackson where required): @Serializable data classes, explicit JSON configuration, default values and nullability, polymorphic sealed hierarchies with class discriminators, custom serializers for value classes, dates, and money, schema evolution and backward compatibility, and security against untrusted input. Use it when defining or reviewing JSON or other serialized contracts in Kotlin."
---

# Skill: Kotlin Serialization

## Implementation Rules:
- **[PATTERN]** Use kotlinx.serialization with the compiler plugin for Kotlin-first code (Ktor, multiplatform, Spring with the kotlinx converter); use Jackson with `jackson-module-kotlin` when the framework or ecosystem requires it, but do not mix both for the same contract.
- **[MANDATORY]** Configure one shared `Json` instance per contract with explicit settings (`ignoreUnknownKeys`, `explicitNulls`, `encodeDefaults`, `coerceInputValues`) chosen deliberately and documented, rather than scattered ad hoc configurations.
- **[MANDATORY]** Separate serialized DTOs from domain models: `@Serializable` DTOs define the wire contract with `@SerialName` for stable field names, and mapping functions convert to domain types with validation.
- **[PATTERN]** Model polymorphism with sealed hierarchies and a class discriminator (`@JsonClassDiscriminator("type")` or `classDiscriminator` in the configuration) with stable `@SerialName` values, so new subtypes and renames do not break clients.
- **[PATTERN]** Write custom serializers for value classes with validation, dates and times (ISO 8601 with `kotlinx-datetime` or `java.time` serializers), `BigDecimal` money as strings, and enums with explicit serial names.
- **[MANDATORY]** Evolve contracts compatibly: add fields with defaults, never repurpose or rename existing serial names, tolerate unknown fields from newer producers where appropriate, and version contracts for breaking changes.
- **[SECURITY]** Treat input as untrusted: validate after deserialization (lengths, ranges, formats), limit payload sizes at the HTTP layer, and never enable polymorphic deserialization based on arbitrary class names from input (for example Jackson default typing).
- **[FORBIDDEN]** Serializing domain entities or JPA entities directly, `Double` for money, relying on property declaration order or Kotlin property names that may be refactored without `@SerialName`, and Java `Serializable` or native serialization for data crossing trust boundaries.
- **[PERFORMANCE]** Reuse `Json` instances and serializers, stream large payloads (`Json.decodeFromStream`, `encodeToStream`, or sequences) instead of building huge strings, and use binary formats (Protobuf via kotlinx or CBOR) where contracts and performance justify it.
- **[PATTERN]** Keep contract definitions discoverable: DTOs in a dedicated package or module, generated OpenAPI or JSON Schema where consumers need it, and examples in documentation.
- **[TESTING]** Test round trips, golden JSON files for public contracts (to detect accidental changes), backward compatibility with older payloads, polymorphic subtype handling, and rejection of invalid input.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
