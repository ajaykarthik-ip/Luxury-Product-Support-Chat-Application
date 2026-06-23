# Phase 2 — Auth (JWT + Role Guards)

Goal: users can **register** and **log in**, the server hands back a **JWT**, and
every other route is **protected by default** — with the ability to restrict
routes to a specific role (CUSTOMER / AGENT).

Read this top to bottom; the request flow at the end ties it together.

---

## Install (you run this)

From `backend/`:

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs class-validator class-transformer
npm install -D @types/passport-jwt @types/bcryptjs
```

> **Why `bcryptjs` and not `bcrypt`?** `bcrypt` is a native addon that compiles C++
> at install time and often breaks on Windows / newer Node. `bcryptjs` is pure
> JavaScript — same API, zero build step. Slightly slower, irrelevant at our scale.

After installing, start the app:

```bash
npm run start:dev
```

---

## The big picture

```
            register / login                protected route (e.g. GET /auth/me)
                  │                                       │
        ┌─────────▼─────────┐                  ┌──────────▼───────────┐
        │ AuthController    │                  │  JwtAuthGuard         │ verifies token,
        │  → AuthService    │                  │   → JwtStrategy       │ sets request.user
        │  hash / verify pw │                  ├──────────────────────┤
        │  sign JWT         │                  │  RolesGuard           │ checks @Roles(...)
        └─────────┬─────────┘                  └──────────┬───────────┘
                  │ accessToken                           │ user reaches handler
                  ▼                                       ▼
```

---

## Files & responsibilities

### Users (`src/users/`)
- **`users.service.ts`** — the only place that touches the `user` table.
  - `create()` rejects duplicate emails (409), **hashes** the password with bcrypt,
    defaults role to `CUSTOMER`.
  - `findByEmail()` returns the full record (incl. hash) so login can verify.
  - `findById()` 404s if missing.
- **`users.module.ts`** — `exports` UsersService so AuthModule can inject it.

### Auth (`src/auth/`)
- **`dto/register.dto.ts`, `dto/login.dto.ts`** — request body shapes + validation
  rules (`@IsEmail`, `@MinLength`, …). Enforced by the global `ValidationPipe`, so
  bad input is rejected with `400` before the controller runs.
- **`auth.service.ts`**
  - `register()` → create user → sign token.
  - `login()` → look up by email → `bcrypt.compare()` → sign token. Uses one generic
    "Invalid credentials" message so we don't reveal which emails exist.
  - `buildAuthResponse()` returns `{ accessToken, user }` with **no password**.
- **`strategies/jwt.strategy.ts`** — tells Passport to read the token from the
  `Authorization: Bearer <token>` header, verify it with `JWT_SECRET`, and put
  `{ id, email, role }` on `request.user`.
- **`auth.controller.ts`** — `POST /auth/register`, `POST /auth/login` (both
  `@Public()`), and `GET /auth/me` (protected).
- **`auth.module.ts`** — wires in `JwtModule` (secret + expiry from `.env`),
  `PassportModule`, and registers `JwtStrategy`.

### Guards & decorators
- **`guards/jwt-auth.guard.ts`** — extends Passport's AuthGuard. Registered
  **globally**, so *every* route needs a valid token… unless marked `@Public()`.
- **`decorators/public.decorator.ts`** — `@Public()` opts a route out of auth.
- **`guards/roles.guard.ts`** — runs after JwtAuthGuard; if a route has
  `@Roles(...)`, only those roles pass (else `403`).
- **`decorators/roles.decorator.ts`** — `@Roles(Role.AGENT)` etc.
- **`decorators/current-user.decorator.ts`** — `@CurrentUser()` injects
  `request.user` into a handler param.

### Wiring
- **`app.module.ts`** registers both guards via `APP_GUARD` (global). Order matters:
  **JwtAuthGuard first** (authenticate, set `request.user`), **RolesGuard second**
  (authorize by role).
- **`main.ts`** turns on the global `ValidationPipe` (`whitelist` + `transform`) and
  `enableCors()` for the future Next.js frontend.
- **`app.controller.ts`** root route marked `@Public()` so the health check works.

---

## Key concepts (the "why")

**Why JWT?** The server signs a token containing the user's id + role. The client
sends it back on each request. The server only needs to *verify the signature* — no
session storage, no DB lookup per request. Stateless = easy to scale and a natural
fit for the WebSocket phase coming next.

**Why "secure by default"?** Making `JwtAuthGuard` global means a new route is
protected automatically. You can't *forget* to guard an endpoint — you must
explicitly mark it `@Public()`. The opposite (guard each route by hand) is one
forgotten decorator away from a leak.

**Why hash passwords?** If the DB ever leaks, hashes can't be reversed to
plaintext. `bcrypt.compare()` re-hashes the input and checks it matches — we never
decrypt anything.

**Note on self-assigned roles:** `RegisterDto` currently lets a client send
`role: "AGENT"`. Fine for testing/seeding. In a real app you'd force new signups to
CUSTOMER and create agents through an admin-only path. Flagged here so it's a
conscious choice, not an oversight.

---

## Test it (after `npm run start:dev`)

Use curl, Postman, or the VS Code REST client. Examples with curl:

```bash
# 1. Register (returns accessToken + user)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"secret123","name":"Ann","role":"CUSTOMER"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"secret123"}'

# 3. Call a protected route WITHOUT a token -> 401
curl http://localhost:3000/auth/me

# 4. Call it WITH the token -> your user
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <PASTE_accessToken_HERE>"
```

### Checkpoint — you're done when:
- Register returns `{ accessToken, user }` and the user shows up in `prisma studio`.
- Login with the right password returns a token; wrong password → `401`.
- `GET /auth/me` → `401` without a token, your user **with** one.
- Registering the same email twice → `409`.

Next phase: **Products + Conversations + Messages (REST endpoints)** — where
`@Roles()` and the `(customerId, productId)` unique constraint start doing real work.
