import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import endpointAccess from '../middleware/endpointAccess.middleware.js';
import { mapUserPermissions, mapTableAccess } from '../utils/permissions.js';

const create = mock.fn(async () => ({}));
mock.module('../services/user.service.js', {
  namedExports: Object.fromEntries([
    'create', 'getAll', 'update', 'getAllFiltered', 'updatePassword',
    'inactivateUser', 'updatePersonalInformation', 'getById',
  ].map(name => [name, name === 'create' ? create : async () => ({})])),
});
const { default: usersRouter } = await import('../controllers/user.controller.js');
const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherSchool = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const roles = [1, 2, 4, 9, 10, 15, 31];
const actors = Object.fromEntries(roles.map(role => [role, {
  id: `actor-${role}`, permissions: role, permissionsDetails: mapUserPermissions(role),
  alapadatokId: school,
  tableAccess: [{ tableName: 'user', permissionsDetails: mapTableAccess(15) }],
}]));
actors.readOnly = { ...actors[1], tableAccess: [{ tableName: 'user', permissionsDetails: mapTableAccess(1) }] };
actors.noSchool = { ...actors[4], alapadatokId: null };
actors.noTables = { ...actors[4], tableAccess: [] };
actors.unrelatedTable = { ...actors[1], tableAccess: [{ tableName: 'tanulo_letszam', permissionsDetails: mapTableAccess(15) }] };

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = actors[req.headers['x-test-actor']]; next(); });
  // Matches production: /me is authenticated separately from endpoint permissions.
  app.get('/api/v1/me/personal', (req, res) => res.sendStatus(req.user ? 200 : 401));
  app.use('/api/v1', endpointAccess);
  app.use('/api/v1/users', usersRouter);
  server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => create.mock.resetCalls());

async function post(actor, overrides = {}, suffix = '') {
  return fetch(`${base}/api/v1/users/${suffix}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-actor': String(actor) },
    body: JSON.stringify({ name: 'Test', email: 'test@example.invalid', password: 'test-password', permissions: 1, alapadatokId: school, tableAccess: [], ...overrides }),
  });
}

for (const actor of roles) {
  for (const target of roles) {
    const allowed = actor === 31 || (actor === 15 && [1, 2, 4, 9, 10].includes(target)) || (actor === 4 && [1, 2, 4].includes(target));
    test(`role ${actor} creating role ${target}: ${allowed ? 'allowed' : 'forbidden'}`, async () => {
      const response = await post(actor, { permissions: target });
      assert.equal(response.status, allowed ? 201 : 403);
      assert.equal(create.mock.callCount(), allowed ? 1 : 0);
      if (allowed) assert.equal(create.mock.calls[0].arguments[3], target);
    });
  }
}

for (const value of [null, '', 0, 3, 16, 32, -1, '31', {}, []]) {
  test(`invalid target role ${JSON.stringify(value)} is rejected even for developer`, async () => {
    assert.equal((await post(31, { permissions: value })).status, 400);
    assert.equal(create.mock.callCount(), 0);
  });
}
test('omitted role keeps default general type', async () => {
  assert.equal((await post(4, { permissions: undefined })).status, 201);
  assert.equal(create.mock.calls[0].arguments[3], 1);
});
for (const value of [undefined, null, school]) {
  test(`school admin persists own UUID with school ${String(value)}`, async () => {
    assert.equal((await post(4, { alapadatokId: value })).status, 201);
    assert.equal(create.mock.calls[0].arguments[5], school);
  });
}
for (const value of [otherSchool, '', 123, {}, []]) {
  test(`school admin cannot select school ${JSON.stringify(value)}`, async () => {
    assert.equal((await post(4, { alapadatokId: value })).status, 403);
    assert.equal(create.mock.callCount(), 0);
  });
}
test('school admin without assigned school is rejected', async () => {
  assert.equal((await post('noSchool', { alapadatokId: null })).status, 403);
  assert.equal(create.mock.callCount(), 0);
});
for (const actor of [15, 31]) {
  test(`central role ${actor} can select another school`, async () => {
    assert.equal((await post(actor, { alapadatokId: otherSchool })).status, 201);
    assert.equal(create.mock.calls[0].arguments[5], otherSchool);
  });
}
test('unauthenticated creation is rejected', async () => {
  assert.equal((await post('missing')).status, 401);
  assert.equal(create.mock.callCount(), 0);
});
test('admin still needs table create access', async () => {
  assert.equal((await post('noTables')).status, 403);
  assert.equal(create.mock.callCount(), 0);
});
for (const suffix of ['?me=1', '?name=test', '?tablelist=1', '?alapadatok=1']) {
  test(`query cannot bypass endpoint access: ${suffix}`, async () => {
    assert.equal((await post('readOnly', {}, suffix)).status, 403);
    assert.equal(create.mock.callCount(), 0);
  });
}
test('table name in query cannot grant access to users', async () => {
  assert.equal((await post('unrelatedTable', {}, '?table=tanulo_letszam')).status, 403);
  assert.equal(create.mock.callCount(), 0);
});
test('authenticated personal endpoint remains accessible', async () => {
  assert.equal((await fetch(`${base}/api/v1/me/personal`, { headers: { 'x-test-actor': 'readOnly' } })).status, 200);
});

for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`${method}: me in a path or query never bypasses table permissions`, () => {
    for (const url of ['/api/v1/munkavallalok_elismeresek', '/api/v1/unknown?me=1', '/api/v1/unknown?alapadatok=1']) {
      let status;
      let allowed = false;
      endpointAccess({ user: actors.readOnly, method, originalUrl: url }, {
        status(code) { status = code; return this; }, json() {},
      }, () => { allowed = true; });
      assert.equal(allowed, false);
      assert.equal(status, 403);
    }
  });
}

for (const [method, access] of [['GET', 1], ['POST', 2], ['PUT', 4], ['PATCH', 4], ['DELETE', 8]]) {
  test(`${method}: correct table permission still allows access`, () => {
    let allowed = false;
    endpointAccess({
      user: { ...actors[1], tableAccess: [{ tableName: 'munkavallalok_elismeresek', permissionsDetails: mapTableAccess(access) }] },
      method, originalUrl: '/api/v1/munkavallalok_elismeresek?name=test',
    }, { status() { assert.fail('valid permission was rejected'); } }, () => { allowed = true; });
    assert.equal(allowed, true);
  });
}
