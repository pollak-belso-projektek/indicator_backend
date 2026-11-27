import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeArgs, scopeConfigFromModels, createSchoolScopeExtension, SchoolScopeError } from '../utils/schoolScope.js';
import { schoolScopeFor, NO_SCHOOL, runWithUser, hasScopeViolation, currentSchoolScope } from '../utils/requestContext.js';
import { mapUserPermissions } from '../utils/permissions.js';
import { modelsFromSchema } from './helpers/schema.js';

const own = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ctx = { schoolId: own, userId: 'me' };
const cfg = { field: 'alapadatok_id', relation: 'alapadatok' };
const ownFilter = { alapadatok_id: own };

// --- Who is scoped -----------------------------------------------------------
for (const [role, scoped] of [[1, true], [2, true], [4, true], [9, false], [10, false], [15, false], [31, false]]) {
  test(`role ${role} is ${scoped ? '' : 'not '}limited to own school`, () => {
    const user = { permissionsDetails: mapUserPermissions(role), alapadatokId: own };
    assert.equal(schoolScopeFor(user), scoped ? own : null);
  });
}
test('school-scoped user without a school sees nothing (sentinel school)', () => {
  assert.equal(schoolScopeFor({ permissionsDetails: mapUserPermissions(4), alapadatokId: null }), NO_SCHOOL);
});
test('missing user is treated as scoped to no school', () => {
  assert.equal(schoolScopeFor(undefined), NO_SCHOOL);
});

// --- Reads -------------------------------------------------------------------
for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']) {
  test(`${op} without where is limited to own school`, () => {
    assert.deepEqual(scopeArgs(op, {}, cfg, ctx).where, ownFilter);
  });
  test(`${op} keeps the original filter and adds own school`, () => {
    const where = { tanev_kezdete: { gte: 2024 } };
    assert.deepEqual(scopeArgs(op, { where }, cfg, ctx).where, { AND: [where, ownFilter] });
  });
  test(`${op} asking for another school still gets own school filter (empty result)`, () => {
    const where = { alapadatok_id: other };
    assert.deepEqual(scopeArgs(op, { where }, cfg, ctx).where, { AND: [where, ownFilter] });
  });
}
for (const op of ['findUnique', 'findUniqueOrThrow']) {
  test(`${op} keeps unique key at top level and adds own school`, () => {
    assert.deepEqual(scopeArgs(op, { where: { id: 'x' } }, cfg, ctx).where, { id: 'x', AND: [ownFilter] });
  });
  test(`${op} merges with an existing AND`, () => {
    assert.deepEqual(scopeArgs(op, { where: { id: 'x', AND: { a: 1 } } }, cfg, ctx).where, { id: 'x', AND: [{ a: 1 }, ownFilter] });
  });
}
test('other args (include/select/orderBy) are preserved', () => {
  const args = { where: { id: 'x' }, include: { alapadatok: true }, orderBy: { id: 'asc' } };
  const out = scopeArgs('findMany', args, cfg, ctx);
  assert.deepEqual(out.include, args.include);
  assert.deepEqual(out.orderBy, args.orderBy);
});
test('input args are not mutated', () => {
  const args = { where: { id: 'x' }, data: { alapadatok_id: own } };
  const copy = structuredClone(args);
  scopeArgs('update', args, cfg, ctx);
  assert.deepEqual(args, copy);
});

