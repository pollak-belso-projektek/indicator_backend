// ServicePattern is the shared CRUD/caching layer behind ~40 indicator services.
import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakePrisma } from './helpers/fakePrisma.js';
import * as cache from '../utils/cache.js';

const tables = {};
const prisma = createFakePrisma({ dobbanto: 'Dobbanto', szakmaiTovabbkepzes: 'SzakmaiTovabbkepzes', formHistory: 'FormHistory' }, undefined, tables);
mock.module('../utils/prisma.js', { defaultExport: prisma });
const scheduleSnapshot = mock.fn(() => {});
mock.module('../services/form_history.service.js', { namedExports: { scheduleSnapshot } });
const { ServicePattern } = await import('../utils/ServicePattern.js');

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pattern = new ServicePattern('dobbanto', 'id');
const row = (id, school, year, n = 1) => ({ id, alapadatok_id: school, tanev_kezdete: year, dobbanto_szama: n });

beforeEach(async () => {
  await cache.clear();
  scheduleSnapshot.mock.resetCalls();
  tables.Dobbanto = [row('r2020', A, 2020), row('r2021', A, 2021), row('r2025', A, 2025), row('r2026', A, 2026), row('b2025', B, 2025)];
});
const ids = rows => rows.map(r => r.id).sort();

test('findAllByYear returns the 5-year window [year-4, year] across schools', async () => {
  assert.deepEqual(ids(await pattern.findAllByYear(2025)), ['b2025', 'r2021', 'r2025']);
});
for (const year of [undefined, null, 'undefined', 'null', 'abc']) {
  test(`findAllByYear(${JSON.stringify(year)}) falls back to all rows`, async () => {
    assert.equal((await pattern.findAllByYear(year)).length, 5);
  });
}
test('findByAlapadatokIdAndYear filters by school and window', async () => {
  assert.deepEqual(ids(await pattern.findByAlapadatokIdAndYear(A, '2025')), ['r2021', 'r2025']);
  assert.deepEqual(ids(await pattern.findByAlapadatokIdAndYear(B, 2025)), ['b2025']);
});
test('findByAlapadatokIdAndYear without year returns every year of that school', async () => {
  assert.deepEqual(ids(await pattern.findByAlapadatokIdAndYear(A, undefined)), ['r2020', 'r2021', 'r2025', 'r2026']);
});
test('findById returns the row or null', async () => {
  assert.equal((await pattern.findById('r2025')).tanev_kezdete, 2025);
  assert.equal(await pattern.findById('missing'), null);
});

// --- Cache consistency: a write must never leave a stale list behind ----------------
test('create makes the new row visible in previously cached lists', async () => {
  await pattern.findAllByYear(2025);
  await pattern.findByAlapadatokIdAndYear(A, 2025);
  await pattern.create(row('new', A, 2024));
  assert.ok(ids(await pattern.findAllByYear(2025)).includes('new'));
  assert.ok(ids(await pattern.findByAlapadatokIdAndYear(A, 2025)).includes('new'));
});
test('update is visible in cached lists and by id', async () => {
  await pattern.findById('r2025');
  await pattern.findAllByYear(2025);
  await pattern.update('r2025', { dobbanto_szama: 42 });
  assert.equal((await pattern.findById('r2025')).dobbanto_szama, 42);
  assert.equal((await pattern.findAllByYear(2025)).find(r => r.id === 'r2025').dobbanto_szama, 42);
});
test('delete removes the row from cached lists and by id', async () => {
  await pattern.findById('r2025');
  await pattern.findAllByYear(2025);
  await pattern.delete('r2025');
  assert.equal(await pattern.findById('r2025'), null);
  assert.ok(!ids(await pattern.findAllByYear(2025)).includes('r2025'));
});
test('createMany is visible in cached lists', async () => {
  await pattern.findAllByYear(2025);
  await pattern.createMany([row('m1', A, 2025), row('m2', A, 2025)]);
  assert.ok(ids(await pattern.findAllByYear(2025)).includes('m2'));
});
test('reads are served from cache until a write happens', async () => {
  await pattern.findAllByYear(2025);
  tables.Dobbanto.push(row('sneaky', A, 2025)); // written behind the service's back
  assert.ok(!ids(await pattern.findAllByYear(2025)).includes('sneaky'));
});

// --- Deletes ------------------------------------------------------------------------
test('deleteByAlapadatokIdAndYear removes the whole 5-year window of that school only', async () => {
  await pattern.deleteByAlapadatokIdAndYear(A, 2025);
  assert.deepEqual(ids(tables.Dobbanto), ['b2025', 'r2020', 'r2026']);
});
test('deleteByAlapadatokIdAndExactYear removes one year of that school only', async () => {
  await pattern.deleteByAlapadatokIdAndExactYear(A, '2025');
  assert.deepEqual(ids(tables.Dobbanto), ['b2025', 'r2020', 'r2021', 'r2026']);
});
for (const year of [undefined, 'undefined', 'null']) {
  test(`delete by school with year ${JSON.stringify(year)} removes all years of that school`, async () => {
    await pattern.deleteByAlapadatokIdAndExactYear(A, year);
    assert.deepEqual(ids(tables.Dobbanto), ['b2025']);
  });
}
test('deletes invalidate cached lists', async () => {
  await pattern.findByAlapadatokIdAndYear(A, 2025);
  await pattern.deleteByAlapadatokIdAndExactYear(A, 2025);
  assert.deepEqual(ids(await pattern.findByAlapadatokIdAndYear(A, 2025)), ['r2021']);
});

// --- Form history snapshots ------------------------------------------------------------
test('writes schedule a form-history snapshot for the school', async () => {
  await pattern.create(row('n', A, 2025));
  await pattern.update('r2025', { dobbanto_szama: 2 });
  await pattern.delete('r2021');
  await pattern.deleteByAlapadatokIdAndExactYear(B, 2025);
  assert.deepEqual(scheduleSnapshot.mock.calls.map(c => c.arguments), [[A, 'dobbanto'], [A, 'dobbanto'], [A, 'dobbanto'], [B, 'dobbanto']]);
});
test('formHistory itself never snapshots (no recursion)', async () => {
  const fh = new ServicePattern('formHistory', 'id');
  tables.FormHistory = [];
  const created = await fh.create({ alapadatok_id: A, table_name: 'dobbanto', snapshot_data: [] });
  await fh.update(created.id, { is_active: false });
  await fh.delete(created.id);
  assert.equal(scheduleSnapshot.mock.callCount(), 0);
});

// --- Configurable field names ---------------------------------------------------------
test('custom yearField is used for year windows', async () => {
  const p = new ServicePattern('szakmaiTovabbkepzes', 'id', {}, {}, { yearField: 'tanev' });
  tables.SzakmaiTovabbkepzes = [{ id: 's1', alapadatok_id: A, tanev: 2025 }, { id: 's2', alapadatok_id: A, tanev: 2019 }];
  assert.deepEqual(ids(await p.findByAlapadatokIdAndYear(A, 2025)), ['s1']);
});
test('current academic year methods use the 1 September rule', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-08-15T12:00:00').getTime() });
  try {
    assert.equal(pattern.getCurrentAcademicYear(), 2025);
    assert.deepEqual(ids(await pattern.findByAlapadatokCurrentYear(A)), ['r2021', 'r2025']);
  } finally {
    mock.timers.reset();
  }
});
