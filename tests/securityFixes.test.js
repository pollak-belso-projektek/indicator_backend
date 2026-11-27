import { after, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mapUserPermissions } from '../utils/permissions.js';
import { requireSuperadmin, referencesForeignSchool } from '../middleware/schoolScope.middleware.js';
import { runWithUser } from '../utils/requestContext.js';
import * as cache from '../utils/cache.js';

const changelogCreate = mock.fn(async () => ({ id: 1 }));
const changelogUpdate = mock.fn(async () => ({ id: 1 }));
const changelogRemove = mock.fn(async () => ({}));
mock.module('../services/changelog.service.js', {
  namedExports: { getAll: async () => [], create: changelogCreate, update: changelogUpdate, remove: changelogRemove },
});
const updateBugStatus = mock.fn(async () => ({}));
mock.module('../services/bugReport.service.js', {
  namedExports: { createBugReport: async () => ({}), getReportedBugs: async () => [], updateBugStatus, getBugAttachment: async () => ({}) },
});
mock.module('../services/log.service.js', { namedExports: { logRequest: async () => {} } });
mock.module('../utils/tokenClient.js', { namedExports: { getUserFromToken: async () => null } });

const { default: changelogRouter } = await import('../controllers/changelog.controller.js');
const { default: bugReportRouter } = await import('../controllers/bugReport.controller.js');
const { sanitizeHeaders, sanitizeRequestBody } = await import('../middleware/log.middleware.js');

