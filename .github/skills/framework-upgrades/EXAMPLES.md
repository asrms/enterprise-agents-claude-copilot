# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One giant jump mixed with features
```text
PR #1200 "Upgrade to Java 21 + Spring Boot 3.3 + new pricing feature" (Java 8 / Spring Boot 2.3 before)
- 1,847 files changed; javax -> jakarta by search-and-replace (including string literals in configs)
- @SuppressWarnings("deprecation") added in 60 places; 14 tests @Disabled "to fix later"
- deployed to 100% on Friday
```
**Why it's wrong:**
- Several majors are skipped at once, mechanical and behavioral changes are mixed, and tests and warnings are silenced.
- The change is unreviewable and there is no incremental rollout.

## Best Practice (How to do it right)

### 1. Stepwise plan with automated recipes (Java/Spring)
```text
Step 1  Spring Boot 2.3 -> 2.7 (still Java 11); fix deprecations; release
Step 2  Java 11 -> 17 build and runtime; release
Step 3  Spring Boot 2.7 -> 3.3 with OpenRewrite (javax -> jakarta, Security 6 config); release behind canary
Step 4  Java 17 -> 21; release
Step 5  Adopt new features (virtual threads for blocking I/O, records) in separate PRs
```
```xml
<!-- pom.xml: run the recipe, review the diff, commit as a mechanical change -->
<plugin>
  <groupId>org.openrewrite.maven</groupId>
  <artifactId>rewrite-maven-plugin</artifactId>
  <version>6.49.0</version>
  <configuration>
    <activeRecipes>
      <recipe>org.openrewrite.java.spring.boot3.UpgradeSpringBoot_3_3</recipe>
    </activeRecipes>
  </configuration>
  <dependencies>
    <dependency>
      <groupId>org.openrewrite.recipe</groupId>
      <artifactId>rewrite-spring</artifactId>
      <version>6.40.0</version>
    </dependency>
  </dependencies>
</plugin>
```
```bash
./mvnw rewrite:dryRun          # inspect target/rewrite/rewrite.patch
./mvnw rewrite:run && ./mvnw verify
```
### 2. .NET and Angular equivalents
```bash
dotnet tool install -g upgrade-assistant && upgrade-assistant upgrade ./src/Orders.Api/Orders.Api.csproj
ng update @angular/core@19 @angular/cli@19     # one major at a time, then 20, 21...
```
**Why it's right:**
- Each step is small, releasable, and verified; mechanical changes come from recipes and are reviewed separately.
- New capabilities are adopted only after the platform upgrade is stable.
