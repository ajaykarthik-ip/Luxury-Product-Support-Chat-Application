/**
 * Real-time test for the Socket.IO chat gateway.
 *
 * Run the backend first, then:
 *   node scripts/test-ws.mjs
 *
 * Requires socket.io-client (dev dependency):
 *   npm install -D socket.io-client
 *
 * What it proves: a message sent by the customer's socket is delivered LIVE to
 * the agent's socket (and vice-versa) via the conversation room — the core
 * real-time requirement.
 */
import { io } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail ? `— ${detail}` : ''}`);
  }
}

async function rest(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json().catch(() => null);
}

async function login(email, password) {
  const r = await rest('POST', '/auth/login', { body: { email, password } });
  return r.accessToken;
}

// Connect a socket and wait until it's ready (or rejected).
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false, // a rejected token shouldn't retry in the background
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (e) => reject(e));
    setTimeout(() => reject(new Error('connect timeout')), 4000);
  });
}

// Wait for a specific event once, with a timeout.
function waitFor(socket, event, ms = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  console.log(`\nTesting WebSocket at ${BASE}\n`);

  // Reuse the users/products/conversation created by the REST seed flow.
  const agentToken = await login('agent@test.com', 'secret123');
  const customerToken = await login('bob@test.com', 'secret123');

  // Ensure there's a product + conversation to talk in.
  const products = await rest('GET', '/products', { token: customerToken });
  const productId = products?.[0]?.id;
  const convo = await rest('POST', '/conversations', {
    token: customerToken,
    body: { productId },
  });
  const conversationId = convo.id;
  console.log(`Using conversation ${conversationId}\n`);

  console.log('Connection & auth');
  // 1. Unauthorized connection is rejected.
  let rejected = false;
  try {
    await connect('garbage-token');
  } catch {
    rejected = true;
  }
  check('connection with bad token is rejected', rejected);

  // 2. Valid connections.
  const customer = await connect(customerToken);
  const agent = await connect(agentToken);
  check('customer socket connected', customer.connected);
  check('agent socket connected', agent.connected);

  console.log('\nRooms & real-time delivery');
  // 3. Both join the conversation room (server replies with conversation:joined).
  const cJoined = waitFor(customer, 'conversation:joined');
  customer.emit('conversation:join', { conversationId });
  const cJoin = await cJoined;
  check('customer joined room', cJoin?.conversationId === conversationId);

  const aJoined = waitFor(agent, 'conversation:joined');
  agent.emit('conversation:join', { conversationId });
  const aJoin = await aJoined;
  check('agent joined room', aJoin?.conversationId === conversationId);

  // 4. Agent listens; customer sends; agent must receive it live.
  const agentReceives = waitFor(agent, 'message:new');
  customer.emit('message:send', {
    conversationId,
    content: 'Real-time hello from customer',
  });
  const received = await agentReceives;
  check(
    'agent receives customer message in real time',
    received?.content === 'Real-time hello from customer',
    received ? `got "${received.content}"` : 'nothing received',
  );
  check('delivered message has sender info', !!received?.sender?.name);

  // 5. Reverse direction: agent → customer.
  const customerReceives = waitFor(customer, 'message:new');
  agent.emit('message:send', {
    conversationId,
    content: 'Agent replying live',
  });
  const back = await customerReceives;
  check('customer receives agent reply in real time', back?.content === 'Agent replying live');

  customer.close();
  agent.close();

  console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n\x1b[31mWS test crashed:\x1b[0m', err.message);
  console.error('Is the backend running, and did the REST seed run first?');
  process.exit(1);
});
