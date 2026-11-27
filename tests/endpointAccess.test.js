// Endpoint -> permission table mapping (utils/tableAccessMap.js).
import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { mapUserPermissions, mapTableAccess } from '../utils/permissions.js';
import { ENDPOINT_TABLES, PUBLIC_READ_SEGMENTS, tablesForSnapshot } from '../utils/tableAccessMap.js';
import endpointAccess from '../middleware/endpointAccess.middleware.js';

// table_list.name in production (SELECT name FROM table_list).
const LIVE_TABLES = [
  'alapadatok', 'alkalmazottak_munkaugy', 'auth', 'digitalis_kompetencia', 'dobbanto', 'dualis_kepzohelyek',
  'egy_oktatora_juto_ossz_diak', 'egy_oktatora_juto_tanulo', 'egyuttmukudesek_szama', 'elegedettseg',
  'elegedettseg_meres', 'elhelyezkedes', 'felnottkepzes', 'felvettek_szama', 'hh_es_hhh', 'hianyzas',
  'innovacios_tevekenysegek', 'intezmenyi_elismeresek', 'intezmenyi_neveltseg', 'intezmenyi_neveltsegi_mutatok',
  'kompetencia', 'lemorzsolodas', 'log', 'muhelyiskola', 'nszfh', 'nyelvvizsgak_szama', 'oktato-egyeb-tev',
  'oktato_adatszolgaltatas', 'palyaorientacio', 'palyazatok', 'projektek', 'sajatos_nevelesu_tanulok',
  'szakkepzes_zolditese', 'szakmai_rendezvenyek', 'szakmai_tovabbkepzesek', 'szakmai_vizsga_eredmenyek',
  'szervezetfejlesztes', 'szmsz', 'tablelist', 'tanugyi_adatok', 'tanulmanyi_eredmeny', 'tanulo_adatszolgaltatas',
  'tanulo_letszam', 'user', 'versenyek', 'vizsgaeredmenyek',
];
// Tables that intentionally govern no protectedRouter endpoint.
const NOT_ENDPOINT_TABLES = ['alapadatok', 'auth', 'log', 'felnottkepzes'];

const protectedMounts = [...readFileSync(new URL('../index.js', import.meta.url), 'utf8')
  .matchAll(/protectedRouter\.use\(\s*"\/([^"]+)"/g)].map(m => m[1]);

test('every protected router has an explicit permission mapping', () => {
  assert.ok(protectedMounts.length >= 45);
  for (const segment of protectedMounts) {
    assert.ok(segment in ENDPOINT_TABLES || PUBLIC_READ_SEGMENTS.has(segment), `/${segment} has no mapping`);
  }
});
test('every mapped table exists in production', () => {
  for (const [segment, tables] of Object.entries(ENDPOINT_TABLES)) {
    for (const t of tables ?? []) assert.ok(LIVE_TABLES.includes(t), `/${segment} -> unknown table "${t}"`);
  }
});
test('every production table is used by an endpoint (or knowingly is not)', () => {
  const used = new Set(Object.values(ENDPOINT_TABLES).flat());
  for (const t of LIVE_TABLES) assert.ok(used.has(t) || NOT_ENDPOINT_TABLES.includes(t), `table "${t}" governs nothing`);
});

const user = (tables, access = 15, role = 4) => ({
  id: 'u', permissions: role, permissionsDetails: mapUserPermissions(role),
  tableAccess: tables.map(tableName => ({ tableName, permissionsDetails: mapTableAccess(access) })),
});
function check(u, method, url) {
  let status = 200;
  let allowed = false;
  endpointAccess({ user: u, method, originalUrl: url }, { status(c) { status = c; return this; }, json() {} }, () => { allowed = true; });
  return allowed ? 200 : status;
}

// --- Previously unreachable endpoints (name did not contain the table name) -----------
for (const [segment, table] of [
  ['szakmairendezvenyek', 'szakmai_rendezvenyek'], ['szakmai_tovabbkepzes', 'szakmai_tovabbkepzesek'],
  ['palya_orientacio', 'palyaorientacio'], ['osztaly_adatszolgaltatas', 'tanugyi_adatok'],
  ['munkavallalok_elismeresek', 'intezmenyi_elismeresek'], ['engedelyezett_oratomeg', 'egy_oktatora_juto_ossz_diak'],
]) {
  test(`/${segment} works with the "${table}" right`, () => {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      assert.equal(check(user([table]), method, `/api/v1/${segment}/x`), 200, method);
      assert.equal(check(user(['dobbanto']), method, `/api/v1/${segment}/x`), segment === 'osztaly_adatszolgaltatas' && method === 'GET' ? 200 : 403, `${method} without right`);
    }
  });
}

