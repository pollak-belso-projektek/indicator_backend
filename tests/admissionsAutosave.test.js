import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

let students;
let records;
let failWrite;
let nextId;
const invalidate = mock.fn(async () => {});
const snapshot = mock.fn(async () => {});
const matches = (record, where) => Object.entries(where).every(([key, value]) => record[key] === value);
const prisma = {
  tanugyi_Adatok: { findMany: async ({ where }) => students.filter(record => matches(record, where)) },
  $transaction: async work => {
    const draft = structuredClone(records);
    const tx = {
      szakirany: { upsert: async ({ where }) => ({ id: where.nev }) },
      szakma: { upsert: async ({ where }) => ({ id: where.nev }) },
      felvettek_Szama: {
        findMany: async ({ where }) => draft.filter(record => matches(record, where)),
        updateMany: async ({ where, data }) => {
          if (failWrite) throw new Error('write failed');
          draft.filter(record => matches(record, where)).forEach(record => Object.assign(record, data));
        },
        create: async ({ data }) => {
          if (failWrite) throw new Error('write failed');
          draft.push({ id: `new-${nextId++}`, ...data });
        },
      },
    };
    const result = await work(tx);
    records = draft;
    return result;
  },
};
mock.module('../utils/prisma.js', { defaultExport: prisma });
mock.module('../utils/ServiceCache.js', { namedExports: { ServiceCache: class { invalidateAll = invalidate; } } });
mock.module('../services/form_history.service.js', { namedExports: { scheduleSnapshot: snapshot } });
const { generateAndSaveAdmissionsFromTanugyiAdatok: sync } = await import('../services/admissions_autosave.service.js');

const student = (overrides = {}) => ({ alapadatok_id: 'school', tanev_kezdete: 2026,
  felvetel_taneve: '2026/2027', evfolyam: '9.', tanulo_jogviszonya: 'Tanulói jogviszony',
  uj_Szkt_agazat_tipusa: 'Informatika - 061', uj_szkt_szakma_tipusa: 'Na', ...overrides });
const saved = (overrides = {}) => ({ id: 'saved', alapadatok_id: 'school', tanev_kezdete: 2026,
  szakiranyId: 'Informatika', szakma_id: null, felvett_letszam: 9,
  jelentkezo_letszam: 100, felveheto_letszam: 60, ...overrides });
beforeEach(() => { students = []; records = []; failWrite = false; nextId = 1; invalidate.mock.resetCalls(); snapshot.mock.resetCalls(); });

test('new import persists ninth-grade counts with normalized sector/profession', async () => {
  students = [student(), student(), student({ uj_szkt_szakma_tipusa: 'Programozó - 001' })];
  await sync('school', 2026);
  assert.equal(records.length, 2);
  assert.equal(records.find(record => record.szakma_id === null).felvett_letszam, 2);
  assert.equal(records.find(record => record.szakma_id === 'Programozó').felvett_letszam, 1);
  assert.equal(records[0].jelentkezo_letszam, 0);
  assert.equal(records[0].felveheto_letszam, 0);
  assert.equal(invalidate.mock.callCount(), 1);
  assert.deepEqual(snapshot.mock.calls[0].arguments, ['school', 'felvettek_Szama']);
});

test('repeat import updates counts without duplicate rows and preserves manual fields', async () => {
  records = [saved()]; students = [student(), student()];
  await sync('school', 2026);
  await sync('school', 2026);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], saved({ felvett_letszam: 2 }));
});

test('only selected school/year, student status and first year count', async () => {
  students = [student(), student({ evfolyam: '1/9.' }), student({ evfolyam: 9 }),
    student({ evfolyam: '10.' }), student({ evfolyam: '19.' }),
    student({ tanulo_jogviszonya: 'Felnőttképzési jogviszony' }),
    student({ felvetel_taneve: '2025/2026' }), student({ felvetel_taneve: null }),
    student({ alapadatok_id: 'other' }), student({ tanev_kezdete: 2025 })];
  await sync('school', 2026);
  assert.equal(records[0].felvett_letszam, 3);
});

test('departed sector counts reset to zero without deleting manual applicant/capacity data', async () => {
  records = [saved(), saved({ id: 'other-sector', szakiranyId: 'Gépészet' })];
  students = [student()];
  await sync('school', 2026);
  assert.equal(records.find(record => record.id === 'other-sector').felvett_letszam, 0);
  assert.equal(records.find(record => record.id === 'other-sector').jelentkezo_letszam, 100);
});

test('other schools and historical years remain unchanged', async () => {
  const others = [saved({ id: 'historical', tanev_kezdete: 2025 }), saved({ id: 'other-school', alapadatok_id: 'other' })];
  records = structuredClone(others); students = [student()];
  await sync('school', 2026);
  assert.deepEqual(records.slice(0, 2), others);
});

test('empty cohort clears only derived counts in the selected school/year', async () => {
  records = [saved()];
  await sync('school', 2026);
  assert.deepEqual(records[0], saved({ felvett_letszam: 0 }));
});

test('transaction failure does not partially clear counts or publish a history snapshot', async () => {
  records = [saved()]; students = [student()]; failWrite = true;
  await assert.rejects(sync('school', 2026), /write failed/);
  assert.deepEqual(records, [saved()]);
  assert.equal(invalidate.mock.callCount(), 0);
  assert.equal(snapshot.mock.callCount(), 0);
});
