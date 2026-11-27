// Static consistency checks between the services and the Prisma schema. These catch
// typos in model names / field names that would otherwise only fail at runtime
// (often silently, e.g. inside a debounced background snapshot).
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

const models = Object.fromEntries([...read('prisma/schema.prisma').matchAll(/^model ([^\s{]+) \{([\s\S]*?)^\}/gm)]
  .map(([, name, body]) => [name, body.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(f => /^\w/.test(f))]));
const lowerFirst = s => s[0].toLowerCase() + s.slice(1);
// Prisma exposes each model as a lowerCamel delegate and also under the exact model name.
const delegates = new Map(Object.keys(models).flatMap(m => [[lowerFirst(m), m], [m, m]]));

const serviceFiles = readdirSync(new URL('services/', root)).filter(f => f.endsWith('.js'));
const patterns = serviceFiles.flatMap(file => [...read(`services/${file}`).matchAll(/new ServicePattern\(\s*['"]([^'"]+)['"]([\s\S]*?)\);/g)]
  .map(([, name, rest]) => ({
    file, name,
    yearField: (rest.match(/yearField:\s*['"]([^'"]+)/) || [])[1] || 'tanev_kezdete',
    alapadatokField: (rest.match(/alapadatokField:\s*['"]([^'"]+)/) || [])[1] || 'alapadatok_id',
    usesYear: new RegExp(`pattern\\.(findAllByYear|findByAlapadatokIdAndYear|deleteByAlapadatokIdAnd(Exact)?Year|findAllCurrentYear|findByAlapadatokCurrentYear)`).test(read(`services/${file}`)),
  })));

test('the scan found the services', () => {
  assert.ok(patterns.length >= 40, `found ${patterns.length}`);
});

for (const p of patterns) {
  test(`${p.file}: ServicePattern("${p.name}") is a real Prisma model`, () => {
    assert.ok(delegates.has(p.name), `no Prisma delegate named "${p.name}"`);
  });
  const model = models[delegates.get(p.name)];
  if (!model) continue;
  if (model.includes('alapadatok_id') || p.usesYear) {
    test(`${p.file}: alapadatok field "${p.alapadatokField}" exists on ${delegates.get(p.name)}`, () => {
      assert.ok(model.includes(p.alapadatokField));
    });
  }
  if (p.usesYear) {
    test(`${p.file}: year field "${p.yearField}" exists on ${delegates.get(p.name)}`, () => {
      assert.ok(model.includes(p.yearField), `fields: ${model.join(', ')}`);
    });
  }
}

// --- Form history snapshots resolve every table name to a model ---------------------
const fakePrisma = Object.fromEntries(Object.keys(models).map(m => [lowerFirst(m), { findMany: async () => [] }]));
mock.module('../utils/prisma.js', { defaultExport: fakePrisma });
const { getPrismaModelName } = await import('../services/form_history.service.js');

const snapshotNames = new Set([
  ...patterns.filter(p => p.name !== 'formHistory').map(p => p.name),
  ...serviceFiles.flatMap(f => [...read(`services/${f}`).matchAll(/scheduleSnapshot\([^,]+,\s*['"]([^'"]+)['"]\)/g)].map(m => m[1])),
]);
for (const name of snapshotNames) {
  test(`form history snapshot for "${name}" finds its table`, () => {
    const resolved = getPrismaModelName(name);
    assert.ok(fakePrisma[resolved], `"${name}" resolved to "${resolved}", which is not a delegate`);
  });
}
