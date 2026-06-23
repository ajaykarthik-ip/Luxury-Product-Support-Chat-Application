# Phase 4 — Real-time Chat (Socket.IO Gateway)

Adds live message delivery. The gateway sits *alongside* the REST API in the same
NestJS process and reuses the same services — REST and WebSocket are two doors into
identical logic.

---

## Install (you run this)

From `backend/`:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install -D socket.io-client
```

- `@nestjs/websockets` + `@nestjs/platform-socket.io` — Nest's gateway support on the
  Socket.IO engine.
- `socket.io` — the server runtime.
- `socket.io-client` — only for the test script (`scripts/test-ws.mjs`).

Then restart: `npm run start:dev`.

---

## How it works

```
 customer socket ─┐                          ┌─ agent socket
                  │   ChatGateway (Socket.IO) │
   message:send ──┼──► verify access ─────────┤
                  │    MessagesService.create │  (saves to DB)
                  │    emit to room ───────────┼──► message:new  (both receive)
                  └──────────────────────────┘
                      room = "conversation:<id>"
```

### 1. Auth on the handshake
When a socket connects, `handleConnection` pulls the JWT (from `auth.token`, a query
param, or the Authorization header), verifies it with the **same `JwtService`** as
REST, and stores the user on `client.data.user`. Bad/missing token → the socket is
disconnected immediately. So by the time any event fires, the socket is trusted.

### 2. One room per conversation (the scalability lever)
Clients call `conversation:join` with a `conversationId`. The gateway checks access
(reusing `ConversationsService.getAccessibleConversation` — same 403/404 rules as
REST), then `socket.join("conversation:<id>")`.

When a message is sent, we emit **only to that room**:
```ts
this.server.to(`conversation:${id}`).emit('message:new', message);
```
This is what makes it scale: with 20 (or 2000) concurrent conversations, a message
touches only the handful of sockets in *its* room — never a global broadcast. This
is the assignment's "scalability of chat handling" criterion, handled at the
transport layer.

### 3. Shared persistence
`message:send` calls the same `MessagesService.create()` the REST endpoint uses. So a
message is stored identically (and the agent gets auto-assigned, `updatedAt` bumped)
whether it came over HTTP or a socket. One source of truth, no drift.

---

## Events (the socket "API")

| Direction | Event | Payload | Notes |
|-----------|-------|---------|-------|
| client → server | `conversation:join` | `{ conversationId }` | Access-checked; server replies `conversation:joined` |
| client → server | `conversation:leave` | `{ conversationId }` | Server replies `conversation:left` |
| client → server | `message:send` | `{ conversationId, content }` | Saves, then broadcasts `message:new` to the room |
| server → client | `conversation:joined` | `{ conversationId }` | Join confirmed |
| server → client | `message:new` | the saved message (+ sender) | Sent to everyone in the room |

> We use explicit server→client confirmation events (e.g. `conversation:joined`)
> rather than Socket.IO ack callbacks — it's how the frontend consumes the gateway,
> and it keeps the contract event-driven end to end.

The frontend (Phase 6) will: connect with the JWT → `conversation:join` when opening
a thread → listen for `message:new` to append messages → `message:send` to post.

---

## Test it — automated

Backend running, REST seed already done once (so the users/product exist — running
`npm run test:api` first guarantees this), then:

```bash
npm run test:ws
```

`scripts/test-ws.mjs` connects a customer and an agent socket and verifies:
- a bad token is **rejected** at connect
- both sockets connect with valid tokens
- both **join** the conversation room
- a customer's `message:send` is delivered **live** to the agent (`message:new`)
- the reverse: agent → customer, live
- delivered messages include sender info

Prints `N passed, M failed`.

> Why run `test:api` first? It seeds `agent@test.com`, `bob@test.com`, and a product.
> The WS test logs in as those users and reuses them.

### Checkpoint — done when `npm run test:ws` is all green.

### ✅ Verified — `npm run test:ws` → **8 passed, 0 failed**

Confirmed: bad-token connections rejected at handshake; both sockets connect; both
join the room; customer→agent and agent→customer messages delivered **live** via
`message:new`; delivered payloads include sender info.

Next phase: **Next.js frontend** (product list, customer chat windows, agent dashboard).
