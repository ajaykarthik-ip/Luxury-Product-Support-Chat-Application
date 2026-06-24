# Load test results

Target: **`https://du.innoprojects.in`** — AWS EC2 **t3.micro** (2 vCPU burstable, 1 GB RAM),
native PostgreSQL + 2 PM2 Node processes + nginx.

> Fill these in after each run. The number that matters is the **"hold at peak"** value
> where latency and error rate stay stable — that's the sustainable ceiling, not the
> momentary spike.

## REST (`rest.js`)

Command: `k6 run loadtest/rest.js` (peak VUs = `VUS_MAX`, default 100)

| Metric | Expected (rough, for a 1 GB box) | Measured |
|---|---|---|
| Peak VUs held | 100 | _____ |
| Requests / sec | 150–400 | _____ |
| `http_req_duration` p95 | < 800 ms | _____ |
| `http_req_duration` p99 | < 1500 ms | _____ |
| `rest_post_message` p95 (DB write) | < 800 ms | _____ |
| Error rate (`http_req_failed`) | < 2% | _____ |
| Where it started degrading | — | _____ VUs |

## WebSocket / real-time (`ws.js`)

Command: `k6 run -e CONNS=300 loadtest/ws.js`

| Metric | Expected (rough) | Measured |
|---|---|---|
| Peak concurrent connections held | 300 | _____ |
| Successful handshakes (101) | ~100% | _____ |
| `ws_round_trip` p50 (send → own message:new) | < 150 ms | _____ |
| `ws_round_trip` p95 | < 1000 ms | _____ |
| Messages sent / received (delivery ratio) | ~1:1 | _____ |
| `ws_connect_errors` | 0 | _____ |
| Max **stable** concurrent chats before degrade | — | _____ |

## Server-side observations (from `pm2 monit` / `htop` during the hold)

| | At peak |
|---|---|
| CPU % (and burst credits draining?) | _____ |
| Memory used / swap | _____ |
| Any process restarts / OOM | _____ |

## Headline (paste into `backend/docs/` architecture write-up)

> On a single 1 GB t3.micro the app sustained **~_____ concurrent chats** at
> **p95 _____ ms** round-trip and **_____ messages/sec** over REST, with **<__%** errors.
> Because the backend is stateless and uses one room per conversation, that ceiling
> lifts roughly linearly behind a load balancer + the Socket.IO Redis adapter — the
> per-conversation room model itself does not change.

## Run log

| Date | Script | Peak | p95 | Errors | Notes |
|---|---|---|---|---|---|
| | | | | | |
