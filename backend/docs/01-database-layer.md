# Phase 1 — Database Layer (Docker + Prisma)

This phase sets up PostgreSQL (in Docker) and connects NestJS to it through Prisma.
Read this, then run the commands at the bottom.

---

## Files created in this phase

| File | What it is |
|------|-----------|
| `docker-compose.yml` | Defines a Postgres container so you don't install Postgres natively. |
| `prisma/schema.prisma` | The single source of truth for your DB tables. |
| `.env` / `.env.example` | Connection string + secrets. `.env` is gitignored. |
| `src/prisma/prisma.service.ts` | Injectable wrapper around the Prisma client. |
| `src/prisma/prisma.module.ts` | Makes the service available everywhere. |
| `src/app.module.ts` | Wires in config + Prisma. |

---

## 1. Docker Compose — why and what

`docker-compose.yml` describes one service: a Postgres 16 container.

- **`image: postgres:16-alpine`** — official Postgres, small Alpine variant.
- **`environment`** — Postgres reads these on first boot to create the user,
  password, and an initial database (`luxury_chat`).
- **`ports: '5432:5432'`** — maps the container's Postgres port to your machine,
  so the app connects via `localhost:5432`.
- **`volumes: postgres_data`** — a named volume that persists the data even if the
  container is deleted. Without it, your data vanishes on `docker compose down`.

> The credentials here (`postgres` / `postgres`) are fine for local dev only.

---

## 2. Prisma schema — the model design

Prisma turns the models in `schema.prisma` into SQL tables and generates a
fully-typed client.

### Why these choices

- **`@default(uuid())` IDs** — UUIDs instead of auto-increment ints. Harder to
  guess/enumerate (good for a support app where you don't want users probing
  `/conversations/1`, `/conversations/2`...).
- **`Role` enum** — Postgres enforces the value is `CUSTOMER` or `AGENT`. Better
  than a free-text string.
- **`password` stores a hash** — we never store plaintext. Hashing comes in the
  auth phase.
- **`agentId` is optional (`String?`)** — a customer can open a conversation
  before any agent picks it up.

### The core constraint

```prisma
@@unique([customerId, productId])
```

This is the heart of the assignment: **one conversation per (customer, product)
pair.** The database itself rejects a second conversation for the same pair — we
don't rely on application code remembering to check. When we build the "start
conversation" endpoint, we'll lean on this (find-or-create).

### Relations explained

A `User` shows up in conversations two ways — as the **customer** and as the
**agent**. Because there are *two* relations between `User` and `Conversation`,
Prisma can't guess which is which, so we name them:
`@relation("CustomerConversations")` and `@relation("AgentConversations")`.

`Message` has `onDelete: Cascade` on its conversation link — deleting a
conversation deletes its messages automatically.

The `@@index([conversationId, createdAt])` on `Message` speeds up the most common
query: "give me this conversation's messages in time order."

---

## 3. PrismaService + PrismaModule — the NestJS part

NestJS is built around **dependency injection (DI)**: instead of `new`-ing
objects yourself, you declare what a class needs and Nest provides it.

- **`PrismaService`** extends `PrismaClient`, so the service *is* the DB client.
  It implements `onModuleInit()` (a lifecycle hook) to call `$connect()` when the
  app starts.
- **`@Injectable()`** marks it as something Nest can inject.
- **`PrismaModule`** is `@Global()` and `exports` the service. Global means you
  register it once in `AppModule` and inject `PrismaService` anywhere without
  re-importing the module each time.

Later, a service will use it like:

```ts
constructor(private readonly prisma: PrismaService) {}
// ...
this.prisma.conversation.findMany();
```

- **`ConfigModule.forRoot({ isGlobal: true })`** in `AppModule` loads `.env` into
  `process.env` so `DATABASE_URL` is available to Prisma.

---

## Commands to run (you run these)

From the `backend/` folder:

```bash
# 1. Install the packages this phase needs
npm install @prisma/client @nestjs/config
npm install -D prisma

# 2. Start Postgres (needs Docker Desktop running + WSL integration on)
docker compose up -d

# 3. Create the tables from the schema + generate the typed client
npx prisma migrate dev --name init

# 4. (optional) Open a GUI to inspect your data
npx prisma studio
```

`prisma migrate dev` does three things: creates a SQL migration file, applies it
to the DB, and regenerates the `@prisma/client` types. Run it again whenever you
change `schema.prisma`.

### If `docker` isn't found in WSL
Enable Docker Desktop → Settings → Resources → WSL Integration → toggle on your
distro, then reopen the terminal. (Running from PowerShell works too if Docker
Desktop is up.)

### Gotchas we actually hit (so future-you knows)

- **Host port is `5433`, not `5432`.** Another Postgres was already listening on
  `5432` on this machine (a native install or leftover container), which caused
  `P1000: Authentication failed` — Prisma was talking to the *wrong* server. We
  mapped our container to host port **5433** (`'5433:5432'` in compose) to avoid
  the clash. Confirm with `docker ps` → PORTS should read `0.0.0.0:5433->5432/tcp`.
- **Use `127.0.0.1`, not `localhost`, in `DATABASE_URL`.** On Windows, `localhost`
  can resolve to IPv6 (`::1`) and gave `P1001: Can't reach database server`. Forcing
  IPv4 with `127.0.0.1:5433` fixed it.
- **Leftover orphan containers** (`backend-db-1`, `backend-redis-1`, …) from a prior
  compose setup in this folder were cleared with `docker compose down --remove-orphans`.

---

## Checkpoint

You're done with this phase when:
- `docker compose up -d` shows the container running, **and**
- `npx prisma migrate dev` succeeds and `prisma/migrations/` contains an `init`
  migration, **and**
- `npx prisma studio` shows four empty tables: User, Product, Conversation, Message.

Next phase: **Auth (JWT + role-based guards).**
