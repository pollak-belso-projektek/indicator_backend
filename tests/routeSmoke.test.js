// Smoke test: every GET route of every mounted router answers without a server
// error when backed by an (empty or seeded) in-memory database. Catches runtime
// typos (wrong model/field names, missing awaits, crashes on empty data) that the
// unit tests of individual services would not reach.
import { after, before, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import { createFakePrisma } from './helpers/fakePrisma.js';
import { mapUserPermissions } from '../utils/permissions.js';
import { createSchoolScopeExtension, scopeConfigFromModels } from '../utils/schoolScope.js';
import { modelsFromSchema } from './helpers/schema.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const modelNames = [...read('prisma/schema.prisma').matchAll(/^model ([^\s{]+) \{/gm)].map(m => m[1]);
const delegates = Object.fromEntries(modelNames.flatMap(m => [[m[0].toLowerCase() + m.slice(1), m], [m, m]]));

const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tables = { Alapadatok: [{ id: school, iskola_neve: 'Teszt', deleted: false, alapadatok_szakma: [], alapadatok_szakirany: [] }] };
// The real school-scope extension sits in front of the fake database, as in production.
const prisma = createFakePrisma(delegates, createSchoolScopeExtension(scopeConfigFromModels(modelsFromSchema())), tables);
mock.module('../utils/prisma.js', {
  defaultExport: prisma,
  namedExports: { initializeDatabase: async () => ({}), testDatabaseConnection: async () => {}, withRetry: fn => fn() },
});
// External services must never be called from tests.
mock.module('../services/bugReport.service.js', {
  namedExports: { createBugReport: async () => ({}), getReportedBugs: async () => [], updateBugStatus: async () => ({}), getBugAttachment: async () => ({ buffer: Buffer.from(''), mimeType: 'text/plain', name: 'x' }) },
});

const i = await import('../utils/imports.js');
const { createSchoolScopeMiddleware } = await import('../middleware/schoolScope.middleware.js');

// Router mounts exactly as declared in index.js.
const mounts = [...read('index.js').matchAll(/(?:protectedRouter|apiRouter)\.use\(\s*"(\/[^"]+)",\s*(?:requireSuperadmin,\s*)?i\.([\wé]+)\s*,?\s*\)/g)]
  .map(([, prefix, name]) => ({ prefix, router: i[name], name }));

const actors = {
  developer: { id: 'dev', permissions: 31, permissionsDetails: mapUserPermissions(31), alapadatokId: null, tableAccess: [] },
  schoolAdmin: { id: 'adm', permissions: 4, permissionsDetails: mapUserPermissions(4), alapadatokId: school, tableAccess: [] },
};
const PARAM_VALUES = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'nobody@example.invalid' };
const paramValue = name => /alapadatok/i.test(name) ? school
  : /tanev|ev$|year/i.test(name) ? '2025'
  : PARAM_VALUES[name] ?? 'x';

const routes = mounts.flatMap(({ prefix, router, name }) => (router?.stack ?? [])
  .filter(l => l.route?.methods?.get && typeof l.route.path === 'string')
  .map(l => ({ name, url: `/api/v1${prefix}${l.route.path.replace(/:(\w+)\??/g, (_, p) => paramValue(p))}`.replace(/\/$/, '') })));

let server;
let base;
const errors = [];
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = actors[req.headers['x-test-actor']]; next(); });
  app.use(createSchoolScopeMiddleware({ loadSchoolIds: async () => [school] }));
  const api = express.Router();
  for (const { prefix, router } of mounts) api.use(prefix, router);
  app.use('/api/v1', api);
  app.use((err, req, res, next) => { errors.push(err); res.status(500).json({ error: err.message }); });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('index.js mounts were discovered', () => {
  assert.ok(mounts.length >= 45, `found ${mounts.length} mounts`);
  for (const m of mounts) assert.ok(m.router, `i.${m.name} is not exported from utils/imports.js`);
  assert.ok(routes.length >= 80, `found ${routes.length} GET routes`);
});

for (const actor of Object.keys(actors)) {
  for (const { name, url } of routes) {
    test(`${actor}: GET ${url} (${name}) does not crash`, async () => {
      const res = await fetch(`${base}${url}`, { headers: { 'x-test-actor': actor } });
      const body = await res.text();
      assert.ok(res.status < 500, `HTTP ${res.status}: ${body.slice(0, 300)}`);
    });
  }
}
