import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { currentAcademicYear, academicYearRange } from '../utils/academicYear.js';
import { mapUserPermissions, mapTableAccess, enrichUserWithPermissions } from '../utils/permissions.js';
import * as cache from '../utils/cache.js';
import { ServiceCache } from '../utils/ServiceCache.js';

// --- Academic year (1 September, same rule as the frontend) --------------------------
for (const [date, year] of [
  ['2026-01-01T12:00:00', 2025], ['2026-06-30T12:00:00', 2025], ['2026-07-15T12:00:00', 2025],
  ['2026-08-31T23:59:59', 2025], ['2026-09-01T00:00:00', 2026], ['2026-12-31T12:00:00', 2026],
]) {
  test(`academic year on ${date} is ${year}/${year + 1}`, () => {
    assert.equal(currentAcademicYear(new Date(date)), year);
  });
}
test('academic year defaults to now', () => {
  const now = new Date();
  assert.equal(currentAcademicYear(), now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1);
});
test('year range is the last five academic years', () => {
  assert.deepEqual(academicYearRange(2025), { firstYear: 2021, lastYear: 2025 });
  assert.deepEqual(academicYearRange('2025'), { firstYear: 2021, lastYear: 2025 });
  assert.deepEqual(academicYearRange(2025, 3), { firstYear: 2023, lastYear: 2025 });
});

// --- Permission bitfields ------------------------------------------------------
const roleFlags = {
  1: ['isStandard'], 2: ['isPrivileged'], 4: ['isAdmin'], 9: ['isHSZC', 'isStandard'],
  10: ['isHSZC', 'isPrivileged'], 15: ['isHSZC', 'isAdmin', 'isPrivileged', 'isStandard'],
  31: ['isSuperadmin', 'isHSZC', 'isAdmin', 'isPrivileged', 'isStandard'],
};
for (const [role, flags] of Object.entries(roleFlags)) {
  test(`role ${role} -> ${flags.join(', ')}`, () => {
    const p = mapUserPermissions(Number(role));
    for (const [k, v] of Object.entries(p)) assert.equal(v, flags.includes(k), k);
  });
}
test('missing permissions map to no rights', () => {
  assert.ok(Object.values(mapUserPermissions(undefined)).every(v => v === false));
  assert.ok(Object.values(mapTableAccess(null)).every(v => v === false));
});
for (const [access, expected] of [[0, []], [1, ['canRead']], [3, ['canRead', 'canCreate']], [4, ['canUpdate']], [8, ['canDelete']], [15, ['canRead', 'canCreate', 'canUpdate', 'canDelete']]]) {
  test(`table access ${access} -> ${expected.join(', ') || 'nothing'}`, () => {
    for (const [k, v] of Object.entries(mapTableAccess(access))) assert.equal(v, expected.includes(k), k);
  });
}
test('enrichUserWithPermissions adds details without mutating the input', () => {
  const user = { permissions: 4, tableAccess: [{ access: 5, table: { name: 'dobbanto' } }, { access: 1 }] };
  const copy = structuredClone(user);
  const out = enrichUserWithPermissions(user);
  assert.deepEqual(user, copy);
  assert.equal(out.permissionsDetails.isAdmin, true);
  assert.equal(out.tableAccess[0].tableName, 'dobbanto');
  assert.deepEqual(out.tableAccess[0].permissionsDetails, { canDelete: false, canUpdate: true, canCreate: false, canRead: true });
  assert.equal(out.tableAccess[1].tableName, undefined, 'missing table does not crash');
  assert.equal(enrichUserWithPermissions(null), null);
});

// --- In-memory cache -----------------------------------------------------------
beforeEach(() => cache.clear());
afterEach(() => mock.timers.reset());

