# Luxury Product Support Chat

Real-time product support chat application. Customers chat with support agents about
specific products; **each customer–product pair is its own conversation**. Built as a
take-home assignment, so **code quality is a graded criterion** — keep code clean,
well-structured, and follow framework conventions.

> The developer is learning NestJS. When generating backend code, **explain the
> reasoning** (why a module/provider/decorator is used, not just what to type).

## Assignment Requirements (source of truth)

**Customer side:** list products; each has a "Chat with Agent" option; a *separate*
chat session per product; two products → two independent conversations; real-time
messages.
**Agent side:** view & respond to all active chats; each product conversation is a
separate thread (10 customers × 2 products = 20 conversations); real-time messages.
**Technical:** Next.js + NestJS; WebSockets (Socket.IO); messages stored in DB;
auth for Customer & Agent.
**Deliverables:** source repo; setup instructions (README); DB schema/design;
architecture & design-decisions writeup (→ our `backend/docs/`).
**Evaluation:** code quality & structure · real-time impl · DB design · **scalability
of chat handling** · UI/UX.
**Submission:** 2–3 days; deploy on AWS EC2 free tier; share deployed URL + GitHub
repo link (README with setup).

## Stack

- **Backend:** NestJS (REST + WebSocket in one standalone service)
- **Frontend:** Next.js (separate app)
- **Database:** PostgreSQL, run via Docker
- **ORM:** Prisma
- **Real-time:** Socket.IO (WebSockets)
- **Auth:** JWT
- **Deploy target:** AWS EC2 free tier

## Architecture

- Standalone NestJS backend exposing both a REST API and a WebSocket gateway.
- Separate Next.js frontend that talks to the backend over REST + Socket.IO.
- Two user roles: `CUSTOMER` and `AGENT`.

## Data Model

Four Prisma models:

- **User** — has a `role` enum (`CUSTOMER` | `AGENT`).
- **Product** — the item a conversation is about.
- **Conversation** — one per (customer, product) pair.
  **`@@unique([customerId, productId])` is core to the design** — it enforces exactly
  one conversation per customer–product pair. Preserve this constraint.
- **Message** — belongs to a conversation, sent by a user.

## Conventions

- Follow NestJS best practices: module / controller / service structure, dependency
  injection, DTOs with validation.
- Explain reasoning when generating code (developer is learning NestJS).
- Keep code clean and well-structured — quality is graded.

## Project Layout

- `backend/` — NestJS app (REST + WebSocket).
- `frontend/` — Next.js 16 app (App Router, React 19, Tailwind v4, TS).

## Frontend Notes

- **Run on a different port** — backend owns 3000: `npm run dev -- -p 3001`.
- Reads backend URL from `frontend/.env.local` (`NEXT_PUBLIC_API_URL`).
- Next 16: `params` is a Promise → client pages use the `useParams()` hook.
  Turbopack is the default engine (no flag). See `frontend/docs/01-frontend.md`.
- Shared real-time logic lives in `src/components/ChatWindow.tsx`; REST/socket
  helpers + auth context in `src/lib/`.
- **Auth UX (our design choice, not specified by the assignment):** product catalog
  is public (browse without login); login required only when a customer starts a
  chat (intent saved + resumed after login). Separate portals — `/login` (customer)
  and `/agent/login` (agent) — so neither sees the other's role. `GET /products` is
  `@Public()` on the backend to enable this.

## Branding & Seed

- App brand is **"DU"** (monogram wordmark); UI mood is **light & airy, Apple-like**
  (white bg, big imagery, serif display headings via Playfair, generous whitespace).
- **Seed:** `backend/prisma/seed.ts` inserts 9 luxury products across **3 categories**
  (Timepieces, Handmade Bags, Leather Accessories — 3 each) with verified free
  Unsplash images. Idempotent (matches by name) and **resets the catalog**: removes
  any product not in the curated list (+ its conversations) — clears leftover
  `test:api` products. Run: `cd backend && npm run seed`. NOTE: `npm run test:api`
  re-creates test products; re-run `npm run seed` afterward to clean.