// --- Previously over-granted (substring) ---------------------------------------------------
for (const [right, endpoint] of [
  ['kompetencia', 'digitalis_kompetencia'], ['elegedettseg', 'elegedettseg_meres'],
  ['vizsgaeredmenyek', 'szakmai_vizsga_eredmenyek'], ['egy_oktatora_juto_tanulo', 'engedelyezett_oratomeg'],
]) {
  test(`the "${right}" right no longer opens /${endpoint}`, () => {
    assert.equal(check(user([right]), 'GET', `/api/v1/${endpoint}`), 403);
  });
}
test('both neveltség rights open the shared /intezmenyi_neveltsegi_mutatok endpoint', () => {
  assert.equal(check(user(['intezmenyi_neveltseg']), 'PUT', '/api/v1/intezmenyi_neveltsegi_mutatok/1'), 200);
  assert.equal(check(user(['intezmenyi_neveltsegi_mutatok']), 'PUT', '/api/v1/intezmenyi_neveltsegi_mutatok/1'), 200);
});

// --- Method permissions -----------------------------------------------------------------------
for (const [method, access] of [['GET', 1], ['POST', 2], ['PUT', 4], ['PATCH', 4], ['DELETE', 8]]) {
  test(`${method} needs exactly its own bit`, () => {
    assert.equal(check(user(['dobbanto'], access), method, '/api/v1/dobbanto/1'), 200);
    assert.equal(check(user(['dobbanto'], 15 & ~access), method, '/api/v1/dobbanto/1'), 403);
  });
}

// --- General rules -------------------------------------------------------------------------------
test('unknown endpoints are denied', () => {
  assert.equal(check(user(LIVE_TABLES), 'GET', '/api/v1/nonexistent'), 403);
});
test('query strings and later path segments never grant access', () => {
  assert.equal(check(user(['kompetencia']), 'GET', '/api/v1/dobbanto?kompetencia=1'), 403);
  assert.equal(check(user(['kompetencia']), 'GET', '/api/v1/dobbanto/kompetencia'), 403);
  assert.equal(check(user(['tanugyi_adatok']), 'POST', '/api/v1/dobbanto/tanugyi_adatok'), 403);
});
test('dot segments are refused', () => {
  assert.equal(check(user(LIVE_TABLES), 'GET', '/api/v1/szakma/../users'), 403);
  assert.equal(check(user(LIVE_TABLES), 'GET', '/api/v1/dobbanto/./x'), 403);
});
test('public reads stay open, their writes do not', () => {
  for (const segment of PUBLIC_READ_SEGMENTS) assert.equal(check(user([]), 'GET', `/api/v1/${segment}/x`), 200, segment);
  assert.equal(check(user([]), 'POST', '/api/v1/tanugyi_adatok'), 403);
  assert.equal(check(user([]), 'POST', '/api/v1/szakma'), 403);
});
test('developers bypass table rights; missing user is 401', () => {
  assert.equal(check(user([], 0, 31), 'DELETE', '/api/v1/anything'), 200);
  assert.equal(check(undefined, 'GET', '/api/v1/dobbanto'), 401);
});

