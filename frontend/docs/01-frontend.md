# Frontend — Next.js (App Router)

The customer + agent UI for the chat app. Talks to the NestJS backend over REST
(for history/auth/products) and Socket.IO (for live messages).

> **Brand:** "DU" monogram wordmark, light & airy Apple-like mood (white background,
> large product imagery, serif display headings, generous whitespace). Product images
> are seeded from free Unsplash photos (see `backend/prisma/seed.ts`, run
> `npm run seed` in `backend/`). Images render via a plain `<img>` (object-cover) to
> avoid Next `<Image>` remote-domain config — a deliberate simplicity trade-off.

> **Stack note:** scaffolded with **Next.js 16 / React 19**, App Router, TypeScript,
> Tailwind v4, `src/` dir, `@/*` alias. Turbopack is the default dev/build engine
> (no flag needed). In Next 16 the `params` prop is a Promise — in client component
> pages we read route params with the `useParams()` hook instead, which is synchronous.

---

## Run it (you run these)

```bash
# from frontend/
npm install            # if not already
npm run dev            # http://localhost:3000 by default...
```

⚠️ **Port clash:** the backend already uses **3000**. Start the frontend on another
port:

```bash
npm run dev -- -p 3001
```

Then open **http://localhost:3001**. The backend URL is read from
`.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:3000`).

Make sure the **backend is running** (`npm run start:dev` in `backend/`) and Postgres
is up.

---

## File map

```
src/
  lib/
    types.ts      # response shapes (JSON has no types across the wire)
    api.ts        # fetch wrapper: attaches JWT, throws on non-2xx
    auth.tsx      # AuthProvider context + useAuth + useRequireAuth guard
    socket.ts     # single shared Socket.IO connection (getSocket/disconnect)
  components/
    AppHeader.tsx # brand bar + user menu + sign out
    AuthForm.tsx  # shared sign-in/register form (role fixed per portal)
    ChatWindow.tsx# THE real-time panel (history + join room + live messages)
  app/
    layout.tsx              # fonts + <AuthProvider>
    page.tsx                # redirect by auth/role
    login/page.tsx          # CUSTOMER portal (register = CUSTOMER)
    products/page.tsx       # PUBLIC L1: category tiles
    category/[slug]/page.tsx# PUBLIC L2: products in a category
    product/[id]/page.tsx   # PUBLIC L3: support page (topics + Contact Options)
    chat/[conversationId]/  # CUSTOMER: single conversation view
    agent/login/page.tsx    # AGENT portal (register = AGENT)
    agent/page.tsx          # AGENT: all threads (left) + live chat (right)
```

### Separate portals (UX decision)
Customers and agents sign in on **separate routes** — `/login` and `/agent/login` —
so neither sees the other's role option (no confusing role picker). Both use the
shared `AuthForm`; only the *register* role differs per page. **Login is universal**
(the backend returns the user's real role and we route accordingly). Each page
cross-links to the other.

---

## How the pieces fit

### Auth
`AuthProvider` (in `layout.tsx`) keeps the JWT + user in React state and
`localStorage`, so a refresh keeps you signed in. `useRequireAuth(role?)` is a
client-side guard: redirects to `/login` if signed out, or to your own home if you
open a page for the wrong role. (The backend enforces the real security; this is
just UX.)

### REST vs WebSocket
- **REST** (`lib/api.ts`) for things that aren't live: login/register, product list,
  starting a conversation, loading message **history**.
- **Socket.IO** (`lib/socket.ts`) for live messaging. One shared connection; we
  `conversation:join` a room per open chat and listen for `message:new`.

### The chat flow (ChatWindow)
1. On open → `GET /conversations/:id/messages` for history.
2. `emit('conversation:join', { conversationId })`.
3. `on('message:new')` → append (dedup by id).
4. Composer `emit('message:send', { conversationId, content })`.

The server broadcasts the saved message back to the whole room — including the
sender — so the UI always renders DB-truth, no optimistic guesswork.

### Customer journey (Apple-Support style)
Three public levels, no login to browse:
1. **`/products`** — pick a **category** (Timepieces / Handmade Bags / Leather
   Accessories) as image tiles.
2. **`/category/[slug]`** — the 3 products in that category.
3. **`/product/[id]`** — the **support page**, with:
   - **Topic chips** (Warranty, Sizing, Repairs, …) that pre-fill the request, and
   - **Contact Options** (Apple-style cards):
     - **💬 Live Chat** ("Available now") → `POST /conversations` (find-or-create) →
       `/chat/:id` (the chosen topic pre-fills the composer via a `?draft=` query).
     - **📞 Request a Callback** → a short "describe your issue" form → starts the
       conversation and posts the issue as the first message (REST `sendMessage`),
       then shows a confirmation. The agent sees it like any conversation.

Login is required only on **action** (chat or callback). A logged-out click stashes
the product id and resumes after sign-in. Opening the same product again reuses the
same conversation (the backend's `(customerId, productId)` unique rule). Both help
paths funnel into that one per-product conversation.

> UX rationale: browse-freely-then-sign-in-at-action mirrors e-commerce. Agents, by
> contrast, must sign in first (their dashboard has no public content).

### Agent journey
`/agent/login` → `/agent` → left pane lists **all** conversations (the backend
returns all for agents); click one → right pane opens the live `ChatWindow`. The
`+ Product` button seeds products via `POST /products` (agent-only).

---

## Known simplifications (honest notes)
- **Agent thread list isn't live-updated** for conversations that aren't open — the
  agent only joins the selected room. Refresh (↻) re-fetches. A fuller version would
  join all rooms or use a per-agent notification channel. Noted as a future
  enhancement (ties into the "scalability" discussion).
- Auth guard is client-side for UX; the **backend** is the real authority.

### Checkpoint — done when:
- You can register a customer + an agent, sign in as each (two browsers / one
  incognito).
- Customer starts a chat from a product; agent sees it in their list.
- A message typed by one appears **instantly** for the other.
