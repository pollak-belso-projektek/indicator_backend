// "Szinkronizálás tanügyből" button (indicator 1): recomputes indicators 1 and 2 from
// the stored tanügyi data, exactly like the post-import autosave does.
import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const calls = [];
let admissionsFails = false;
mock.module('../services/tanulo_letszam.service.js', {
  namedExports: {
    getAll: async () => [], getById: async () => [], create: async () => ({}), deleteMany: async () => ({}),
    update: async () => ({}), bulkSave: async () => ({}),
    generateAndSaveFromTanugyiAdatok: async (id, year) => { calls.push(['letszam', id, year]); return { count: 4 }; },
  },
});
mock.module('../services/admissions_autosave.service.js', {
  namedExports: {
    generateAndSaveAdmissionsFromTanugyiAdatok: async (id, year) => {
      calls.push(['felvettek', id, year]);
      if (admissionsFails) throw new Error('boom');
      return { count: 1 };
    },
  },
});
const { default: router } = await import('../controllers/tanulo_letszam.controller.js');

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/tanulo_letszam', router);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { calls.length = 0; admissionsFails = false; });

const sync = (path = 'school-1/2026') => fetch(`${base}/tanulo_letszam/sync-from-tanugyi/${path}`, { method: 'POST' });

test('sync recomputes both student counts and admissions for the school/year', async () => {
  const res = await sync();
  assert.equal(res.status, 200);
  assert.deepEqual(calls, [['letszam', 'school-1', 2026], ['felvettek', 'school-1', 2026]]);
  const body = await res.json();
  assert.equal(body.count, 4);
  assert.deepEqual(body.syncWarnings, []);
});
test('admissions failure keeps the student counts and reports a warning', async () => {
  admissionsFails = true;
  const res = await sync();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.syncWarnings.length, 1);
  assert.match(body.message, /felvettek/);
});
test('invalid year is rejected without recomputing anything', async () => {
  assert.equal((await sync('school-1/abc')).status, 400);
  assert.deepEqual(calls, []);
});
