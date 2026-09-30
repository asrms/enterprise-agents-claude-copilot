# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Permissive security chain with a home-made JWT filter
```java
package com.acme.shop.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf().disable()                       // deprecated API, removed in Security 7
            .cors().and()                            // CORS with the default configuration
            .authorizeHttpRequests()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().permitAll()            // everything not listed is public
            .and()
            .addFilterBefore(new JwtFilter(), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    static class JwtFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws java.io.IOException, jakarta.servlet.ServletException {
            String header = req.getHeader("Authorization");
            if (header != null) {
                // parsing without verifying signature, issuer, and audience
                Claims claims = Jwts.parser().unsecured().build()
                        .parseUnsecuredClaims(header.substring(7)).getPayload();
                var auth = new UsernamePasswordAuthenticationToken(claims.getSubject(), null, List.of());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            chain.doFilter(req, res);
        }
    }
}
```
**Why it's wrong:**
- `anyRequest().permitAll()` is allow-by-default: every new endpoint is born public.
- The custom filter accepts unsigned tokens and does not check expiry, issuer, or audience: trivial impersonation.
- Deprecated `.and()`/`.csrf()` syntax; no explicit `STATELESS` session and CORS not configured.

### 2. Password encoding and hardcoded secrets
```java
package com.acme.identity.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.sql.DataSource;
import java.security.MessageDigest;
import java.util.HexFormat;

@Configuration
public class IdentityConfig {

    private static final String SIGNING_KEY = "s3cr3t-signing-key-prod-2024";

    @Value("${partner.api-key:ak_live_9f8e7d6c5b4a}") // real default in the code
    private String partnerApiKey;

    @Bean
    PasswordEncoder passwordEncoder() {
        return NoOpPasswordEncoder.getInstance(); // plaintext passwords in the DB
    }

    @Bean
    DataSource dataSource() {
        return new DriverManagerDataSource(
                "jdbc:postgresql://prod-db:5432/identity", "admin", "Adm1n!2024");
    }

    static String legacyHash(String password) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5"); // fast and unsalted
        return HexFormat.of().formatHex(md.digest(password.getBytes()));
    }
}
```
**Why it's wrong:**
- `NoOpPasswordEncoder` and unsalted MD5 make passwords recoverable if the DB is dumped.
- Signing keys, API keys, and DB credentials are in the source code and in Git history.
- `DriverManagerDataSource` bypasses HikariCP and externalized configuration.

### 3. Actuator exposed without protection
```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: "*"          # env, heapdump, threaddump, loggers, shutdown
  endpoint:
    health:
      show-details: always    # versions, DB host, disk status to anyone
    shutdown:
      enabled: true           # remote application shutdown
    env:
      show-values: always     # property values, secrets included
  server:
    port: 8080                # same public port as the APIs

spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://login.acme.com/realms/shop
          # no audience: every token of the realm is accepted

server:
  error:
    include-stacktrace: always
    include-message: always
```
**Why it's wrong:**
- `include: "*"` with `env`/`heapdump` exposes secrets and memory dumps containing tokens and personal data.
- `shutdown` enabled and reachable on the public port allows denial of service.
- Without an audience, tokens issued for other applications of the same realm are accepted.
- Stack traces and messages in errors reveal internal structure and library versions.

## Best Practice (How to do it right)

### 1. Permissive security chain with a home-made JWT filter
```java
package com.acme.shop.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
class ApiSecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http) throws Exception {
        // catch-all chain (no securityMatcher): no request escapes Spring Security
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/catalog/**").permitAll()
                        .requestMatchers("/api/v1/orders/**").hasAuthority("SCOPE_orders")
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN") // ROLE_* from the "roles" claim via JwtAuthenticationConverter
                        .anyRequest().denyAll())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(csrf -> csrf.disable()) // stateless API with bearer tokens, no session cookie
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(h -> h
                        .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                        .frameOptions(f -> f.deny())
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000))
                        .referrerPolicy(r -> r.policy(ReferrerPolicy.NO_REFERRER)))
                .build();
    }

    private UrlBasedCorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://shop.acme.com"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        config.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```
**Why it's right:**
- Deny-by-default with `anyRequest().denyAll()`: a new endpoint is inaccessible until it is explicitly authorized.
- JWT validation (signature via JWKS, `exp`, issuer, audience) is delegated to Spring Security's Resource Server.
- Lambda DSL compatible with Spring Security 7, CSRF disabled only because the chain is stateless, explicit CORS and headers.

### 2. Password encoding and hardcoded secrets
```java
package com.acme.identity.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.NotBlank;

@Configuration
@EnableConfigurationProperties(PartnerClientProperties.class)
class IdentityConfig {

    // {bcrypt} by default; also verifies legacy hashes with a prefix ({sha256}, {noop}) for migration
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}

// value injected from env PARTNER_API_KEY or from Vault, no default in the code
@Validated
@ConfigurationProperties(prefix = "partner")
record PartnerClientProperties(@NotBlank String baseUrl, @NotBlank String apiKey) {

    @Override
    public String toString() {
        return "PartnerClientProperties[baseUrl=" + baseUrl + ", apiKey=****]";
    }
}

// application.yml (versioned, without secrets):
// spring.config.import: optional:configtree:/run/secrets/,optional:vault://
// spring.datasource.url: ${DB_URL}
// spring.datasource.username: ${DB_USERNAME}
// spring.datasource.password: ${DB_PASSWORD}
// partner.base-url: https://api.partner.example
// partner.api-key: ${PARTNER_API_KEY}
```
**Why it's right:**
- `DelegatingPasswordEncoder` uses an adaptive algorithm and allows migrating legacy hashes with `upgradeEncoding`.
- Secrets come from environment variables, mounted secrets (`configtree`), or Vault: nothing ends up in Git.
- `@Validated` fails startup if the secret is missing; `toString()` masks the key in logs.

### 3. Actuator exposed without protection
```java
package com.acme.shop.config;

import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest; // Spring Boot 3.x package
import org.springframework.boot.actuate.health.HealthEndpoint;
import org.springframework.boot.actuate.info.InfoEndpoint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class ActuatorSecurityConfig {

    @Bean
    @Order(1)
    SecurityFilterChain actuatorSecurity(HttpSecurity http) throws Exception {
        return http
                .securityMatcher(EndpointRequest.toAnyEndpoint())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(EndpointRequest.to(HealthEndpoint.class, InfoEndpoint.class)).permitAll()
                        .anyRequest().hasRole("OPS"))
                .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
                .build();
    }
}

// application.yml:
// management.server.port: 8081                         # internal port, not exposed by the ingress
// management.endpoints.web.exposure.include: health,info,prometheus
// management.endpoint.health.show-details: when-authorized
// management.endpoint.env.show-values: never
// spring.security.oauth2.resourceserver.jwt.issuer-uri: https://login.acme.com/realms/shop
// spring.security.oauth2.resourceserver.jwt.audiences: orders-api   # Spring Boot 3.2+
// spring.security.oauth2.resourceserver.jwt.jws-algorithms: RS256
// server.error.include-stacktrace: never
```
**Why it's right:**
- A dedicated chain with `@Order(1)` and `EndpointRequest`: only `health` and `info` are public, the rest requires `ROLE_OPS`.
- Minimal endpoint exposure and a management port separate from the public port.
- Audience and signing algorithms constrained; no stack traces in error responses.
