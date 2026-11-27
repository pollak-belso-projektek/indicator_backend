import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-access-secret';
const ISSUER = 'https://indicator-login-service.pollak.info';

let dbUser;
const getByEmail = mock.fn(async () => {
  if (dbUser instanceof Error) throw dbUser;
  return dbUser;
});
mock.module('../services/user.service.js', { namedExports: { getByEmail } });
mock.module('../utils/loginServiceClient.js', { namedExports: { loginServiceClient: { refresh: async () => null } } });

const cache = await import('../utils/cache.js');
const { getUserFromToken, verifyToken } = await import('../utils/tokenClient.js');

const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sign = (payload = {}, secret = 'test-access-secret', opts = {}) => jwt.sign(
  { email: 'a@example.invalid', name: 'A', permissions: { isAdmin: true }, ...payload },
  secret, { algorithm: 'HS256', issuer: ISSUER, subject: 'user-1', expiresIn: '15m', ...opts },
);

beforeEach(async () => {
  await cache.clear();
  getByEmail.mock.resetCalls();
  dbUser = { id: 'user-1', email: 'a@example.invalid', isActive: true, alapadatokId: school, permissions: 4, permissionsDetails: { isAdmin: true }, tableAccess: [] };
});

test('valid token returns the user merged with current database data', async () => {
  const user = await getUserFromToken(sign());
  assert.equal(user.id, 'user-1');
  assert.equal(user.alapadatokId, school);
  assert.deepEqual(user.permissionsDetails, { isAdmin: true });
  assert.deepEqual(user.tableAccess, []);
});
test('token subject wins over database id', async () => {
  dbUser.id = 'something-else';
  assert.equal((await getUserFromToken(sign())).id, 'user-1');
});

for (const [name, token] of [
  ['wrong secret', () => sign({}, 'attacker-secret')],
  ['wrong issuer', () => sign({}, 'test-access-secret', { issuer: 'https://evil.example' })],
  ['expired', () => sign({}, 'test-access-secret', { expiresIn: -10 })],
  ['unsigned (alg none)', () => jwt.sign({ email: 'a@example.invalid' }, '', { algorithm: 'none', issuer: ISSUER, subject: 'user-1' })],
  ['refresh token used as access token', () => sign({ type: 'refresh' }, 'refresh-secret')],
  ['garbage', () => 'not-a-jwt'],
]) {
  test(`${name} is rejected`, async () => {
    assert.equal(await getUserFromToken(token()), null);
  });
}

test('inactivated account is rejected even with a valid token', async () => {
  dbUser.isActive = false;
  assert.equal(await getUserFromToken(sign()), null);
});
test('deleted account is rejected even with a valid token', async () => {
  dbUser = null;
  assert.equal(await getUserFromToken(sign()), null);
});
test('database outage falls back to token data instead of locking everyone out', async () => {
  dbUser = new Error('db down');
  const user = await getUserFromToken(sign());
  assert.equal(user.id, 'user-1');
  assert.equal(user.permissionsDetails, undefined, 'no DB permissions -> every permission check denies');
});
test('user is cached per token', async () => {
  const token = sign();
  await getUserFromToken(token);
  await getUserFromToken(token);
  assert.equal(getByEmail.mock.callCount(), 1);
});
test('inactivation takes effect immediately once the token cache is invalidated', async () => {
  const token = sign();
  assert.ok(await getUserFromToken(token));
  dbUser = { ...dbUser, isActive: false };
  await cache.invalidate('users:*');
  await cache.invalidate('token:user:');
  assert.equal(await getUserFromToken(token), null);
});
test('verifyToken throws for an invalid token (callers must handle it)', async () => {
  await assert.rejects(verifyToken(sign({}, 'attacker-secret')));
});