test('cache stores and returns values, misses return null', async () => {
  await cache.set('a', { x: 1 });
  assert.deepEqual(await cache.get('a'), { x: 1 });
  assert.equal(await cache.get('missing'), null);
  assert.equal(await cache.has('a'), true);
});
test('cache entries expire after their TTL', async () => {
  mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  await cache.set('t', 1, 1000);
  mock.timers.tick(999);
  assert.equal(await cache.get('t'), 1);
  mock.timers.tick(2);
  assert.equal(await cache.get('t'), null);
  assert.equal(await cache.has('t'), false);
});
test('ttl null means no expiry', async () => {
  mock.timers.enable({ apis: ['Date'], now: 0 });
  await cache.set('forever', 1, null);
  mock.timers.tick(10 ** 9);
  assert.equal(await cache.get('forever'), 1);
});
test('falsy values are cached too (0, false, empty array)', async () => {
  await cache.set('zero', 0);
  await cache.set('no', false);
  await cache.set('empty', []);
  assert.equal(await cache.get('zero'), 0);
  assert.equal(await cache.get('no'), false);
  assert.deepEqual(await cache.get('empty'), []);
});
test('delByPattern removes matching keys only', async () => {
  await cache.set('svc:all:2025', 1);
  await cache.set('svc:byYear:2025', 2);
  await cache.set('other:all', 3);
  await cache.delByPattern('svc:.*');
  assert.equal(await cache.get('svc:all:2025'), null);
  assert.equal(await cache.get('svc:byYear:2025'), null);
  assert.equal(await cache.get('other:all'), 3);
});
test('cached() memoizes by arguments', async () => {
  const fn = mock.fn(async (a, b) => a + b);
  const memo = cache.cached(fn, 'sum');
  assert.equal(await memo(1, 2), 3);
  assert.equal(await memo(1, 2), 3);
  assert.equal(await memo(2, 2), 4);
  assert.equal(fn.mock.callCount(), 2);
});

// --- ServiceCache ----------------------------------------------------------------
test('ServiceCache key joins non-empty params', () => {
  const sc = new ServiceCache('dobbanto');
  assert.equal(sc.key('byYear', 2025), 'dobbanto:byYear:2025');
  assert.equal(sc.key('alapadatok_id_year', 'abc', null, undefined, 2025), 'dobbanto:alapadatok_id_year:abc:2025');
});
test('ServiceCache.get runs the query once and serves the cached result', async () => {
  const sc = new ServiceCache('svc');
  const q = mock.fn(async () => [1, 2]);
  assert.deepEqual(await sc.get('all', q), [1, 2]);
  assert.deepEqual(await sc.get('all', q), [1, 2]);
  assert.equal(q.mock.callCount(), 1);
});
test('ServiceCache does not cache null results (a later insert becomes visible)', async () => {
  const sc = new ServiceCache('svc');
  let value = null;
  const q = mock.fn(async () => value);
  assert.equal(await sc.get('id', q, undefined, 'x'), null);
  value = { id: 'x' };
  assert.deepEqual(await sc.get('id', q, undefined, 'x'), { id: 'x' });
});
test('invalidateRelated after a write clears list caches of this service only', async () => {
  const sc = new ServiceCache('svc');
  for (const k of ['svc:all:', 'svc:byYear:2025', 'svc:alapadatok_id_year:a:2025', 'svc:id:r1', 'svc:id:r2', 'svc2:all:']) await cache.set(k, 1);
  await sc.invalidateRelated('update', 'r1');
  assert.equal(await cache.get('svc:all:'), null);
  assert.equal(await cache.get('svc:byYear:2025'), null);
  assert.equal(await cache.get('svc:alapadatok_id_year:a:2025'), null);
  assert.equal(await cache.get('svc:id:r1'), null);
  assert.equal(await cache.get('svc:id:r2'), 1, 'other records stay cached');
  assert.equal(await cache.get('svc2:all:'), 1, 'other services stay cached');
});
test('bulk operations clear the whole service cache', async () => {
  const sc = new ServiceCache('svc');
  await cache.set('svc:id:r2', 1);
  await cache.set('svc:custom:x', 1);
  await sc.invalidateRelated('deleteMany');
  assert.equal(await cache.get('svc:id:r2'), null);
  assert.equal(await cache.get('svc:custom:x'), null);
});