// --- Writes ------------------------------------------------------------------
for (const op of ['update', 'delete']) {
  test(`${op} only matches own school rows`, () => {
    assert.deepEqual(scopeArgs(op, { where: { id: 'x' } }, cfg, ctx).where, { id: 'x', AND: [ownFilter] });
  });
}
for (const op of ['updateMany', 'deleteMany', 'updateManyAndReturn']) {
  test(`${op} only matches own school rows`, () => {
    assert.deepEqual(scopeArgs(op, { where: { alapadatok_id: other } }, cfg, ctx).where, { AND: [{ alapadatok_id: other }, ownFilter] });
  });
}
test('update cannot move a row to another school', () => {
  assert.throws(() => scopeArgs('update', { where: { id: 'x' }, data: { alapadatok_id: other } }, cfg, ctx), SchoolScopeError);
});
test('update cannot move a row via { set }', () => {
  assert.throws(() => scopeArgs('updateMany', { where: {}, data: { alapadatok_id: { set: other } } }, cfg, ctx), SchoolScopeError);
});
test('update keeping own school is allowed', () => {
  assert.deepEqual(scopeArgs('update', { where: { id: 'x' }, data: { alapadatok_id: own, n: 1 } }, cfg, ctx).data, { alapadatok_id: own, n: 1 });
});
test('update without school field leaves data alone', () => {
  assert.deepEqual(scopeArgs('update', { where: { id: 'x' }, data: { n: 1 } }, cfg, ctx).data, { n: 1 });
});
test('create for own school is allowed', () => {
  assert.deepEqual(scopeArgs('create', { data: { alapadatok_id: own, n: 1 } }, cfg, ctx).data, { alapadatok_id: own, n: 1 });
});
test('create for another school is rejected', () => {
  assert.throws(() => scopeArgs('create', { data: { alapadatok_id: other } }, cfg, ctx), SchoolScopeError);
});
test('create without school is assigned to own school', () => {
  assert.deepEqual(scopeArgs('create', { data: { n: 1 } }, cfg, ctx).data, { n: 1, alapadatok_id: own });
});
test('create via relation connect to own school is allowed', () => {
  const data = { alapadatok: { connect: { id: own } } };
  assert.deepEqual(scopeArgs('create', { data }, cfg, ctx).data, data);
});
for (const rel of [{ connect: { id: other } }, { create: { iskola_neve: 'x' } }, { connectOrCreate: {} }, { disconnect: true }, { connect: { id: own }, create: {} }]) {
  test(`relation write ${JSON.stringify(rel)} is rejected`, () => {
    assert.throws(() => scopeArgs('create', { data: { alapadatok: rel } }, cfg, ctx), SchoolScopeError);
  });
}
test('createMany rejects if any row belongs to another school', () => {
  assert.throws(() => scopeArgs('createMany', { data: [{ alapadatok_id: own }, { alapadatok_id: other }] }, cfg, ctx), SchoolScopeError);
});
test('createMany fills missing school on every row', () => {
  assert.deepEqual(scopeArgs('createMany', { data: [{ n: 1 }, { n: 2, alapadatok_id: own }] }, cfg, ctx).data,
    [{ n: 1, alapadatok_id: own }, { n: 2, alapadatok_id: own }]);
});
test('upsert scopes where and checks both create and update', () => {
  const out = scopeArgs('upsert', { where: { id: 'x' }, create: { n: 1 }, update: { n: 2 } }, cfg, ctx);
  assert.deepEqual(out.where, { id: 'x', AND: [ownFilter] });
  assert.deepEqual(out.create, { n: 1, alapadatok_id: own });
  assert.throws(() => scopeArgs('upsert', { where: { id: 'x' }, create: { alapadatok_id: other }, update: {} }, cfg, ctx), SchoolScopeError);
  assert.throws(() => scopeArgs('upsert', { where: { id: 'x' }, create: {}, update: { alapadatok_id: other } }, cfg, ctx), SchoolScopeError);
});
test('unknown operations on school data are refused', () => {
  assert.throws(() => scopeArgs('findRaw', {}, cfg, ctx), SchoolScopeError);
});

// --- School (Alapadatok) and User models ---------------------------------------
const schoolCfg = { field: 'id', relation: null, isSchool: true };
test('school users only see their own school record', () => {
  assert.deepEqual(scopeArgs('findMany', {}, schoolCfg, ctx).where, { id: own });
});
test('school users cannot create schools', () => {
  assert.throws(() => scopeArgs('create', { data: { iskola_neve: 'x' } }, schoolCfg, ctx), SchoolScopeError);
});
test('school users can update only their own school record', () => {
  assert.deepEqual(scopeArgs('update', { where: { id: other }, data: {} }, schoolCfg, ctx).where, { id: other, AND: [{ id: own }] });
});
const userCfg = { field: 'alapadatokId', relation: 'alapadatok', self: true };
test('users list is limited to own school plus own account', () => {
  assert.deepEqual(scopeArgs('findMany', {}, userCfg, ctx).where, { OR: [{ alapadatokId: own }, { id: 'me' }] });
});
test('user cannot be moved to another school', () => {
  assert.throws(() => scopeArgs('update', { where: { id: 'u' }, data: { alapadatokId: other } }, userCfg, ctx), SchoolScopeError);
});

