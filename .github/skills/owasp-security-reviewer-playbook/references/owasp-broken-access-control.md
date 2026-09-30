# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Invoice download and Spring Security configuration (Java/Spring)
```java
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/admin/**").hasRole("ADMIN")
                .anyRequest().permitAll())          // "the controllers check anyway"
            .formLogin(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.addAllowedOriginPattern("*");           // any origin
        cfg.setAllowCredentials(true);              // together with the session cookie
        cfg.addAllowedMethod("*");
        cfg.addAllowedHeader("*");
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}

@RestController
@RequestMapping("/api/invoices")
class InvoiceController {

    private final InvoiceRepository invoices;

    InvoiceController(InvoiceRepository invoices) {
        this.invoices = invoices;
    }

    @GetMapping("/{id}/pdf")
    ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        Invoice inv = invoices.findById(id).orElseThrow(NotFoundException::new);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .body(inv.getPdf());
    }
}
```
**Why it's wrong:**
- `findById(id)` with no constraint on the customer and sequential `Long` IDs: iterating `/api/invoices/1..N/pdf` downloads everyone's invoices (CWE-639, A01:2021).
- `anyRequest().permitAll()` makes the endpoint accessible even without login, and the rule only on `POST` leaves `GET`, `PUT`, and `DELETE` of `/api/admin/**` open (CWE-862).
- `addAllowedOriginPattern("*")` with credentials reflects any origin: a third-party site can read the victim's authenticated responses (CWE-942, A05:2021).
- CSRF disabled with session-cookie authentication exposes every modifying operation (CWE-352).

### 2. Profile update and user management (Node.js/TypeScript + Prisma)
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from './auth';

const prisma = new PrismaClient();
export const router = Router();

// PATCH /api/users/me -> update of one's own profile
router.patch('/api/users/me', requireAuth, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: req.body,                 // the client decides which columns to write
  });
  res.json(user);                   // also returns passwordHash, mfaSecret, role
});

// PUT /api/users/:id -> used by the admin panel
router.put('/api/users/:id', requireAuth, async (req, res) => {
  if (req.body.isAdmin !== true) {  // flag sent by the admin frontend
    return res.status(403).json({ error: 'Administrators only' });
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: req.body.role, enabled: req.body.enabled },
  });
  res.json(user);
});
```
**Why it's wrong:**
- `data: req.body` allows any user to send `{"role": "ADMIN", "emailVerified": true}` and escalate privileges (CWE-915, A08:2021; API3:2023 BOPLA).
- The response serializes the entire record, exposing the password hash and the MFA secret (CWE-200, A01:2021).
- The function-level check relies on `isAdmin` sent by the client: just add it to the body (CWE-863/CWE-602, A01:2021).
- The update by `id` is not limited to the administrator's tenant, so it allows cross-tenant modifications.

### 3. Multi-tenant projects and an administrative endpoint (Python/FastAPI)
```python
from fastapi import Depends, FastAPI, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .db import get_db
from .models import Project, User

app = FastAPI()


@app.get("/api/projects/{project_id}")
def get_project(project_id: int,
                x_tenant_id: str = Header(...),
                db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    # the tenant is chosen by the client via a header
    project = db.execute(
        select(Project).where(Project.id == project_id,
                              Project.tenant_id == x_tenant_id)
    ).scalar_one_or_none()
    return project


@app.delete("/api/admin/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    # no authentication: "it's an internal endpoint"
    db.query(Project).filter(Project.id == project_id).delete()
    db.commit()
    return {"deleted": project_id}
```
**Why it's wrong:**
- `X-Tenant-Id` is client-controlled: by changing the header a user reads the projects of any tenant (CWE-639/CWE-863, A01:2021).
- `delete_project` has no authentication or role dependency at all: anyone who can reach the service deletes projects of every tenant (CWE-862/CWE-306).
- No `response_model`: the entire ORM entity is serialized; a non-existent object returns `200 null` instead of 404.
- Security depends on network position ("internal"), not on application checks.

## Best Practice (How to do it right)

### 1. Invoice download and Spring Security configuration (Java/Spring)
```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())                     // CSRF stays enabled (default)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/login", "/error", "/actuator/health").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN") // all HTTP methods
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())                         // deny by default
            .formLogin(Customizer.withDefaults());
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("https://app.example.com")); // exact allowlist
        cfg.setAllowCredentials(true);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        cfg.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", cfg);
        return src;
    }
}

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    Optional<Invoice> findByIdAndCustomerId(UUID id, UUID customerId);
}

