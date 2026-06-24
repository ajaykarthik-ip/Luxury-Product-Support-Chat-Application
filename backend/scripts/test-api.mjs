/**
 * End-to-end smoke test for the REST API.
 *
 * Run the backend first (`npm run start:dev`), then in another terminal:
 *   node scripts/test-api.mjs
 *
 * Uses Node's built-in fetch (Node 18+). No dependencies.
 * Override the target with:  API_URL=http://host:port node scripts/test-api.mjs
 */

const BASE = process.env.API_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail ? `— ${detail}` : ''}`);
  }
}

// Tiny fetch wrapper: returns { status, body }.
async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed = null;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

// Register, or log in if the email already exists. Returns { token, user }.
async function authUser({ email, password, name, role }) {
  const reg = await api('POST', '/auth/register', {
    body: { email, password, name, role },
  });
  if (reg.status === 201) {
    return { token: reg.body.accessToken, user: reg.body.user };
  }
  const login = await api('POST', '/auth/login', {
    body: { email, password },
  });
  return { token: login.body.accessToken, user: login.body.user };
}

async function main() {
  console.log(`\nTesting API at ${BASE}\n`);

  // --- Auth ---------------------------------------------------------------
  console.log('Auth');
  const agent = await authUser({
    email: 'agent@test.com',
    password: 'secret123',
    name: 'Agent Sam',
    role: 'AGENT',
  });
  check('agent has a token', !!agent.token);
  check('agent role is AGENT', agent.user?.role === 'AGENT');

  const customer = await authUser({
    email: 'bob@test.com',
    password: 'secret123',
    name: 'Bob',
    role: 'CUSTOMER',
  });
  check('customer has a token', !!customer.token);

  const other = await authUser({
    email: 'carol@test.com',
    password: 'secret123',
    name: 'Carol',
    role: 'CUSTOMER',
  });
  check('second customer has a token', !!other.token);

  const noToken = await api('GET', '/auth/me');
  check('GET /auth/me without token → 401', noToken.status === 401);

  const me = await api('GET', '/auth/me', { token: customer.token });
  check('GET /auth/me with token → user', me.body?.email === 'bob@test.com');

  const badLogin = await api('POST', '/auth/login', {
    body: { email: 'bob@test.com', password: 'wrong' },
  });
  check('login with wrong password → 401', badLogin.status === 401);

  // --- Products -----------------------------------------------------------
  console.log('\nProducts');
  const p1 = await api('POST', '/products', {
    token: agent.token,
    body: { name: 'Gold Watch', description: 'Luxury timepiece' },
  });
  check('agent creates product → 201', p1.status === 201, `got ${p1.status}`);

  const p2 = await api('POST', '/products', {
    token: agent.token,
    body: { name: 'Leather Bag' },
  });
  check('agent creates 2nd product → 201', p2.status === 201);

  const custCreate = await api('POST', '/products', {
    token: customer.token,
    body: { name: 'Hacky Product' },
  });
  check('customer creating product → 403', custCreate.status === 403, `got ${custCreate.status}`);

  const list = await api('GET', '/products', { token: customer.token });
  check('customer lists products', Array.isArray(list.body) && list.body.length >= 2);

  const product1Id = p1.body.id;
  const product2Id = p2.body.id;

  // --- Conversations (the core rule) -------------------------------------
  console.log('\nConversations');
  const conv1a = await api('POST', '/conversations', {
    token: customer.token,
    body: { productId: product1Id },
  });
  check('customer starts conversation → 201', conv1a.status === 201, `got ${conv1a.status}`);

  const conv1b = await api('POST', '/conversations', {
    token: customer.token,
    body: { productId: product1Id },
  });
  check(
    'same product again returns SAME conversation (find-or-create)',
    conv1a.body?.id === conv1b.body?.id,
    `${conv1a.body?.id} vs ${conv1b.body?.id}`,
  );

  const conv2 = await api('POST', '/conversations', {
    token: customer.token,
    body: { productId: product2Id },
  });
  check(
    'different product → DIFFERENT conversation',
    conv2.body?.id && conv2.body.id !== conv1a.body?.id,
  );

  const agentDenied = await api('POST', '/conversations', {
    token: agent.token,
    body: { productId: product1Id },
  });
  check('agent cannot start a conversation → 403', agentDenied.status === 403, `got ${agentDenied.status}`);

  const custList = await api('GET', '/conversations', { token: customer.token });
  // The list endpoint returns a paginated envelope: { items, total }.
  // Robust across repeated runs: assert the two we just created are present,
  // rather than an exact count (each run seeds fresh products → new conversations).
  const custItems = Array.isArray(custList.body?.items) ? custList.body.items : [];
  const custIds = custItems.map((c) => c.id);
  check(
    'customer sees own conversations (both just-created present)',
    custIds.includes(conv1a.body.id) && custIds.includes(conv2.body.id),
  );
  check(
    'customer only sees their OWN conversations',
    custItems.length > 0 &&
      custItems.every((c) => c.customer?.id === customer.user.id),
  );

  const agentList = await api('GET', '/conversations', { token: agent.token });
  check(
    'agent sees all conversations (≥2)',
    Array.isArray(agentList.body?.items) && agentList.body.items.length >= 2,
  );

  const convId = conv1a.body.id;
  const crossAccess = await api('GET', `/conversations/${convId}`, { token: other.token });
  check("other customer cannot read Bob's conversation → 403", crossAccess.status === 403, `got ${crossAccess.status}`);

  // --- Messages -----------------------------------------------------------
  console.log('\nMessages');
  const m1 = await api('POST', `/conversations/${convId}/messages`, {
    token: customer.token,
    body: { content: 'Hi, is this watch waterproof?' },
  });
  check('customer sends message → 201', m1.status === 201, `got ${m1.status}`);

  const m2 = await api('POST', `/conversations/${convId}/messages`, {
    token: agent.token,
    body: { content: 'Yes, up to 50m!' },
  });
  check('agent replies → 201', m2.status === 201);

  const history = await api('GET', `/conversations/${convId}/messages`, { token: customer.token });
  check('message history has 2 messages in order', Array.isArray(history.body) && history.body.length === 2);
  check(
    'messages ordered oldest-first',
    history.body?.[0]?.content?.startsWith('Hi') && history.body?.[1]?.content?.startsWith('Yes'),
  );

  const convAfter = await api('GET', `/conversations/${convId}`, { token: agent.token });
  check('conversation now shows assigned agent', convAfter.body?.agent?.email === 'agent@test.com');

  const emptyMsg = await api('POST', `/conversations/${convId}/messages`, {
    token: customer.token,
    body: { content: '' },
  });
  check('empty message rejected → 400', emptyMsg.status === 400, `got ${emptyMsg.status}`);

  // --- Summary ------------------------------------------------------------
  console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n\x1b[31mTest run crashed:\x1b[0m', err.message);
  console.error('Is the backend running at', BASE, '?');
  process.exit(1);
});