// --- Form history --------------------------------------------------------------------------------
// Names used by the frontend HistoryDialogs and by scheduleSnapshot in the services.
const SNAPSHOT_NAMES = [
  'IntezmenyiNeveltsegiMutatok', 'digitalisKompetencia', 'dobbanto', 'dualisKepzohelyek', 'egyOktatoraJutoTanulo',
  'egyuttmukudesek_szama', 'elegedettseg', 'elegedettsegMeres', 'elhelyezkedes', 'engedelyezettOratomeg',
  'engedelyezett_oratomeg', 'felvettek_Szama', 'hHEsHHHTanulok', 'hianyzas', 'innovaciosTevekenysegek',
  'intezmenyi_elismeresek', 'kompetencia', 'lemorzsolodas', 'muhelyiskola', 'munkavallalok_elismeresek', 'nszfhMeresek',
  'nyelvvizsgak_szama', 'oktatoEgyebTev', 'palya_orientacio', 'palyazatok', 'projektek', 'sajatosNevelesuTanulok',
  'szakkepzesZolditese', 'szakkepzesiMunkaszerzodesAranya', 'szakmaiRendezvenyek', 'szakmaiVizsgaEredmenyek',
  'szakmai_tovabbkepzes', 'szervezetfejlesztes', 'tanulmanyi_eredmeny', 'tanulo_Letszam', 'versenyek', 'vizsgaEredmenyek',
  'alkalmazottak_Munkaugy', 'tanugyi_Adatok', 'OktatoAdatszolg', 'TanuloAdatszolg', 'OsztalyAdatszolg',
];
for (const name of SNAPSHOT_NAMES) {
  test(`history "${name}" maps to a production table`, () => {
    const tables = tablesForSnapshot(name);
    assert.ok(tables.length > 0 && tables.every(t => LIVE_TABLES.includes(t)), `${name} -> ${JSON.stringify(tables)}`);
  });
}
test('specific history mappings', () => {
  assert.deepEqual(tablesForSnapshot('nszfhMeresek'), ['nszfh']);
  assert.deepEqual(tablesForSnapshot('szakkepzesiMunkaszerzodesAranya'), ['szmsz']);
  assert.deepEqual(tablesForSnapshot('tanulo_Letszam'), ['tanulo_letszam']);
  assert.deepEqual(tablesForSnapshot('palya_orientacio'), ['palyaorientacio']);
  assert.deepEqual(tablesForSnapshot('nonsense'), []);
});
test('history list needs the read right on that table', () => {
  assert.equal(check(user(['tanulo_letszam'], 1), 'GET', '/api/v1/form_history/s/tanulo_Letszam'), 200);
  assert.equal(check(user(['dobbanto']), 'GET', '/api/v1/form_history/s/tanulo_Letszam'), 403);
  assert.equal(check(user(LIVE_TABLES), 'GET', '/api/v1/form_history/s/nonsense'), 403);
});

// Rollback: checked in the controller after loading the snapshot.
let snapshots;
const rollback = mock.fn(async () => ({ ok: true }));
mock.module('../services/form_history.service.js', {
  namedExports: { getHistory: async () => [], getHistoryById: async id => snapshots[id] ?? null, rollback },
});
const { default: historyRouter } = await import('../controllers/form_history.controller.js');
let server;
let base;
let actor;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = actor; next(); });
  app.use('/api/v1/form_history', endpointAccess, historyRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { snapshots = { h1: { id: 'h1', table_name: 'tanulo_Letszam' } }; rollback.mock.resetCalls(); });
const doRollback = id => fetch(`${base}/api/v1/form_history/rollback/${id}`, { method: 'POST' });

test('rollback needs the update right on the snapshot table', async () => {
  actor = user(['tanulo_letszam'], 1);
  assert.equal((await doRollback('h1')).status, 403);
  actor = user(['dobbanto']);
  assert.equal((await doRollback('h1')).status, 403);
  assert.equal(rollback.mock.callCount(), 0);
  actor = user(['tanulo_letszam'], 5);
  assert.equal((await doRollback('h1')).status, 200);
  assert.equal(rollback.mock.callCount(), 1);
});
test('rollback of a missing (or other school\'s) snapshot is 404', async () => {
  actor = user(LIVE_TABLES);
  assert.equal((await doRollback('missing')).status, 404);
});
test('developers can roll back anything', async () => {
  actor = user([], 0, 31);
  assert.equal((await doRollback('h1')).status, 200);
});
