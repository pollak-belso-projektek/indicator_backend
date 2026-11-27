import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mapUserPermissions } from '../utils/permissions.js';

const users = {
  'tok-dev': { id: 'dev', permissionsDetails: mapUserPermissions(31) },
  'tok-hszc': { id: 'hszc', permissionsDetails: mapUserPermissions(15) },
  'tok-school': { id: 'school', permissionsDetails: mapUserPermissions(4), alapadatokId: 'a' },
};
const dbUsers = { target: { id: 'target', permissionsDetails: mapUserPermissions(4), alapadatokId: 'b' } };
mock.module('../utils/tokenClient.js', {
  namedExports: {
    getUserFromToken: async token => users[token] ?? null,
    refreshAccessToken: async () => null,
  },
});
const getById = mock.fn(async id => dbUsers[id] ?? null);
mock.module('../services/user.service.js', { namedExports: { getById } });
const { authMiddleware } = await import('../middleware/auth.middleware.js');

beforeEach(() => getById.mock.resetCalls());

async function run(headers = {}, method = 'GET') {
  const req = { method, headers };
  let status = null;
  let body = null;
  let nextCalled = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; }, setHeader() {} };
  await authMiddleware(req, res, () => { nextCalled = true; });
  return { req, status, body, nextCalled };
}
const auth = token => ({ authorization: `Bearer ${token}` });

test('CORS preflight passes without a token', async () => {
  assert.equal((await run({}, 'OPTIONS')).nextCalled, true);
});
for (const [name, headers] of [['missing header', {}], ['no token after Bearer', { authorization: 'Bearer' }], ['unknown token', auth('nope')]]) {
  test(`${name} -> 401`, async () => {
    const r = await run(headers);
    assert.equal(r.status, 401);
    assert.equal(r.nextCalled, false);
  });
}
test('valid token sets req.user', async () => {
  const r = await run(auth('tok-school'));
  assert.equal(r.nextCalled, true);
  assert.equal(r.req.user.id, 'school');
  assert.equal(r.req.impersonator, undefined);
});

// --- Alias mode (x-impersonate-user) ---------------------------------------
test('developer can impersonate: acts as target, real user kept as impersonator', async () => {
  const r = await run({ ...auth('tok-dev'), 'x-impersonate-user': 'target' });
  assert.equal(r.req.user.id, 'target');
  assert.equal(r.req.impersonator.id, 'dev');
});
for (const token of ['tok-hszc', 'tok-school']) {
  test(`${token} cannot impersonate (header ignored, no lookup)`, async () => {
    const r = await run({ ...auth(token), 'x-impersonate-user': 'target' });
    assert.equal(r.nextCalled, true);
    assert.equal(r.req.user, users[token]);
    assert.equal(r.req.impersonator, undefined);
    assert.equal(getById.mock.callCount(), 0);
  });
}
test('impersonating an unknown user keeps the developer identity', async () => {
  const r = await run({ ...auth('tok-dev'), 'x-impersonate-user': 'missing' });
  assert.equal(r.req.user.id, 'dev');
  assert.equal(r.req.impersonator, undefined);
});
test('impersonating with an invalid token is still 401', async () => {
  const r = await run({ ...auth('nope'), 'x-impersonate-user': 'target' });
  assert.equal(r.status, 401);
});
