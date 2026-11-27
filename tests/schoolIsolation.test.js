// End-to-end school isolation: real middleware -> real controller -> real service ->
// ServicePattern -> cache -> real Prisma school-scope extension -> in-memory store.
import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { createSchoolScopeExtension } from '../utils/schoolScope.js';
import { mapUserPermissions } from '../utils/permissions.js';
import * as cache from '../utils/cache.js';

const schoolA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const schoolB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rowA = 'a0000000-0000-4000-8000-000000000001';
const rowB = 'b0000000-0000-4000-8000-000000000001';

const tables = {};
const prisma = createFakePrisma(
  { dobbanto: 'Dobbanto', alapadatok: 'Alapadatok' },
  createSchoolScopeExtension({
    Dobbanto: { field: 'alapadatok_id', relation: 'alapadatok' },
    Alapadatok: { field: 'id', relation: null, isSchool: true },
  }),
  tables,
);
mock.module('../utils/prisma.js', { defaultExport: prisma });
mock.module('../services/form_history.service.js', { namedExports: { scheduleSnapshot: () => {} } });

const { default: dobbantoRouter } = await import('../controllers/dobbanto.controller.js');
const { createSchoolScopeMiddleware } = await import('../middleware/schoolScope.middleware.js');

const user = (role, school = schoolA) => ({ id: `u-${role}`, permissions: role, permissionsDetails: mapUserPermissions(role), alapadatokId: school });
const actors = {
  standard: user(1), privileged: user(2), schoolAdmin: user(4), schoolAdminB: user(4, schoolB),
  hszc: user(15, null), hszcReader: user(9, null), developer: user(31, null), noSchool: user(4, null),
};

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = actors[req.headers['x-test-actor']]; next(); });
  app.use(createSchoolScopeMiddleware({ loadSchoolIds: async () => [schoolA, schoolB] }));
  app.use('/api/v1/dobbanto', dobbantoRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(async () => {
  await cache.clear();
  tables.Dobbanto = [
    { id: rowA, alapadatok_id: schoolA, tanev_kezdete: 2025, dobbanto_szama: 1, tanulok_osszesen: 10 },
    { id: rowB, alapadatok_id: schoolB, tanev_kezdete: 2025, dobbanto_szama: 2, tanulok_osszesen: 20 },
  ];
});

const call = async (actor, method, path, body) => {
  const res = await fetch(`${base}/api/v1/dobbanto${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-test-actor': actor },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const schoolsIn = rows => [...new Set(rows.map(r => r.alapadatok_id))].sort();
const row = id => tables.Dobbanto.find(r => r.id === id);

// --- Reading ---------------------------------------------------------------
for (const actor of ['standard', 'privileged', 'schoolAdmin']) {
  test(`${actor}: "all schools" list only returns own school`, async () => {
    const { status, body } = await call(actor, 'GET', '/2025');
    assert.equal(status, 200);
    assert.deepEqual(schoolsIn(body), [schoolA]);
  });
  test(`${actor}: reading another school by id is forbidden`, async () => {
    assert.equal((await call(actor, 'GET', `/${schoolB}/2025`)).status, 403);
  });
  test(`${actor}: reading own school by id works`, async () => {
    const { status, body } = await call(actor, 'GET', `/${schoolA}/2025`);
    assert.equal(status, 200);
    assert.deepEqual(schoolsIn(body), [schoolA]);
  });
}
for (const actor of ['hszc', 'hszcReader', 'developer']) {
  test(`${actor}: sees every school`, async () => {
    const { status, body } = await call(actor, 'GET', '/2025');
    assert.equal(status, 200);
    assert.deepEqual(schoolsIn(body), [schoolA, schoolB]);
  });
  test(`${actor}: can read another school by id`, async () => {
    const { status, body } = await call(actor, 'GET', `/${schoolB}/2025`);
    assert.equal(status, 200);
    assert.deepEqual(schoolsIn(body), [schoolB]);
  });
}
test('school user without assigned school sees nothing', async () => {
  const { status, body } = await call('noSchool', 'GET', '/2025');
  assert.equal(status, 200);
  assert.deepEqual(body, []);
});

// --- Cache must not leak between scopes ----------------------------------------
test('list cached by a HSZC user is not served to a school user', async () => {
  assert.equal((await call('hszc', 'GET', '/2025')).body.length, 2);
  assert.deepEqual(schoolsIn((await call('schoolAdmin', 'GET', '/2025')).body), [schoolA]);
});
test('list cached by school A is not served to school B', async () => {
  assert.deepEqual(schoolsIn((await call('schoolAdmin', 'GET', '/2025')).body), [schoolA]);
  assert.deepEqual(schoolsIn((await call('schoolAdminB', 'GET', '/2025')).body), [schoolB]);
});
test('list cached by a school user does not hide rows from HSZC', async () => {
  await call('schoolAdmin', 'GET', '/2025');
  assert.equal((await call('hszc', 'GET', '/2025')).body.length, 2);
});
test("a school user's write invalidates the HSZC cache too", async () => {
  await call('hszc', 'GET', '/2025');
  await call('schoolAdmin', 'POST', '/', { alapadatok_id: schoolA, tanev_kezdete: 2025, dobbanto_szama: 5, tanulok_osszesen: 50 });
  assert.equal((await call('hszc', 'GET', '/2025')).body.length, 3);
});

// --- Writing -----------------------------------------------------------------
const payload = (school) => ({ alapadatok_id: school, tanev_kezdete: 2025, dobbanto_szama: 9, tanulok_osszesen: 99 });

test('school admin can create for own school', async () => {
  assert.equal((await call('schoolAdmin', 'POST', '/', payload(schoolA))).status, 201);
  assert.equal(tables.Dobbanto.length, 3);
});
test('school admin cannot create for another school', async () => {
  assert.equal((await call('schoolAdmin', 'POST', '/', payload(schoolB))).status, 403);
  assert.equal(tables.Dobbanto.length, 2);
});
test('school admin can update own school row', async () => {
  assert.equal((await call('schoolAdmin', 'PUT', `/${rowA}`, payload(schoolA))).status, 200);
  assert.equal(row(rowA).dobbanto_szama, 9);
});
test("school admin cannot update another school's row (even claiming own school)", async () => {
  const { status } = await call('schoolAdmin', 'PUT', `/${rowB}`, payload(schoolA));
  assert.equal(status, 403);
  assert.equal(row(rowB).dobbanto_szama, 2);
  assert.equal(row(rowB).alapadatok_id, schoolB);
});
test('school admin cannot move own row to another school', async () => {
  assert.equal((await call('schoolAdmin', 'PUT', `/${rowA}`, payload(schoolB))).status, 403);
  assert.equal(row(rowA).alapadatok_id, schoolA);
});
test("school admin cannot delete another school's data", async () => {
  assert.equal((await call('schoolAdmin', 'DELETE', `/${schoolB}/2025`)).status, 403);
  assert.ok(row(rowB));
});
test('school admin can delete own school data', async () => {
  assert.equal((await call('schoolAdmin', 'DELETE', `/${schoolA}/2025`)).status, 204);
  assert.equal(row(rowA), undefined);
  assert.ok(row(rowB));
});
test("forbidden response does not leak the controller's internal error", async () => {
  const { body } = await call('schoolAdmin', 'PUT', `/${rowB}`, payload(schoolA));
  assert.deepEqual(body, { message: 'Nincs jogosultságod más iskola adataihoz!' });
});
for (const actor of ['hszc', 'developer']) {
  test(`${actor} can write any school`, async () => {
    assert.equal((await call(actor, 'POST', '/', payload(schoolB))).status, 201);
    assert.equal((await call(actor, 'PUT', `/${rowB}`, payload(schoolB))).status, 200);
    assert.equal((await call(actor, 'DELETE', `/${schoolA}/2025`)).status, 204);
  });
}
test('genuine server errors for unscoped users stay 500', async () => {
  const { status } = await call('developer', 'PUT', '/does-not-exist', payload(schoolA));
  assert.equal(status, 500);
});
