import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
const events = [];
const insert = mock.fn(async data => { events.push('import'); return { count: data.length }; });
const syncStudents = mock.fn(async () => { events.push('students'); });
const syncAdmissions = mock.fn(async () => { events.push('admissions'); });
mock.module('../utils/prisma.js', { defaultExport: { alapadatok: { findUnique: async () => ({ id: 'school' }) } } });
mock.module('../utils/ServicePattern.js', { namedExports: { ServicePattern: class {
  async deleteByAlapadatokIdAndExactYear() {}
  createMany = insert;
} } });
mock.module('../services/tanulo_letszam.service.js', { namedExports: { generateAndSaveFromTanugyiAdatok: syncStudents } });
mock.module('../services/admissions_autosave.service.js', { namedExports: { generateAndSaveAdmissionsFromTanugyiAdatok: syncAdmissions } });
const { createMany } = await import('../services/tanugyi_adatok.service.js');
const { default: router } = await import('../controllers/tanugyi_adatok.controller.js');
beforeEach(() => { events.length = 0; insert.mock.resetCalls(); syncStudents.mock.resetCalls(); syncAdmissions.mock.resetCalls(); });

for (const [date, year] of [['2026-08-31T12:00:00Z', 2025], ['2026-09-01T12:00:00Z', 2026]]) {
  test(`import on ${date} waits for both autosaves for school/year ${year}`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(date) });
    const result = await createMany('school', [{ evfolyam: '9.', __index: 1 }], 'creator');
    assert.deepEqual(events, ['import', 'students', 'admissions']);
    assert.deepEqual(syncAdmissions.mock.calls[0].arguments, ['school', year]);
    assert.deepEqual(syncStudents.mock.calls[0].arguments, ['school', year]);
    assert.equal(insert.mock.calls[0].arguments[0][0].tanev_kezdete, year);
    assert.equal(insert.mock.calls[0].arguments[0][0].__index, undefined);
    assert.deepEqual(result, { count: 1, syncWarnings: [] });
  });
}
test('failed raw import never triggers autosave', async () => {
  insert.mock.mockImplementationOnce(async () => { throw new Error('import failed'); });
  await assert.rejects(createMany('school', [{}], 'creator'), /import failed/);
  assert.equal(syncStudents.mock.callCount(), 0);
  assert.equal(syncAdmissions.mock.callCount(), 0);
});
test('admission failure is returned as a warning after successful raw import', async () => {
  syncAdmissions.mock.mockImplementationOnce(async () => { throw new Error('autosave failed'); });
  const result = await createMany('school', [{}], 'creator');
  assert.equal(result.count, 1);
  assert.equal(result.syncWarnings.length, 1);
  assert.match(result.syncWarnings[0], /felvettek/);
});
test('student sync failure does not prevent admission sync and is not hidden', async () => {
  syncStudents.mock.mockImplementationOnce(async () => { throw new Error('student sync failed'); });
  const result = await createMany('school', [{}], 'creator');
  assert.equal(syncAdmissions.mock.callCount(), 1);
  assert.equal(result.syncWarnings.length, 1);
  assert.match(result.syncWarnings[0], /tanulólétszám/);
});

for (const failure of [false, true]) {
  test(`HTTP import returns completed autosave status (${failure ? 'sync failure' : 'success'})`, async t => {
    if (failure) syncAdmissions.mock.mockImplementationOnce(async () => { throw new Error('autosave failed'); });
    const app = express();
    app.use(express.json());
    app.use('/api/v1/tanugyi_adatok', router);
    const server = await new Promise(resolve => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/tanugyi_adatok`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alapadatok_id: 'school', userId: 'creator', tanugyi_adatok: [{
        uj_Szkt_agazat_tipusa: 'IT', uj_szkt_szakma_tipusa: 'Na', tanulo_jogviszonya: 'Tanulói jogviszony',
      }] }),
    });
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.count, 1);
    assert.equal(result.syncWarnings.length, failure ? 1 : 0);
    assert.equal(syncAdmissions.mock.callCount(), 1);
    assert.equal(syncStudents.mock.callCount(), 1);
  });
}
