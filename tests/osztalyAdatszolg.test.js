import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';

let storedRecords = [];
let alapadatokExists = true;

const matchesYear = (recordYear, filter) => {
  if (filter === undefined || filter === null) return true;
  if (typeof filter === 'number') return recordYear === filter;
  if (typeof filter === 'object') {
    if (filter.gte !== undefined && recordYear < filter.gte) return false;
    if (filter.lte !== undefined && recordYear > filter.lte) return false;
    return true;
  }
  return true;
};

const modelMethods = {
  findMany: async ({ where = {} }) => {
    return storedRecords.filter(r => {
      if (where.alapadatok_id && r.alapadatok_id !== where.alapadatok_id) return false;
      if (where.tanev_kezdete && !matchesYear(r.tanev_kezdete, where.tanev_kezdete)) return false;
      return true;
    });
  },
  deleteMany: async ({ where = {} }) => {
    storedRecords = storedRecords.filter(r => {
      if (where.alapadatok_id && r.alapadatok_id === where.alapadatok_id) {
        if (where.tanev_kezdete && matchesYear(r.tanev_kezdete, where.tanev_kezdete)) return false;
      }
      return true;
    });
    return { count: 1 };
  },
  createMany: async ({ data }) => {
    storedRecords.push(...data);
    return { count: data.length };
  },
};

const prismaMock = {
  alapadatok: {
    findUnique: async ({ where }) => {
      if (where.id === 'valid-school' || alapadatokExists) {
        return { id: where.id, iskola_neve: 'Test School' };
      }
      return null;
    },
  },
  OsztalyAdatszolg: modelMethods,
  osztalyAdatszolg: modelMethods,
};

mock.module('../utils/prisma.js', { defaultExport: prismaMock });

const {
  getAll,
  getNappaliClasses,
  createMany,
} = await import('../services/osztaly_adatszolg.service.js');

beforeEach(() => {
  storedRecords = [];
  alapadatokExists = true;
});

test('getNappaliClasses returns only classes with Nappali munkarend', async () => {
  storedRecords = [
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: '9.A',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
    },
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: '9.B',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
    },
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: '2/14. FI',
      Munkarend: 'Felnőttképzési jogviszony munkarend nélkül',
    },
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: '1/13. FI',
      Munkarend: '-',
    },
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: '2/14. T',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
    },
  ];

  const result = await getNappaliClasses('school-1', 2026);
  assert.deepEqual(result.sort(), ['2/14. T', '9.A', '9.B']);
});

test('createMany deletes existing records and creates new ones with school/year mapping', async () => {
  storedRecords = [
    {
      alapadatok_id: 'school-1',
      tanev_kezdete: 2026,
      Osztaly_neve: 'Old.Class',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
    },
  ];

  const uploadBatch = [
    {
      Osztaly_neve: '9.A',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
      __index: 0,
      __errors: [],
    },
    {
      Osztaly_neve: '10.A',
      Munkarend: 'Nappali rendszerű iskolai oktatás',
      __index: 1,
    },
  ];

  const res = await createMany('school-1', uploadBatch, 2026, 'user-123');
  assert.equal(res.count, 2);
  assert.equal(storedRecords.length, 2);
  assert.equal(storedRecords[0].Osztaly_neve, '9.A');
  assert.equal(storedRecords[0].alapadatok_id, 'school-1');
  assert.equal(storedRecords[0].tanev_kezdete, 2026);
  assert.equal(storedRecords[0].createBy, 'user-123');
  assert.equal(storedRecords[0].__index, undefined);
});

test('createMany throws error if alapadatok does not exist', async () => {
  alapadatokExists = false;
  await assert.rejects(
    async () => {
      await createMany('non-existent-school', [], 2026);
    },
    { message: /Alapadatok with id non-existent-school not found/ }
  );
});
