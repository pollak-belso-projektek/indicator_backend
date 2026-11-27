// KRÉTA sector/profession names -> configured school rows (indicators 1 and 2).
// Regression for: after a tanügyi import some schools' students did not appear in the
// indicators, because the new KRÉTA export writes "Cukrász (4 1013 23 01)" instead of
// "Cukrász - 4 1013 23 01 (2020)", and the old " - " split also cut
// "Pincér - vendégtéri szakember" to "Pincér".
import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { modelsFromSchema } from './helpers/schema.js';
import { normalizeKepzesName, normalizeAgazatName, agazatNameKey, kepzesNameKey, indexByKepzesName, schoolKepzesLookup } from '../utils/kepzesName.js';

// --- Name normalization ---------------------------------------------------------------
for (const [raw, expected] of [
  ['Cukrász (4 1013 23 01)', 'Cukrász'],
  ['Cukrász - 4 1013 23 01 (2020)', 'Cukrász'],
  ['Turizmus-vendéglátás - 23 (2020)', 'Turizmus-vendéglátás'],
  ['Informatika - 061', 'Informatika'],
  ['Pincér - vendégtéri szakember (4 1013 23 04)', 'Pincér - vendégtéri szakember'],
  ['Pincér - vendégtéri szakember - 4 1013 23 04 (2020)', 'Pincér - vendégtéri szakember'],
  ['Hűtő- és szellőzésrendszer-szerelő (4 0732 07 02)', 'Hűtő- és szellőzésrendszer-szerelő'],
  ['Fa- és bútoripar - 08 (2020)', 'Fa- és bútoripar'],
  ['    Burkoló', 'Burkoló'],
  ['Gépjármű  mechatronikus', 'Gépjármű mechatronikus'],
  ['Szakács', 'Szakács'],
  ['Na', null], ['NA', null], ['na', null], ['Nincs meghatározva', null], ['', null], ['   ', null], [null, null], [undefined, null],
]) {
  test(`normalize ${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalizeKepzesName(raw), expected);
  });
}
test('names with digits that are not codes are kept', () => {
  assert.equal(normalizeKepzesName('CAD-CAM informatikus 2.0'), 'CAD-CAM informatikus 2.0');
  assert.equal(normalizeKepzesName('Gépész (CNC)'), 'Gépész (CNC)');
});
test('comparison key ignores case, code and whitespace', () => {
  assert.equal(kepzesNameKey('  CUKRÁSZ (4 1013 23 01)'), kepzesNameKey('Cukrász'));
  assert.notEqual(kepzesNameKey('Pincér'), kepzesNameKey('Pincér - vendégtéri szakember'));
});

// Duplicates exactly as found in the live Szakma table.
test('index prefers the clean record over auto-created code variants, in any order', () => {
  for (const records of [
    [{ id: 'code', nev: 'Cukrász (4 1013 23 01)' }, { id: 'clean', nev: 'Cukrász' }],
    [{ id: 'clean', nev: 'Cukrász' }, { id: 'code', nev: 'Cukrász (4 1013 23 01)' }],
  ]) {
    assert.equal(indexByKepzesName(records).get(kepzesNameKey('Cukrász')).id, 'clean');
  }
});

// --- School configuration (same intersection rule as the indicator page) --------------
const sector = (id, nev, szakmak) => ({ szakirany: { id, nev, szakma: szakmak.map(s => ({ szakma: s })) } });
test('only professions linked to both the school and its sector are configured', () => {
  const cukraszClean = { id: 'c1', nev: 'Cukrász' };
  const cukraszCode = { id: 'c2', nev: 'Cukrász (4 1013 23 01)' };
  const school = {
    alapadatok_szakma: [{ szakma_id: 'c1' }],
    alapadatok_szakirany: [sector('t', 'Turizmus-vendéglátás', [cukraszCode, cukraszClean])],
  };
  const lookup = schoolKepzesLookup(school);
  assert.equal(lookup.szakma.get(kepzesNameKey('Cukrász')).id, 'c1');
  assert.equal(lookup.szakmaToSzakirany.get(kepzesNameKey('Cukrász (4 1013 23 01)')), 'Turizmus-vendéglátás');
  assert.deepEqual(lookup.categories, [
    { szakiranyName: 'Turizmus-vendéglátás', szakmaNev: null },
    { szakiranyName: 'Turizmus-vendéglátás', szakmaNev: 'Cukrász' },
  ]);
});
test('school without configuration yields empty lookups', () => {
  const lookup = schoolKepzesLookup(null);
  assert.equal(lookup.szakma.size, 0);
  assert.deepEqual(lookup.categories, []);
});

// --- Indicator 1: tanulói létszám generated from tanügyi adatok ----------------------------
const delegates = Object.fromEntries(modelsFromSchema().flatMap(m => [[m.name[0].toLowerCase() + m.name.slice(1), m.name], [m.name, m.name]]));
const tables = {};
const prisma = createFakePrisma(delegates, undefined, tables);
mock.module('../utils/prisma.js', { defaultExport: prisma });
mock.module('../services/form_history.service.js', { namedExports: { scheduleSnapshot: () => {} } });
const { generateAndSaveFromTanugyiAdatok } = await import('../services/tanulo_letszam.service.js');
const { generateAndSaveAdmissionsFromTanugyiAdatok } = await import('../services/admissions_autosave.service.js');

const SCHOOL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const szakma = {
  cukrasz: { id: 'sz-cukrasz', nev: 'Cukrász' },
  cukraszCode: { id: 'sz-cukrasz-code', nev: 'Cukrász (4 1013 23 01)' },
  burkolo: { id: 'sz-burkolo', nev: '    Burkoló' }, // configured name has leading spaces in the live DB
  burkoloCode: { id: 'sz-burkolo-code', nev: 'Burkoló (4 0732 06 03)' },
  pincer: { id: 'sz-pincer', nev: 'Pincér' },
  pincerFull: { id: 'sz-pincer-full', nev: 'Pincér - vendégtéri szakember' },
};
const szakirany = {
  turizmus: { id: 'si-turizmus', nev: 'Turizmus-vendéglátás' },
  epitoipar: { id: 'si-epitoipar', nev: 'Építőipar' },
};

beforeEach(() => {
  tables.Szakma = Object.values(szakma).map(s => ({ ...s }));
  tables.Szakirany = Object.values(szakirany).map(s => ({ ...s }));
  tables.Alapadatok = [{
    id: SCHOOL,
    alapadatok_szakma: [szakma.cukrasz, szakma.burkolo, szakma.pincerFull].map(s => ({ szakma_id: s.id })),
    alapadatok_szakirany: [
      sector(szakirany.turizmus.id, szakirany.turizmus.nev, [szakma.cukraszCode, szakma.cukrasz, szakma.pincer, szakma.pincerFull]),
      sector(szakirany.epitoipar.id, szakirany.epitoipar.nev, [szakma.burkoloCode, szakma.burkolo]),
    ],
  }];
  tables.Tanulo_Letszam = [];
  tables.Felvettek_Szama = [];
  tables.Tanugyi_Adatok = [];
});

const student = (agazat, szakmaNev, extra = {}) => ({
  id: `st-${tables.Tanugyi_Adatok.length}`, alapadatok_id: SCHOOL, tanev_kezdete: 2026,
  uj_Szkt_agazat_tipusa: agazat, uj_szkt_szakma_tipusa: szakmaNev,
  evfolyam: '9. technikum', tanulo_jogviszonya: 'Tanulói jogviszony', munkarend: 'Nappali rendszerű iskolai oktatás',
  felvetel_taneve: '2026/2027', ...extra,
});
const letszam = (szakmaId, jogv = 0) => tables.Tanulo_Letszam
  .filter(r => r.szakma_id === szakmaId && r.jogv_tipus === jogv).reduce((t, r) => t + r.letszam, 0);

test('new KRÉTA format is counted on the configured professions', async () => {
  tables.Tanugyi_Adatok.push(
    student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász (4 1013 23 01)'),
    student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász (4 1013 23 01)'),
    student('Építőipar - 06 (2020)', 'Burkoló (4 0732 06 03)', { tanulo_jogviszonya: 'Felnőttképzési jogviszony' }),
  );
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  assert.equal(letszam(szakma.cukrasz.id), 2, 'linked to the configured "Cukrász", not the code variant');
  assert.equal(letszam(szakma.cukraszCode.id), 0);
  assert.equal(letszam(szakma.burkolo.id, 1), 1, 'linked to the configured "    Burkoló"');
  assert.equal(letszam(szakma.burkoloCode.id, 1), 0);
});
test('old KRÉTA format still works', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász - 4 1013 23 01 (2020)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  assert.equal(letszam(szakma.cukrasz.id), 1);
});
test('"Pincér - vendégtéri szakember" is not cut to "Pincér"', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Pincér - vendégtéri szakember (4 1013 23 04)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  assert.equal(letszam(szakma.pincerFull.id), 1);
  assert.equal(letszam(szakma.pincer.id), 0);
});
test('no duplicate dictionary entries are created for known professions', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász (4 1013 23 01)'), student('Építőipar - 06 (2020)', 'Burkoló (4 0732 06 03)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  assert.equal(tables.Szakma.length, Object.keys(szakma).length);
  assert.equal(tables.Szakirany.length, Object.keys(szakirany).length);
});
test('missing sector ("Na") with a configured profession is counted under its configured sector', async () => {
  tables.Tanugyi_Adatok.push(student('Na', 'Cukrász (4 1013 23 01)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  assert.equal(letszam(szakma.cukrasz.id), 1);
  const row = tables.Tanulo_Letszam.find(r => r.szakma_id === szakma.cukrasz.id && r.letszam === 1);
  assert.equal(row.szakirany_id, szakirany.turizmus.id);
});
test('missing profession is counted as "Nincs meghatározva" of its sector', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Na'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  const row = tables.Tanulo_Letszam.find(r => r.szakma_id === null && r.szakirany_id === szakirany.turizmus.id && r.jogv_tipus === 0);
  assert.equal(row.letszam, 1);
});
test('an unknown new profession is created once, with a clean name', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Szakács (4 1013 23 05)'), student('Turizmus-vendéglátás - 23 (2020)', 'Szakács (4 1013 23 05)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  const created = tables.Szakma.filter(s => kepzesNameKey(s.nev) === kepzesNameKey('Szakács'));
  assert.deepEqual(created.map(s => s.nev), ['Szakács']);
  assert.equal(letszam(created[0].id), 2);
});
test('every configured row exists even with zero students (table shows all of them)', async () => {
  tables.Tanugyi_Adatok.push(student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász (4 1013 23 01)'));
  await generateAndSaveFromTanugyiAdatok(SCHOOL, 2026);
  for (const s of [szakma.cukrasz, szakma.burkolo, szakma.pincerFull]) {
    assert.ok(tables.Tanulo_Letszam.some(r => r.szakma_id === s.id), s.nev);
  }
});

// --- Indicator 2: felvettek száma ------------------------------------------------------------
test('admissions use the same normalization and configured records', async () => {
  tables.Tanugyi_Adatok.push(
    student('Turizmus-vendéglátás - 23 (2020)', 'Cukrász (4 1013 23 01)'),
    student('Turizmus-vendéglátás - 23 (2020)', 'Pincér - vendégtéri szakember (4 1013 23 04)'),
    student('Építőipar - 06 (2020)', 'Burkoló (4 0732 06 03)', { evfolyam: '1/9 4-es szintű szakképző iskola' }),
  );
  await generateAndSaveAdmissionsFromTanugyiAdatok(SCHOOL, 2026);
  const felvett = id => tables.Felvettek_Szama.filter(r => r.szakma_id === id).reduce((t, r) => t + r.felvett_letszam, 0);
  assert.equal(felvett(szakma.cukrasz.id), 1);
  assert.equal(felvett(szakma.pincerFull.id), 1);
  assert.equal(felvett(szakma.burkolo.id), 1);
  assert.equal(felvett(szakma.cukraszCode.id) + felvett(szakma.burkoloCode.id) + felvett(szakma.pincer.id), 0);
  assert.equal(tables.Szakma.length, Object.keys(szakma).length, 'no new dictionary rows');
});

// Sector names never contain " - ", so everything after it is dropped (school type, code).
for (const [raw, expected] of [
  ['Turizmus-vendéglátás - 23 (2020)', 'Turizmus-vendéglátás'],
  ['Gépészet - Szakképző iskola', 'Gépészet'],
  ['Fa- és bútoripar - 08 (2020)', 'Fa- és bútoripar'],
  ['Épületgépészet', 'Épületgépészet'],
  ['Na', null], ['', null], [null, null],
]) {
  test(`sector ${JSON.stringify(raw)} -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalizeAgazatName(raw), expected);
  });
}
test('profession rule keeps " - " parts that sector rule drops', () => {
  assert.equal(normalizeKepzesName('Pincér - vendégtéri szakember'), 'Pincér - vendégtéri szakember');
  assert.equal(agazatNameKey('GÉPÉSZET - Szakképző iskola'), agazatNameKey('Gépészet - 10 (2020)'));
});
