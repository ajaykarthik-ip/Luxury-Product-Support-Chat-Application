# DU — Luxury Product Support Chat

A real-time product support chat application. Customers browse luxury products and
get help from support agents; **each customer–product pair is its own conversation**,
delivered live over WebSockets.

Built with **Next.js** (frontend) and **NestJS** (backend), per the assignment brief.

---

## Features

**Customer**
- Browse products by category (public — no login to browse)
- Per-product support page with topic chips + two contact options:
  - **Live Chat** — real-time messaging with an agent
  - **Request a Callback** — describe an issue; an agent follows up
- A separate conversation per product (two products → two independent chats)

**Agent** (a real ticketing desk)
- Dashboard with filtered **views** — **Mine / Waiting / All / Closed** — with
  live tab counts and pagination, instead of one giant list
- Reply in real time — the thread list updates live (no refresh): new chats
  appear, active threads jump to the top, and unread messages are badged
- **Auto-routing (real ticket-desk model)** — chats route to the **least-busy
  agent who is online, marked Available, and under capacity** (max 5 concurrent).
  An **Available / Away** toggle gates routing; when an agent comes available or
  frees a slot, the **Waiting queue auto-drains** to them. Manual **Claim /
  Release** is the fallback, and chats sit in the queue when no one has capacity.
- **Ticket lifecycle** — **Resolve** a chat to clear it from the active views;
  a customer messaging a resolved chat **auto-reopens** it
- Mobile-friendly: thread list → tap → full-screen chat with a back button

**Both**
- The customer sees the assigned agent by name ("Chatting with Sara"; "Sara
  joined the conversation")
- JWT authentication with two roles (CUSTOMER / AGENT)
- Messages persisted in PostgreSQL, delivered live via Socket.IO

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4 |
| Backend | NestJS 11 (REST + WebSocket gateway) |
| Real-time | Socket.IO (one room per conversation) |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (Passport), bcryptjs password hashing |
| Deploy | AWS EC2 (free tier) |

---

## Architecture

```
   Next.js (frontend)  ──REST──►  NestJS (backend)  ──►  PostgreSQL (Prisma)
                       ◄─Socket.IO─►  (Chat gateway)
```

- **Single NestJS service** exposes both the REST API and the Socket.IO gateway.
- **REST** handles auth, products, conversation creation, and message history.
- **WebSocket** handles live messaging — **one room per conversation**
  (`conversation:<id>`), so a message reaches only that conversation's participants
  (not a global broadcast). This is the core scalability lever.
- **Agent dashboard real-time** — agents also join a single shared `agents` room
  that receives a lightweight ping per message, so their queue updates live (new
  chats, reordering, unread badges) without joining every conversation room.
- **Auto-routing + ticket lifecycle** — a customer's message into an unassigned,
  open chat auto-assigns the **least-busy online agent** (presence tracked in the
  gateway); agents work filtered **views** (Mine/Waiting/All/Closed) with live
  counts and pagination, and a **status** (Open/Closed) gives a real ticket
  lifecycle (resolve clears it; a new customer message reopens it). All ownership
  /status changes flow through one `conversation.changed` event → `conversation:updated`.
- **One conversation per (customer, product)** is enforced by a database unique
  constraint (`@@unique([customerId, productId])`) + an atomic `upsert` (find-or-create).

### Data model (Prisma)

- **User** — `role` enum (CUSTOMER | AGENT)
- **Product** — `name`, `description`, `imageUrl`, `category`
- **Conversation** — belongs to a customer + product (+ optional agent); has a
  `status` (`OPEN` / `CLOSED`) ticket lifecycle; `@@unique([customerId, productId])`,
  indexed by `(status, updatedAt)` and `(agentId, status)` for the agent views
- **Message** — belongs to a conversation + sender; indexed by `(conversationId, createdAt)`

Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

### Design decisions
Detailed, per-phase write-ups live in [`backend/docs/`](backend/docs) and
[`frontend/docs/`](frontend/docs). Highlights:
- **Secure by default** — a global JWT guard protects every route; public routes opt
  out with `@Public()` (e.g. product browsing).
- **Shared persistence + one broadcast path** — REST and WebSocket sends go through
  the same `MessagesService`, which raises a `message.created` domain event; the
  chat gateway listens and does all socket broadcasting. So a message is stored —
  and delivered live — identically whether it came from the socket or a REST call
  (e.g. the callback form), with no duplicated logic.
- **Deferred auth UX** — customers browse freely and only sign in when they take an
  action; agents have a separate gated portal.

---

## Repository structure

```
.
├── backend/    # NestJS API + WebSocket gateway + Prisma
│   ├── src/    # modules: auth, users, products, conversations, messages, chat
│   ├── prisma/ # schema + migrations + seed
│   └── docs/   # phase-by-phase explanations
├── frontend/   # Next.js app (App Router)
│   ├── src/app, src/components, src/lib
│   └── docs/
└── README.md
```

---

## Local setup

### Prerequisites
- Node.js 20+ and npm
- Docker (for local PostgreSQL)

### 1. Backend

```bash
cd backend
npm install

# Start PostgreSQL (Docker). Maps host port 5433 → container 5432.
docker compose up -d

# Create the .env (see backend/.env.example), then:
npx prisma migrate dev      # create tables + generate client
npm run seed                # 9 demo products across 3 categories

npm run start:dev           # http://localhost:3000
```

`backend/.env`:
```
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/luxury_chat?schema=public"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="1d"
```

### 2. Frontend

```bash
cd frontend
npm install

# .env.local
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000' > .env.local

# Backend owns port 3000, so run the frontend on another port:
npm run dev -- -p 3001      # http://localhost:3001
```

### Run commands (quick reference)

After the one-time setup above, these are the commands to **start the app** each time
(two terminals):

```bash
# Terminal 1 — database + backend (from backend/)
docker compose up -d        # start PostgreSQL (skip if already running)
npm run start:dev           # backend on http://localhost:3000

# Terminal 2 — frontend (from frontend/)
npm run dev -- -p 3001      # frontend on http://localhost:3001
```

Production build (used on the server):

```bash
# backend/
npm run build && npm run start:prod
# frontend/
npm run build && npm run start -- -p 3001
```

### Try it
1. Customer portal: http://localhost:3001/login → register → pick a product → chat.
2. Agent portal: http://localhost:3001/agent/login → register → answer chats.

---

## Tests

```bash
cd backend
npm run test:api    # REST smoke test (start backend first)
npm run test:ws     # WebSocket real-time test (run test:api first to seed users)
```

---

## Deployment (AWS EC2)

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

**Live URL:** http://15.206.17.249
