// WebSocket (Socket.IO) load test — k6
// -----------------------------------------------------------------------------
// This is the headline test for "scalability of chat handling". It opens many
// concurrent Socket.IO connections, each joins a conversation room and sends
// messages on an interval, and measures the live round-trip:
//     send `message:send`  ->  receive own `message:new`  =  round-trip latency
//
// k6 speaks raw WebSocket, so we hand-frame the Socket.IO / Engine.IO protocol.
// Your gateway accepts the JWT as a query param (?token=), which keeps this simple
// (no CONNECT-packet auth needed).
//
// Engine.IO / Socket.IO frames we use:
//   "0{...}"  server OPEN     -> we reply "40"   (connect default namespace)
//   "40{...}" server CONNECT ok -> we join the room + start sending
//   "2"       server PING      -> we reply "3"   (PONG, keeps the socket alive)
//   "42[...]" EVENT            -> ["message:new", {...}] etc.
//
// Run (against the deployed app):
//   k6 run loadtest/ws.js
//   k6 run -e WS_URL=wss://du.innoprojects.in -e CONNS=300 loadtest/ws.js
//   k6 run --summary-export=loadtest/out-ws.json loadtest/ws.js
//
// Safety: gentle, gradual ramp by default. Watch `htop` / `pm2 monit` on the box;
// `pm2 restart all` afterwards. Don't run this while a grader might be testing.
// -----------------------------------------------------------------------------
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const REST = __ENV.BASE_URL || 'https://du.innoprojects.in/api';
const WS_BASE = __ENV.WS_URL || 'wss://du.innoprojects.in';
const PASSWORD = __ENV.PASSWORD || 'demo1234';
const DEMO_USERS = parseInt(__ENV.DEMO_USERS || '10', 10);
const CONNS = parseInt(__ENV.CONNS || '200', 10); // peak concurrent connections
const SESSION_SECONDS = parseInt(__ENV.SESSION_SECONDS || '30', 10);
const SEND_EVERY_MS = parseInt(__ENV.SEND_EVERY_MS || '3000', 10);

const rtt = new Trend('ws_round_trip', true); // send -> own message:new
const sent = new Counter('ws_messages_sent');
const received = new Counter('ws_messages_received');
const connErrors = new Counter('ws_connect_errors');

export const options = {
  stages: [
    { duration: '30s', target: Math.ceil(CONNS * 0.1) },
    { duration: '1m', target: Math.ceil(CONNS * 0.25) },
    { duration: '1m', target: Math.ceil(CONNS * 0.5) },
    { duration: '1m', target: CONNS }, // peak
    { duration: '1m', target: CONNS }, // hold — this is your "sustained N"
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    ws_round_trip: ['p(95)<1000'], // 95% of live deliveries under 1s
    ws_connect_errors: ['count<10'],
  },
};

// Reuse the REST setup pattern: build (token, conversationId) pairs.
export function setup() {
  const sessions = [];
  for (let i = 1; i <= DEMO_USERS; i++) {
    const email = `customer${i}@du.demo`;
    const login = http.post(
      `${REST}/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (login.status !== 200) continue;
    const token = login.json('accessToken');
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const res = http.get(`${REST}/conversations`, auth);
    if (res.status !== 200) continue;
    const body = res.json();
    const list = Array.isArray(body) ? body : body.items || [];
    // Spread load across ALL of this customer's conversations (one room each),
    // not just list[0]. Otherwise every VU for a customer crams into a single
    // room — an artificial ~100-per-room fan-out that doesn't reflect real usage
    // (~2 people per conversation). More rooms = realistic fan-out under load.
    if (token) {
      for (const conv of list) sessions.push({ token, convId: conv.id });
    }
  }
  if (sessions.length === 0) {
    throw new Error('No sessions — run `npm run seed:demo` first.');
  }
  console.log(`Prepared ${sessions.length} sessions for WS test.`);
  return { sessions };
}

export default function (data) {
  const s = data.sessions[__VU % data.sessions.length];
  const url = `${WS_BASE}/socket.io/?EIO=4&transport=websocket&token=${encodeURIComponent(s.token)}`;
  const sentAt = {}; // content nonce -> send timestamp

  const res = ws.connect(url, {}, function (socket) {
    let counter = 0;

    socket.on('message', function (msg) {
      // Engine.IO OPEN -> connect the default Socket.IO namespace.
      if (msg[0] === '0') {
        socket.send('40');
        return;
      }
      // Engine.IO PING -> PONG (keep-alive).
      if (msg === '2') {
        socket.send('3');
        return;
      }
      // Socket.IO CONNECT ack -> join the room, then start sending.
      if (msg.startsWith('40')) {
        socket.send(`42["conversation:join",{"conversationId":"${s.convId}"}]`);
        socket.setInterval(function () {
          counter++;
          const content = `wslt-${__VU}-${counter}-${Date.now()}`;
          sentAt[content] = Date.now();
          socket.send(
            `42["message:send",{"conversationId":"${s.convId}","content":"${content}"}]`,
          );
          sent.add(1);
        }, SEND_EVERY_MS);
        return;
      }
      // Socket.IO EVENT -> look for our own message:new echo to time the round-trip.
      if (msg.startsWith('42')) {
        try {
          const [event, payload] = JSON.parse(msg.slice(2));
          if (event === 'message:new' && payload && sentAt[payload.content]) {
            rtt.add(Date.now() - sentAt[payload.content]);
            received.add(1);
            delete sentAt[payload.content];
          }
        } catch (_) {
          // ignore non-JSON / unrelated frames
        }
      }
    });

    socket.on('error', function () {
      connErrors.add(1);
    });

    // Hold the connection for the session, then close cleanly.
    socket.setTimeout(function () {
      socket.close();
    }, SESSION_SECONDS * 1000);
  });

  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
}
