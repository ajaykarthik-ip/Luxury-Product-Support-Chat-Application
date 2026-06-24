# Load testing

Proves the **"scalability of chat handling"** evaluation criterion with real numbers
instead of claims. Two k6 scripts:

| Script | Tests | Headline number it produces |
|---|---|---|
| `rest.js` | REST API + DB-write path (login → list → **POST message**) | sustained requests/sec, p95 latency, error rate |
| `ws.js` | Real-time layer — many concurrent **Socket.IO** connections joining rooms and exchanging live messages | max stable concurrent chats, message **round-trip** p95 |

> **Why test the deployed t3.micro and not a laptop?** A laptop number isn't comparable —
> hardware varies. A **1 GB t3.micro is a fixed, documented spec**, so the number is
> reproducible and honest. That's the number worth reporting. (See `RESULTS.md`.)

## Prerequisites

1. **k6 installed** (you have it). Verify: `k6 version`.
2. **Demo data seeded** on the target so there are real conversations to hit:
   ```bash
   cd backend && npm run seed:demo   # 10 customers × 9 products
   ```
   Logins used by the scripts: `customer1..10@du.demo` / `demo1234`.

## Run

Against the deployed app (defaults already point there):

```bash
k6 run loadtest/rest.js
k6 run loadtest/ws.js
```

Tune via env vars (no file edits):

```bash
# push REST harder
k6 run -e VUS_MAX=200 loadtest/rest.js

# more concurrent sockets, longer hold
k6 run -e CONNS=500 -e SESSION_SECONDS=60 loadtest/ws.js

# point at local instead of prod
k6 run -e BASE_URL=http://127.0.0.1:3000 -e WS_URL=ws://127.0.0.1:3000 loadtest/ws.js

# save machine-readable summary to paste into RESULTS.md
k6 run --summary-export=loadtest/out-rest.json loadtest/rest.js
```

## The plan (gradual "find-the-ceiling" ramp)

Both scripts ramp gently so you discover where the box bends instead of slamming it:

```
warm-up → 25% → 50% → 100% (peak) → hold at peak → ramp down
```

The number you report is the **"hold at peak"** value where latency/errors stay stable.

1. **Warm up local first** (optional sanity check): `-e BASE_URL=http://127.0.0.1:3000 ...`
2. **SSH into the box** and watch it live in a second terminal:
   ```bash
   pm2 monit        # or: htop
   pm2 logs du-backend
   ```
3. **Run `rest.js`**, note where p95 climbs / errors appear → that's the REST ceiling.
4. **Run `ws.js`**, raise `-e CONNS=` step by step (100 → 300 → 500) until round-trip
   latency degrades or connections start failing → that's the concurrent-chat ceiling.
5. **Record the stable numbers** in `RESULTS.md`.
6. **`pm2 restart all`** so the demo is fresh for graders.

## Safety

- A `t3.micro` is **1 GB RAM + burstable CPU**, already running Postgres + 2 Node
  processes. Under heavy load it will throttle, swap, and may OOM-kill a process.
- **Ramp gradually**, watch `pm2 monit`, and **stop early** if memory is exhausting.
- **Don't run this right before submission** or while a grader might be testing the URL.
- Cleanest option to avoid any risk to the live demo: spin up a **disposable second
  t3.micro** (free-tier hours), deploy there, load test it, then terminate it. Same
  standardized spec, zero risk to your demo URL.
- Always `pm2 restart all` afterwards.

## Interpreting the result

The winning framing pairs the small-box number with the horizontal-scale design:

> On a single 1 GB t3.micro the app sustained **~N concurrent chats** at **p95 X ms**
> round-trip. Because the backend is stateless and uses one room per conversation,
> that ceiling lifts roughly linearly behind a load balancer + the Socket.IO Redis
> adapter (presence moves to Redis too).

Fill the real numbers into `RESULTS.md` and copy that paragraph into the architecture
write-up in `backend/docs/`.
