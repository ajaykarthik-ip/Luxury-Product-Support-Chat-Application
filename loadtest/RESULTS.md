# Load test results

Target: **`https://du.innoprojects.in`** — AWS EC2 **t3.micro** (2 vCPU burstable, 1 GB RAM),
native PostgreSQL + 2 PM2 Node processes + nginx.

> Fill these in after each run. The number that matters is the **"hold at peak"** value
> where latency and error rate stay stable — that's the sustainable ceiling, not the
> momentary spike.

## REST (`rest.js`)

Command: `k6 run loadtest/rest.js` (peak VUs = `VUS_MAX`, default 100)

| Metric | Expected (rough, for a 1 GB box) | Measured (30 VUs) | Measured (100 VUs) |
|---|---|---|---|
| Peak VUs held | 100 | 30 | 100 |
| Requests / sec | 150–400 | 40.9 | 117.7 |
| `http_req_duration` p95 | < 800 ms | 49.9 ms | 233.3 ms |
| `http_req_duration` avg / med | — | 38.9 / 36.8 ms | 100.5 / 79.2 ms |
| `http_req_duration` max | — | 416 ms | 412 ms |
| `rest_post_message` p95 (DB write) | < 800 ms | 53.2 ms | 231.3 ms |
| Error rate (`http_req_failed`) | < 2% | 0.00% (0/12,383) | 0.00% (0/35,573) |
| Where it started degrading | — | not reached — p95 stays linear, 0 errors, ~116 MB / 1 GB used | |

## WebSocket / real-time (`ws.js`)

Command: `k6 run -e CONNS=300 loadtest/ws.js`

| Metric | Expected (rough) | Measured (300 conns) |
|---|---|---|
| Peak concurrent connections held | 300 | 300 |
| Successful handshakes (101) | ~100% | 100% (1,691 sessions) |
| `ws_round_trip` p50 (send → own message:new) | < 150 ms | 38 ms |
| `ws_round_trip` p95 | < 1000 ms | 56 ms |
| Messages sent / received (delivery ratio) | ~1:1 | 15,219 : 15,219 (perfect 1:1) |
| Total msgs delivered incl. room fan-out | — | 354,198 (~1,078/s) |
| `ws_connect_errors` | 0 | 0 |
| Max **stable** concurrent chats before degrade | — | not reached at 300 — backend ~114 MB / 1 GB, no restarts |

## Server-side observations (from `pm2 monit` / `htop` during the hold)

| | At peak (100 REST VUs / 300 WS conns) |
|---|---|
| CPU % (and burst credits draining?) | comfortable — no sustained 100% pinning observed |
| Memory used / swap | backend ~114–116 MB, frontend ~147 MB (of 1 GB total); swap not pressured |
| Any process restarts / OOM | none — Restarts stayed at 1 (deploy restart) throughout |

## Headline (paste into `backend/docs/` architecture write-up)

> After tuning nginx (`worker_connections` 768 → 16384, `worker_rlimit_nofile`),
> OS file descriptors, and kernel accept-queue limits, a single 1 GB t3.micro
> sustained **1000 concurrent live WebSocket connections** at a realistic chat rate
> (~4 msgs/min/user) with **p95 93 ms** round-trip (p50 61 ms), **99.9% handshake
> success**, and **0 connect errors** — 70k messages delivered at a perfect 1:1 ratio.
> At a deliberately punishing rate (20 msgs/min/user, ~11 sockets/room fan-out) the
> same 1000 connections still connect cleanly but latency degrades (p95 16 s) as the
> box becomes compute-bound — i.e. the ceiling is now CPU/RAM, not connection limits.
> The REST/DB path held **118 req/s at p95 233 ms with 0% errors** under 100 users.
> Because the backend is stateless and uses one room per conversation, capacity lifts
> roughly linearly behind a load balancer + the Socket.IO Redis adapter — the
> per-conversation room model itself does not change.

## Run log

| Date | Script | Peak | p95 | Errors | Notes |
|---|---|---|---|---|---|
| 2026-06-24 | rest.js | 30 VUs | 49.9 ms | 0% | baseline, box idle (~39 MiB heap) |
| 2026-06-24 | rest.js | 100 VUs | 233.3 ms | 0% | linear climb, no degrade; backend ~116 MB / 1 GB, Restarts stayed 1 |
| 2026-06-24 | ws.js | 300 conns | 56 ms (rtt) | 0% | clean — 100% handshakes, perfect 1:1 delivery, ~114 MB |
| 2026-06-24 | ws.js | 1000 conns | 7 s (rtt) | 96% handshake fail | **ceiling hit (pre-tuning).** ~100 conns/room → 1.8M msgs fan-out (5,450/s); also nginx default `worker_connections 768`. |
| 2026-06-25 | ws.js | 1000 conns | 16.6 s (rtt) | 99.7% handshake ok | **After OS/nginx tuning** (worker_connections 16384, FD limit 1M, kernel backlog) + test spread across all 90 rooms. Connections now succeed; latency still degrades at the punishing 20-msg/min rate — box is now compute-bound. |
| 2026-06-25 | ws.js | 1000 conns | **93 ms** (rtt) | **0 errors, 99.9% ok** | **Clean pass at realistic rate** (`SEND_EVERY_MS=15000`, ~4 msgs/min/user). p50 61 ms, max 775 ms, 70k msgs delivered 1:1. Single 1 GB t3.micro holds 1000 concurrent connections comfortably. |
