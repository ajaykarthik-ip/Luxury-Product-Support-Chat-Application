# Phase 4 — Real-time Chat (Socket.IO Gateway)

Adds live message delivery. The gateway sits *alongside* the REST API in the same
NestJS process and reuses the same services — REST and WebSocket are two doors into
identical logic.

---

## Install (you run this)

From `backend/`:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io @nestjs/event-emitter
npm install -D socket.io-client
```

- `@nestjs/websockets` + `@nestjs/platform-socket.io` — Nest's gateway support on the
  Socket.IO engine.
- `socket.io` — the server runtime.
- `@nestjs/event-emitter` — an in-process event bus. Lets `MessagesService` raise a
  `message.created` event without depending on the gateway; the gateway subscribes
  and does the broadcasting (see "Agent dashboard" below).
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

### 4. Agent dashboard: the `agents` room + event-driven broadcast
The per-conversation room is perfect for the people *inside* a thread, but an agent's
dashboard needs to know about activity in **every** conversation — including ones they
haven't opened. Joining all N rooms wouldn't scale, so instead **every agent socket
auto-joins one shared room, `agents`**, on connect. That room gets a lightweight
`message:activity` ping per message — agents are few and the payload is small, so it
stays cheap while the per-conversation fan-out keeps using its own room.

To avoid the persistence layer knowing about sockets (and to keep one broadcast path
for both REST and WebSocket messages), broadcasting is **event-driven**:

```
 MessagesService.create()  ──emit──►  "message.created"  (in-process event)
                                            │
                              ChatGateway @OnEvent listener
                                            │
            ┌───────────────────────────────┴───────────────────────────────┐
   message:new → conversation:<id> room            message:activity → agents room
   (the people viewing that thread)                (every agent's dashboard)
```

The gateway no longer emits inside `message:send`; it just persists and lets the event
fire. That means a **callback** message (saved via REST, never touching the socket) is
broadcast to live viewers *and* the agent dashboard exactly like a socket message —
one path, no special-casing. The dashboard uses `message:activity` to bump the thread
to the top, refresh its preview, and badge unread; an unknown `conversationId` means a
brand-new chat, which it fetches and inserts.

### 5. Presence-aware auto-routing (who answers the customer)
A chat needs an *owner* — otherwise two agents reply to the same person and others go
unanswered. We route automatically, modelled on how real support tools (and Swiggy/Uber
dispatch) work: **assign the least-loaded available agent**.

- **Presence + availability** — `AgentPresenceService` tracks which agents are online
  (keyed by socket) **and** an Available/Away flag per agent. Routing only ever considers
  agents who are **online AND available**. In-memory, because presence is ephemeral and
  high-churn; at multi-instance scale it'd move to Redis.
- **Capacity** — each agent handles at most `MAX_CONCURRENT_CHATS` (5) **open** chats.
  Routing fills agents up to the cap, then leaves the rest queued.
- **The trigger** — when a *customer* message lands (`onMessageCreated`) in a chat with
  no agent, the gateway asks `ConversationsService.handleIncomingCustomerMessage(...)`
  with the current *available* agents.
- **The pick** — `pickLeastBusyAgent` picks the available, **under-capacity** agent with
  the fewest open chats (idle agents, counted as 0, get work first); returns null if
  everyone's full, so the chat waits.
- **Queue drain (pull on availability)** — `distributeWaiting` assigns the longest-waiting
  chats to available under-capacity agents, least-loaded first, until capacity runs out.
  It runs when an agent **comes online**, **toggles Available**, or **frees a slot**
  (a resolve/release fires `conversation.changed`, which the gateway uses as a drain
  trigger). This is the "pull from queue when an agent is free" behaviour of real desks.
- **The race guard** — assignment is an `updateMany ... where agentId: null`; if two
  customer messages race, only the first flips it, so we never double-assign.
- **Announcement** — any ownership/status change raises one `conversation.changed`
  domain event; the gateway broadcasts `conversation:updated` to the room (customer sees
  "Sara joined" / that it reopened) and the `agents` room (dashboards relabel, move the
  thread between views, refresh counts).
- **Manual fallback** — `PATCH /conversations/:id/{claim,release,resolve,reopen}`
  (agent-only) emit the *same* event, so claiming, handing back, resolving, or reopening
  updates every screen live. If no agent is online when a customer writes, the chat
  simply waits in the queue until an agent claims it (or messages again once one is online).

### 6. Ticket lifecycle + agent views (the real-world desk)
A conversation is a **ticket** with a `status` (`OPEN` / `CLOSED`). Agents don't stare at
one giant list — they work **views**, served by `GET /conversations?view=…&skip=&take=`:

| View | Filter | Meaning |
|------|--------|---------|
| **Mine** | `agentId = me, status OPEN` | the agent's own active work |
| **Waiting** | `agentId = null, status OPEN` | the unassigned pool to pull from |
| **All** | `status OPEN` | every active ticket |
| **Closed** | `status CLOSED` | resolved history |

`GET /conversations/counts` returns the per-view totals for the tab badges. **Resolve**
closes a ticket (it leaves the active views); a customer messaging a closed ticket
**auto-reopens** it (just like real ticketing tools). The least-busy picker counts only
*open* tickets, so resolved work doesn't weigh an agent down.

> **Future step (the "Uber" version):** offer a chat to one agent with an accept timeout
> and cascade to the next on no-answer, plus a per-agent capacity cap, and pull-from-queue
> on agent login. The least-busy model here is the pragmatic 80% — deterministic, no
> timers, easy to demo.

---

## Events (the socket "API")

| Direction | Event | Payload | Notes |
|-----------|-------|---------|-------|
| client → server | `conversation:join` | `{ conversationId }` | Access-checked; server replies `conversation:joined` |
| client → server | `conversation:leave` | `{ conversationId }` | Server replies `conversation:left` |
| client → server | `message:send` | `{ conversationId, content }` | Saves, then broadcasts `message:new` to the room |
| client → server | `agent:status` | `{ available }` | Agent toggles Available/Away; Available also drains the queue |
| server → client | `conversation:joined` | `{ conversationId }` | Join confirmed |
| server → client | `message:new` | the saved message (+ sender) | Sent to everyone in the room |
| server → client | `message:activity` | the saved message (+ sender) | Sent to the `agents` room — drives the dashboard list (bump, preview, unread) |
| server → client | `conversation:updated` | `{ conversationId, agentId, agent, status }` | Metadata changed (auto-assign / claim / release / resolve / reopen) — to the room (customer sees the agent / status) and the `agents` room (dashboards relabel, move the thread between views, refresh counts) |

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