- **`Product.category`** field groups the catalog into sections. Clicking a product
  card opens a dedicated product page `frontend/src/app/product/[id]`; the "Chat with
  a specialist" CTA lives there. Catalog browsing is fully public (no forced login).
- Frontend renders product images with a plain `<img>` (object-cover) to avoid
  Next `<Image>` remote-domain config — noted as a deliberate trade-off.

## Local Database

- Postgres runs in Docker (`backend/docker-compose.yml`), mapped to **host port
  `5433`** (not 5432 — another Postgres occupies 5432 on this machine).
- `DATABASE_URL` uses **`127.0.0.1:5433`** (not `localhost` — IPv6 resolution caused
  `P1001` on Windows). Creds: `postgres` / `postgres`, db `luxury_chat`.
- Start DB: `docker compose up -d` · Inspect: `npx prisma studio`.

## Backend Commands

Run from `backend/`:

- `npm run start:dev` — dev server with watch
- `npm run build` — compile to `dist/`
- `npm run start:prod` — run compiled build
- `npm run lint` — ESLint with autofix
- `npm test` — Jest unit tests
- `npm run test:e2e` — end-to-end tests

## Current Progress

- [x] **Backend scaffolded** — fresh NestJS app in `backend/` (default `AppModule`/
      `AppController`/`AppService`, ESLint + Prettier + Jest configured).
- [x] **Prisma + PostgreSQL (Docker) setup** — `docker-compose.yml` (Postgres 16),
      `prisma/schema.prisma`, `src/prisma/` module+service, `ConfigModule` wired into
      `AppModule`, `.env`/`.env.example`. *(User runs install + `migrate dev` manually.)*
- [x] **Data model** — User, Product, Conversation, Message defined with the
      `@@unique([customerId, productId])` constraint. See `backend/docs/01-database-layer.md`.
- [x] **Auth (JWT) + role guards** — `src/users/` (UsersService) and `src/auth/`
      (register/login/me, bcryptjs hashing, JwtStrategy). Global `JwtAuthGuard`
      (secure-by-default, opt out with `@Public()`) + `RolesGuard` (`@Roles(...)`).
      Global `ValidationPipe` + CORS in `main.ts`. Uses **bcryptjs** (not bcrypt) to
      avoid native build issues. See `backend/docs/02-auth.md`.
- [x] **REST endpoints (products, conversations, messages)** — `src/products/`,
      `src/conversations/`, `src/messages/`. Core rule via `upsert` on
      `customerId_productId` (find-or-create). Role-aware listing (agent→all,
      customer→own), access control in `assertAccess()`. Message routes nested under
      `/conversations/:id/messages`. `MessagesService` kept standalone for WS reuse.
      Smoke test: `npm run test:api` (`scripts/test-api.mjs`) — **24/24 passing**.
      See `docs/03-rest-api.md`.
- [x] **Socket.IO gateway for real-time messaging** — `src/chat/` (`ChatGateway`).
      JWT verified on handshake; **one room per conversation** (`conversation:<id>`)
      for scalability; events `conversation:join/leave`, `message:send` →
      `message:new`. Reuses `MessagesService`/`ConversationsService` (same logic as
      REST). Test: `npm run test:ws` (`scripts/test-ws.mjs`) — **all passing**.
      See `docs/04-websockets.md`.
- [x] **Next.js frontend** — `frontend/` (Next 16, App Router, Tailwind v4). Auth
      context + REST/socket helpers in `src/lib/`; shared `ChatWindow` (history +
      live `message:new`); customer product list → `/chat/[id]`; agent two-pane
      dashboard. *(User runs `npm run dev -- -p 3001` + manual end-to-end check.)*
      See `frontend/docs/01-frontend.md`.
- [ ] AWS EC2 deployment.

> **Keep this section updated as each phase completes.**