// --- Config derived from the real schema ----------------------------------------
test('every model with alapadatok_id is school-scoped (incl. future models)', () => {
  const models = modelsFromSchema();
  const config = scopeConfigFromModels(models);
  const withSchool = models.filter(m => m.fields.some(f => f.name === 'alapadatok_id'));
  assert.ok(withSchool.length >= 30, `expected many school models, got ${withSchool.length}`);
  for (const m of withSchool) {
    assert.equal(config[m.name]?.field, 'alapadatok_id', `${m.name} must be scoped`);
    assert.equal(config[m.name]?.relation, 'alapadatok', `${m.name} relation name`);
  }
  assert.deepEqual(config.User, { field: 'alapadatokId', relation: 'alapadatok', self: true });
  assert.equal(config.Alapadatok?.field, 'id');
});
test('global models (logs, table list, dictionaries) are not scoped', () => {
  const config = scopeConfigFromModels(modelsFromSchema());
  for (const name of ['Log', 'TableList', 'TableAccess', 'Szakma', 'Szakirany', 'Changelog', 'Session']) {
    assert.equal(config[name], undefined, name);
  }
});

// --- Extension wiring --------------------------------------------------------
const ext = createSchoolScopeExtension({ Dobbanto: cfg });
const hook = ext.query.$allModels.$allOperations;
test('extension passes queries through unchanged when not scoped', async () => {
  const args = { where: { alapadatok_id: other } };
  const seen = await hook({ model: 'Dobbanto', operation: 'findMany', args, query: async a => a });
  assert.equal(seen, args);
});
test('extension passes unscoped models through for school users', async () => {
  await runWithUser({ permissionsDetails: mapUserPermissions(4), alapadatokId: own }, async () => {
    const args = { where: {} };
    assert.equal(await hook({ model: 'Log', operation: 'findMany', args, query: async a => a }), args);
  });
});
test('extension scopes queries inside a school user request', async () => {
  await runWithUser({ id: 'me', permissionsDetails: mapUserPermissions(4), alapadatokId: own }, async () => {
    assert.equal(currentSchoolScope(), own);
    const seen = await hook({ model: 'Dobbanto', operation: 'findMany', args: {}, query: async a => a });
    assert.deepEqual(seen.where, ownFilter);
  });
});
test('extension marks a violation when a write is blocked', async () => {
  await runWithUser({ permissionsDetails: mapUserPermissions(4), alapadatokId: own }, async () => {
    await assert.rejects(hook({ model: 'Dobbanto', operation: 'create', args: { data: { alapadatok_id: other } }, query: async a => a }), SchoolScopeError);
    assert.equal(hasScopeViolation(), true);
  });
});
test('extension marks a violation when a scoped write finds no row (other school id)', async () => {
  await runWithUser({ permissionsDetails: mapUserPermissions(4), alapadatokId: own }, async () => {
    const query = async () => { throw Object.assign(new Error('not found'), { code: 'P2025' }); };
    await assert.rejects(hook({ model: 'Dobbanto', operation: 'update', args: { where: { id: 'x' }, data: {} }, query }));
    assert.equal(hasScopeViolation(), true);
  });
});
test('context does not leak between concurrent requests', async () => {
  const results = await Promise.all([own, other].map(school =>
    runWithUser({ permissionsDetails: mapUserPermissions(4), alapadatokId: school }, async () => {
      await new Promise(r => setTimeout(r, 5));
      return currentSchoolScope();
    })));
  assert.deepEqual(results, [own, other]);
  assert.equal(currentSchoolScope(), null);
});
