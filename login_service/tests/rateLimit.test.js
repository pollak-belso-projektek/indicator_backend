import { after, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.JWT_SECRET = 'access-secret';
// Fake service: password "pw" is correct, everything else fails.
const login = mock.fn(async (email, password) => {
  if (password !== 'pw') throw new Error('Hibás email vagy jelszó');
  return { accessToken: 't' };
});
const forgotPassword = mock.fn(async () => {});
mock.module('../services/auth.service.js', {
  namedExports: {
    login, forgotPassword, refresh: async () => ({}), googleLogin: async () => { throw new Error('x'); },
    generate2FA: async () => ({}), verify2FA: async () => { throw new Error('Hibás kód!'); }, disable2FA: async () => ({}),
  },
});
const { default: router } = await import('../controllers/auth.controller.js');

let server;
let base;
before(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/v1/auth', router);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

const post = (path, body, ip) => fetch(`${base}/api/v1/auth${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) },
  body: JSON.stringify(body),
});
const statuses = async (n, fn) => { const out = []; for (let i = 0; i < n; i++) out.push((await fn(i)).status); return out; };

test('10 failed logins on one account lock that account (per account limit)', async () => {
  const s = await statuses(11, i => post('/login', { email: 'victim@example.invalid', password: 'x' }, `198.51.100.${i}`));
  assert.deepEqual(s.slice(0, 10), Array(10).fill(401));
  assert.equal(s[10], 429, 'distributed guessing from many IPs is still stopped');
});
test('account lock is case-insensitive on the email', async () => {
  assert.equal((await post('/login', { email: 'VICTIM@example.invalid', password: 'pw' }, '198.51.100.200')).status, 429);
});
test('other accounts are not affected by one locked account', async () => {
  assert.equal((await post('/login', { email: 'other@example.invalid', password: 'pw' }, '198.51.100.201')).status, 200);
});
test('successful logins are not counted', async () => {
  const s = await statuses(15, () => post('/login', { email: 'ok@example.invalid', password: 'pw' }, '203.0.113.1'));
  assert.ok(s.every(x => x === 200), s.join(','));
});
test('30 failed attempts from one client lock that client (across accounts)', async () => {
  const s = await statuses(31, i => post('/login', { email: `spray${i}@example.invalid`, password: 'x' }, '203.0.113.50'));
  assert.deepEqual(s.slice(0, 30), Array(30).fill(401));
  assert.equal(s[30], 429);
});
test('a locked client does not lock out users behind the same proxy (cf-connecting-ip)', async () => {
  // Both requests arrive from the same proxy address; only the CF header differs.
  assert.equal((await post('/login', { email: 'fresh@example.invalid', password: 'pw' }, '203.0.113.51')).status, 200);
});
test('forgot password: 3 per hour per client, then 429; other clients unaffected', async () => {
  const s = await statuses(4, i => post('/forgot-password', { email: `f${i}@example.invalid` }, '192.0.2.10'));
  assert.deepEqual(s, [200, 200, 200, 429]);
  assert.equal((await post('/forgot-password', { email: 'g@example.invalid' }, '192.0.2.11')).status, 200);
});
test('forgot password: 3 per hour per email address, even from different clients', async () => {
  const s = await statuses(4, i => post('/forgot-password', { email: 'target@example.invalid' }, `192.0.2.${100 + i}`));
  assert.deepEqual(s, [200, 200, 200, 429]);
});
test('google login is limited per client', async () => {
  const s = await statuses(31, () => post('/google-login', { idToken: 'x' }, '192.0.2.200'));
  assert.equal(s[29], 401);
  assert.equal(s[30], 429);
});