const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherSchool = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const roles = [1, 2, 4, 9, 10, 15, 31];
const actors = Object.fromEntries(roles.map(r => [r, { id: `u${r}`, permissions: r, permissionsDetails: mapUserPermissions(r), alapadatokId: school }]));
// Developer impersonating a school admin (alias mode) and the reverse case.
actors.devAsSchool = { ...actors[4], impersonator: actors[31] };

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const a = actors[req.headers['x-test-actor']];
    if (a?.impersonator) { req.user = { ...a, impersonator: undefined }; req.impersonator = a.impersonator; } else req.user = a;
    next();
  });
  app.use('/logs', requireSuperadmin, (req, res) => res.json({ ok: true }));
  app.use('/cache', requireSuperadmin, (req, res) => res.json({ ok: true }));
  app.use('/changelog', changelogRouter);
  app.use('/bug-report', bugReportRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

const req = (actor, method, path, body) => fetch(`${base}${path}`, {
  method, headers: { 'Content-Type': 'application/json', 'x-test-actor': String(actor) },
  body: body ? JSON.stringify(body) : undefined,
});

// --- B: logs and cache are developer-only -----------------------------------
for (const path of ['/logs', '/logs/stats', '/logs/clear', '/cache/stats', '/cache/clear']) {
  for (const role of roles) {
    const allowed = role === 31;
    test(`${path} for role ${role}: ${allowed ? 'allowed' : 'forbidden'}`, async () => {
      const method = path.endsWith('clear') ? 'POST' : 'GET';
      assert.equal((await req(role, method, path)).status, allowed ? 200 : 403);
    });
  }
}
test('developer in alias mode keeps access to logs', async () => {
  assert.equal((await req('devAsSchool', 'GET', '/logs')).status, 200);
});
test('unauthenticated log access is rejected', async () => {
  assert.equal((await req('missing', 'GET', '/logs')).status, 401);
});

// --- A: changelog writes are developer-only ----------------------------------
for (const role of roles) {
  const allowed = role === 31;
  test(`changelog create/update/delete for role ${role}: ${allowed ? 'allowed' : 'forbidden'}`, async () => {
    changelogCreate.mock.resetCalls(); changelogUpdate.mock.resetCalls(); changelogRemove.mock.resetCalls();
    const body = { version: '1.0.0', title: 't', description: 'd', changes: [] };
    const statuses = [
      (await req(role, 'POST', '/changelog', body)).status,
      (await req(role, 'PUT', '/changelog/1', body)).status,
      (await req(role, 'DELETE', '/changelog/1')).status,
    ];
    if (allowed) assert.ok(statuses.every(s => s !== 403), `statuses ${statuses}`);
    else assert.deepEqual(statuses, [403, 403, 403]);
    const calls = changelogCreate.mock.callCount() + changelogUpdate.mock.callCount() + changelogRemove.mock.callCount();
    assert.equal(calls > 0, allowed);
  });
}
test('changelog stays readable for everyone', async () => {
  assert.equal((await req(1, 'GET', '/changelog')).status, 200);
});

// --- A: bug report status is developer-only (and works for developers) --------
for (const role of roles) {
  const allowed = role === 31;
  test(`bug status update for role ${role}: ${allowed ? 'allowed' : 'forbidden'}`, async () => {
    updateBugStatus.mock.resetCalls();
    const res = await req(role, 'PUT', '/bug-report/card1/status', { status: 'Kész' });
    assert.equal(res.status, allowed ? 200 : 403);
    assert.equal(updateBugStatus.mock.callCount(), allowed ? 1 : 0);
  });
}
test('invalid bug status is still rejected', async () => {
  assert.equal((await req(31, 'PUT', '/bug-report/card1/status', { status: 'x' })).status, 400);
});

// --- A: sensitive headers never reach the log ---------------------------------
test('auth, cookie, refresh token, api key and secret headers are redacted', () => {
  const out = sanitizeHeaders({
    authorization: 'Bearer a', cookie: 'c', 'x-refresh-token': 'r', 'x-api-key': 'k', 'x-gateway-secret': 's',
    'x-csrf-token': 't', 'proxy-authorization': 'p', 'content-type': 'application/json', 'x-impersonate-user': 'u',
  });
  for (const h of ['authorization', 'cookie', 'x-refresh-token', 'x-api-key', 'x-gateway-secret', 'x-csrf-token', 'proxy-authorization']) {
    assert.equal(out[h], '***REDACTED***', h);
  }
  assert.equal(out['content-type'], 'application/json');
  assert.equal(out['x-impersonate-user'], 'u');
});
test('passwords are redacted from logged bodies, including nested ones', () => {
  const out = sanitizeRequestBody({ newPassword: 'x', newPasswordConfirm: 'y', nested: [{ password: 'z', name: 'n' }] });
  assert.equal(out.newPassword, '***REDACTED***');
  assert.equal(out.newPasswordConfirm, '***REDACTED***');
  assert.equal(out.nested[0].password, '***REDACTED***');
  assert.equal(out.nested[0].name, 'n');
});

// --- Early foreign-school detection ------------------------------------------
const ids = new Set([school, otherSchool]);
const r = (url, query = {}, body = {}) => ({ originalUrl: url, query, body });
test('foreign school in path is detected', () => {
  assert.equal(referencesForeignSchool(r(`/api/v1/x/${otherSchool}/2025`), school, ids), true);
  assert.equal(referencesForeignSchool(r(`/api/v1/x/${school}/2025`), school, ids), false);
});
test('foreign school in query is detected', () => {
  assert.equal(referencesForeignSchool(r('/api/v1/x', { alapadatok_id: otherSchool }), school, ids), true);
  assert.equal(referencesForeignSchool(r('/api/v1/x', { a: [school, otherSchool] }), school, ids), true);
});
test('foreign school in body keys is detected, at any depth', () => {
  for (const body of [{ alapadatok_id: otherSchool }, { alapadatokId: otherSchool }, { rows: [{ alapadatok_id: school }, { alapadatok_id: otherSchool }] }]) {
    assert.equal(referencesForeignSchool(r('/api/v1/x', {}, body), school, ids), true, JSON.stringify(body));
  }
  assert.equal(referencesForeignSchool(r('/api/v1/x', {}, { rows: [{ alapadatok_id: school }] }), school, ids), false);
});
test('record ids and unrelated UUIDs are not mistaken for schools', () => {
  assert.equal(referencesForeignSchool(r('/api/v1/x/cccccccc-cccc-4ccc-8ccc-cccccccccccc'), school, ids), false);
});
test('null school in body is not treated as foreign', () => {
  assert.equal(referencesForeignSchool(r('/api/v1/x', {}, { alapadatokId: null }), school, ids), false);
});

// --- Cache namespacing ---------------------------------------------------------
const schoolUser = s => ({ permissionsDetails: mapUserPermissions(4), alapadatokId: s });
test('cache entries are separated per school and from unscoped requests', async () => {
  await cache.clear();
  await cache.set('k', 'global');
  await runWithUser(schoolUser(school), () => cache.set('k', 'A'));
  await runWithUser(schoolUser(otherSchool), () => cache.set('k', 'B'));
  assert.equal(await cache.get('k'), 'global');
  assert.equal(await runWithUser(schoolUser(school), () => cache.get('k')), 'A');
  assert.equal(await runWithUser(schoolUser(otherSchool), () => cache.get('k')), 'B');
  assert.equal(await runWithUser({ permissionsDetails: mapUserPermissions(15) }, () => cache.get('k')), 'global');
});
test('del and pattern invalidation clear every namespace', async () => {
  await cache.clear();
  await cache.set('svc:all:2025', 1);
  await runWithUser(schoolUser(school), () => cache.set('svc:all:2025', 2));
  await cache.del('svc:all:2025');
  assert.equal(await runWithUser(schoolUser(school), () => cache.get('svc:all:2025')), null);
  await runWithUser(schoolUser(school), () => cache.set('svc:byYear:2025', 3));
  await cache.set('svc:byYear:2025', 4);
  await runWithUser(schoolUser(otherSchool), () => cache.invalidate('svc:byYear.*'));
  assert.equal(await cache.get('svc:byYear:2025'), null);
  assert.equal(await runWithUser(schoolUser(school), () => cache.get('svc:byYear:2025')), null);
});
test('del does not remove keys that merely end with the same text', async () => {
  await cache.clear();
  await cache.set('xsvc:all', 1);
  await cache.del('svc:all');
  assert.equal(await cache.get('xsvc:all'), 1);
});