@RestController
@RequestMapping("/api/invoices")
class InvoiceController {

    private final InvoiceRepository invoices;

    InvoiceController(InvoiceRepository invoices) {
        this.invoices = invoices;
    }

    @GetMapping("/{id}/pdf")
    ResponseEntity<byte[]> pdf(@PathVariable UUID id, @AuthenticationPrincipal AppUser user) {
        // ownership in the query: other customers' invoices -> 404, no existence leak
        Invoice inv = invoices.findByIdAndCustomerId(id, user.getCustomerId())
                              .orElseThrow(NotFoundException::new);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(inv.getPdf());
    }
}
```
**Why it's right:**
- The `findByIdAndCustomerId` query ties every access to the authenticated principal's customer: IDOR is eliminated at the root and UUIDs reduce enumeration.
- `denyAll()` as the last rule and `hasRole("ADMIN")` without an HTTP method cover every verb and every unexpected path.
- CORS with an exact allowlist of origins and headers, CSRF left enabled for cookie authentication.
- `Cache-Control: no-store` prevents personal documents from remaining in shared caches.

### 2. Profile update and user management (Node.js/TypeScript + Prisma)
```typescript
import { Router } from 'express';
import { Prisma, PrismaClient, Role } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole } from './auth'; // roles read from the verified token

const prisma = new PrismaClient();
export const router = Router();

// allowlist of writable fields: .strict() rejects any extra field
const UpdateProfile = z.object({
  displayName: z.string().min(1).max(80).optional(),
  locale: z.enum(['it-IT', 'en-US']).optional(),
}).strict();

const AdminUpdateUser = z.object({
  role: z.nativeEnum(Role).optional(),
  enabled: z.boolean().optional(),
}).strict();

// output projection: public fields only
const publicUser = { id: true, email: true, displayName: true, locale: true, role: true } as const;

router.patch('/api/users/me', requireAuth, async (req, res) => {
  const parsed = UpdateProfile.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Fields not allowed' });
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
    select: publicUser,
  });
  res.json(user);
});

router.put('/api/admin/users/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const parsed = AdminUpdateUser.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Fields not allowed' });
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id, tenantId: req.user!.tenantId }, // Prisma >= 5
      data: parsed.data,
      select: publicUser,
    });
    res.json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    throw e;
  }
});
```
**Why it's right:**
- Every operation has its own allowlist schema with `.strict()`: `role` is writable only from the administrative endpoint and only with enum values.
- `requireRole('ADMIN')` reads the role from the token verified on the server, not from the body.
- The explicit `select` prevents exposure of `passwordHash`, `mfaSecret`, and internal fields.
- The `tenantId` constraint in the `where` limits the administrator to their own tenant, and an out-of-scope record returns 404.

### 3. Multi-tenant projects and an administrative endpoint (Python/FastAPI)
```python
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .auth import Principal, get_principal  # verified JWT: signature, exp, iss, aud
from .db import get_db
from .models import Project


def require_role(role: str):
    def checker(p: Annotated[Principal, Depends(get_principal)]) -> Principal:
        if role not in p.roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Permission denied")
        return p
    return checker


require_tenant_admin = require_role("tenant_admin")


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    status: str


# deny by default: every route of the routers requires a valid principal
api = APIRouter(prefix="/api", dependencies=[Depends(get_principal)])
admin = APIRouter(prefix="/api/admin", dependencies=[Depends(require_tenant_admin)])


@api.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int,
                p: Annotated[Principal, Depends(get_principal)],
                db: Annotated[Session, Depends(get_db)]):
    project = db.scalars(select(Project).where(
        Project.id == project_id, Project.tenant_id == p.tenant_id)).one_or_none()  # tenant from the token
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@admin.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int,
                   p: Annotated[Principal, Depends(require_tenant_admin)],
                   db: Annotated[Session, Depends(get_db)]):
    result = db.execute(delete(Project).where(
        Project.id == project_id, Project.tenant_id == p.tenant_id))
    if result.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    db.commit()


app = FastAPI()
app.include_router(api)
app.include_router(admin)
```
**Why it's right:**
- The tenant comes exclusively from the verified token's claim (`p.tenant_id`) and is applied to both read and delete.
- Router-level dependencies make it impossible to forget authentication on a new route; the admin area requires the `tenant_admin` role on the server.
- `response_model=ProjectOut` exposes only the expected fields and out-of-tenant resources produce 404.
- Security does not depend on the network: even an "internal" caller must present a valid token with the required role.
