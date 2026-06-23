# Phase 3 — Products, Conversations & Messages (REST)

This phase builds the core domain of the assignment over plain REST. Real-time
delivery comes in Phase 5 (WebSockets) and will **reuse** the services written here.

No new packages needed — everything uses what Phases 1–2 already installed.

---

## Endpoints

All routes require a JWT (global guard) unless noted. Roles in **bold** are enforced.

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| `GET`  | `/products` | **public** | List products (browsable without login) |
| `GET`  | `/products/:id` | **public** | One product |
| `POST` | `/products` | **AGENT** | Add a product (our seed/admin path) |
| `POST` | `/conversations` | **CUSTOMER** | Start/open chat for a product (find-or-create) |
| `GET`  | `/conversations` | any logged-in | Agent → all; Customer → own |
| `GET`  | `/conversations/:id` | owner or agent | One conversation |
| `GET`  | `/conversations/:id/messages` | owner or agent | Message history (oldest→newest) |
| `POST` | `/conversations/:id/messages` | owner or agent | Send a message (REST; WS later) |

---

## The core rule: one conversation per (customer, product)

`POST /conversations` calls `ConversationsService.findOrCreate()`, which does an
**upsert** on the composite unique key:

```ts
this.prisma.conversation.upsert({
  where: { customerId_productId: { customerId, productId } },
  update: {},
  create: { customerId, productId },
});
```

- If a conversation for that pair exists → it's returned.
- If not → it's created.
- Because the uniqueness is a **database constraint**, even two near-simultaneous
  "Chat with Agent" clicks can't create duplicates. We don't rely on app-level
  check-then-insert (which has a race condition).

`customerId` always comes from the **JWT**, never the request body — a client can't
open a conversation as someone else.

This directly satisfies: *"A separate chat session must be created for each product"*
and *"two products → two independent conversations."*

---

## Role-aware listing (agent vs customer)

`GET /conversations` branches on the caller's role:

```ts
const where = user.role === Role.AGENT ? {} : { customerId: user.id };
```

- **Agent** → `{}` → every conversation (their full queue). This is what makes
  *"10 customers × 2 products = 20 conversations"* manageable from one place.
- **Customer** → only their own.

Sorted by `updatedAt desc` so the most recently active chats are on top.

---

## Access control

`assertAccess()` is the single gate: agents may touch any conversation; a customer
may only touch their own (else `403`). Both the detail route and the message routes
go through it, so the rule lives in exactly one place.

Message HTTP routes are **nested under conversations**
(`/conversations/:id/messages`) on purpose — that way the access check runs before
any message read/write, instead of duplicating it in a separate controller.

## Why MessagesService is its own module

`MessagesService.create()` is deliberately framework-agnostic (no HTTP types). In
Phase 5 the WebSocket gateway will call the *same* method, so a message persists
identically whether it arrives over REST or a socket. Sending an agent message also
bumps `conversation.updatedAt` and assigns the agent — keeping the agent's thread
list ordered and labelled.

---

## Test it — automated script

The fastest way to verify everything. With the backend running (`npm run start:dev`),
in another terminal:

```bash
npm run test:api
```

`scripts/test-api.mjs` registers an agent + two customers, creates products, and
checks every endpoint **including** the tricky cases:
- same product twice → **same** conversation id (find-or-create)
- different product → **different** conversation
- customer creating a product → `403`
- agent starting a conversation → `403`
- another customer reading Bob's conversation → `403`
- no token → `401`, empty message → `400`
- message history ordered oldest-first, agent auto-assigned

It prints `N passed, M failed` and exits non-zero if anything fails — so it doubles
as a regression check you can re-run after future changes.

### Manual (Postman) quickstart
1. `POST /auth/login` as `agent@test.com` → copy `accessToken`.
2. `POST /products` (Bearer agent token) → note the product `id`.
3. `POST /auth/login` as `bob@test.com` → copy token.
4. `POST /conversations` (Bearer Bob) body `{ "productId": "<id>" }`.
5. `POST /conversations/<id>/messages` body `{ "content": "hello" }`.
6. `GET /conversations/<id>/messages` → see the thread.

### Checkpoint — you're done when `npm run test:api` shows all green.

### ✅ Verified — `npm run test:api` → **24 passed, 0 failed**

All endpoints confirmed working, including the core rules:

```
Auth          7/7   register, login, /me, 401 no-token, 401 bad password
Products      4/4   agent create, customer list, 403 customer-create
Conversations 7/7   find-or-create (same id), different product → different convo,
                    403 agent-start, role-aware list, 403 cross-customer read
Messages      6/6   send, reply, ordered history, agent auto-assign, 400 empty
```

Next phase: **WebSockets (Socket.IO gateway)** for real-time delivery.
