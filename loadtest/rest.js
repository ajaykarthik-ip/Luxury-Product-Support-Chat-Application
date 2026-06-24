// REST load test — k6
// -----------------------------------------------------------------------------
// Exercises the REST half of the app the way a real customer does:
//   login -> browse products -> open a conversation -> post messages.
// This measures API throughput + the DB-write path (every POST inserts a Message
// and raises the message.created event).
//
// Run (against the deployed app):
//   k6 run loadtest/rest.js
//
// Tune without editing the file:
//   k6 run -e BASE_URL=https://du.innoprojects.in/api -e DEMO_USERS=10 loadtest/rest.js
//   k6 run -e VUS_MAX=200 loadtest/rest.js          # push harder
//   k6 run --summary-export=loadtest/out-rest.json loadtest/rest.js
//
// Safety: the default ramp is GENTLE so it finds the ceiling of a 1 GB t3.micro
// gradually instead of slamming it. Watch the server with `htop` / `pm2 monit`
// while it runs, and `pm2 restart all` afterwards.
// -----------------------------------------------------------------------------
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'https://du.innoprojects.in/api';
const PASSWORD = __ENV.PASSWORD || 'demo1234';
const DEMO_USERS = parseInt(__ENV.DEMO_USERS || '10', 10);
const VUS_MAX = parseInt(__ENV.VUS_MAX || '100', 10);

const postLatency = new Trend('rest_post_message', true);

export const options = {
  // Gradual ramp: warm up, climb, hold at peak, ramp down. Edit VUS_MAX to push.
  stages: [
    { duration: '30s', target: Math.ceil(VUS_MAX * 0.1) }, // warm up
    { duration: '1m', target: Math.ceil(VUS_MAX * 0.25) },
    { duration: '1m', target: Math.ceil(VUS_MAX * 0.5) },
    { duration: '1m', target: VUS_MAX }, // peak
    { duration: '1m', target: VUS_MAX }, // hold at peak (this is your "sustained" number)
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'], // <2% errors
    http_req_duration: ['p(95)<800'], // 95% of requests under 800ms
    rest_post_message: ['p(95)<800'],
  },
};

// --- setup(): runs ONCE. Log each demo customer in and find a conversation they
// own, so the VUs have valid (token, conversationId) pairs to hammer. -----------
export function setup() {
  const sessions = [];
  for (let i = 1; i <= DEMO_USERS; i++) {
    const email = `customer${i}@du.demo`;
    const login = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (login.status !== 200) {
      console.warn(`login failed for ${email}: ${login.status}`);
      continue;
    }
    const token = login.json('accessToken');
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Find a conversation this customer owns (the demo seed creates several).
    let convId = firstConversationId(http.get(`${BASE}/conversations`, auth));

    // Fallback: none yet -> open one against the first product.
    if (!convId) {
      const products = http.get(`${BASE}/products`);
      const productId = firstId(products);
      if (productId) {
        const conv = http.post(
          `${BASE}/conversations`,
          JSON.stringify({ productId }),
          { headers: { ...auth.headers, 'Content-Type': 'application/json' } },
        );
        convId = conv.json('id');
      }
    }

    if (token && convId) sessions.push({ token, convId });
  }

  if (sessions.length === 0) {
    throw new Error(
      'No usable sessions — is the demo seed loaded? Run `npm run seed:demo`.',
    );
  }
  console.log(`Prepared ${sessions.length} customer sessions.`);
  return { sessions };
}

// --- default(): one VU iteration = one customer doing a small burst. -----------
export default function (data) {
  const s = data.sessions[__VU % data.sessions.length];
  const auth = { headers: { Authorization: `Bearer ${s.token}` } };

  // Browse (public + own list).
  check(http.get(`${BASE}/products`), { 'products 200': (r) => r.status === 200 });
  check(http.get(`${BASE}/conversations`, auth), {
    'conversations 200': (r) => r.status === 200,
  });

  // The DB-write path: send a message.
  const res = http.post(
    `${BASE}/conversations/${s.convId}/messages`,
    JSON.stringify({ content: `load test ${__VU}-${__ITER} ${Date.now()}` }),
    { headers: { ...auth.headers, 'Content-Type': 'application/json' } },
  );
  postLatency.add(res.timings.duration);
  check(res, { 'message posted': (r) => r.status === 201 || r.status === 200 });

  sleep(1); // pacing — a real user doesn't fire continuously
}

// --- helpers -----------------------------------------------------------------
function firstConversationId(res) {
  if (res.status !== 200) return null;
  const body = res.json();
  const list = Array.isArray(body) ? body : body.items || [];
  return list.length ? list[0].id : null;
}
function firstId(res) {
  if (res.status !== 200) return null;
  const body = res.json();
  const list = Array.isArray(body) ? body : body.items || [];
  return list.length ? list[0].id : null;
}
