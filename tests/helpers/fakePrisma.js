// Minimal in-memory stand-in for a Prisma client, used to run real services and
// controllers in tests without a database. Query extensions are applied the same
// way Prisma applies `query.$allModels.$allOperations`, so the real school-scope
// extension sits between the services and this store.
import { randomUUID } from "node:crypto";

function matchesValue(actual, cond) {
  if (cond === null || typeof cond !== "object" || cond instanceof Date) return actual === cond;
  return Object.entries(cond).every(([op, v]) => {
    switch (op) {
      case "equals": return actual === v;
      case "not": return !matchesValue(actual, v);
      case "in": return v.includes(actual);
      case "notIn": return !v.includes(actual);
      case "gt": return actual > v;
      case "gte": return actual >= v;
      case "lt": return actual < v;
      case "lte": return actual <= v;
      default: throw new Error(`fakePrisma: unsupported operator ${op}`);
    }
  });
}

export function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return [].concat(cond).every((w) => matches(row, w));
    if (key === "OR") return cond.some((w) => matches(row, w));
    if (key === "NOT") return ![].concat(cond).some((w) => matches(row, w));
    // Compound unique input, e.g. { alapadatok_id_tanev: { alapadatok_id, tanev } }
    if (cond && typeof cond === "object" && !(key in row) && !Array.isArray(cond)) return matches(row, cond);
    return matchesValue(row[key], cond);
  });
}

function notFound() {
  const error = new Error("Record to update not found.");
  error.code = "P2025";
  return error;
}

function applyData(row, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    row[k] = v && typeof v === "object" && "set" in v ? v.set : v;
  }
  return row;
}

function makeStore(tables) {
  const rows = (model) => (tables[model] ??= []);
  return {
    findMany: (m, a = {}) => rows(m).filter((r) => matches(r, a.where)).map((r) => ({ ...r })),
    findFirst: (m, a = {}) => rows(m).find((r) => matches(r, a.where)) ?? null,
    findUnique: (m, a = {}) => rows(m).find((r) => matches(r, a.where)) ?? null,
    findUniqueOrThrow: (m, a = {}) => rows(m).find((r) => matches(r, a.where)) ?? (() => { throw notFound(); })(),
    count: (m, a = {}) => rows(m).filter((r) => matches(r, a.where)).length,
    create: (m, a) => { const r = applyData({ id: randomUUID() }, a.data); rows(m).push(r); return { ...r }; },
    createMany: (m, a) => { [].concat(a.data).forEach((d) => rows(m).push(applyData({ id: randomUUID() }, d))); return { count: [].concat(a.data).length }; },
    update: (m, a) => { const r = rows(m).find((x) => matches(x, a.where)); if (!r) throw notFound(); return { ...applyData(r, a.data) }; },
    updateMany: (m, a) => { const hit = rows(m).filter((x) => matches(x, a.where)); hit.forEach((r) => applyData(r, a.data)); return { count: hit.length }; },
    delete: (m, a) => { const i = rows(m).findIndex((x) => matches(x, a.where)); if (i < 0) throw notFound(); return rows(m).splice(i, 1)[0]; },
    deleteMany: (m, a = {}) => { const keep = rows(m).filter((x) => !matches(x, a.where)); const n = rows(m).length - keep.length; tables[m] = keep; return { count: n }; },
    groupBy: (m, a) => {
      const groups = new Map();
      for (const r of rows(m).filter((x) => matches(x, a.where))) {
        const key = JSON.stringify(a.by.map((f) => r[f]));
        if (!groups.has(key)) groups.set(key, { rows: [], values: Object.fromEntries(a.by.map((f) => [f, r[f]])) });
        groups.get(key).rows.push(r);
      }
      return [...groups.values()].map(({ rows: rs, values }) => ({
        ...values,
        ...(a._count ? { _count: a._count === true ? rs.length : Object.fromEntries(Object.keys(a._count).map((f) => [f, rs.length])) } : {}),
        ...(a._sum ? { _sum: Object.fromEntries(Object.keys(a._sum).map((f) => [f, rs.reduce((t, r) => t + (r[f] ?? 0), 0)])) } : {}),
      }));
    },
    upsert: (m, a) => {
      const r = rows(m).find((x) => matches(x, a.where));
      if (r) return { ...applyData(r, a.update) };
      const created = applyData({ id: randomUUID() }, a.create); rows(m).push(created); return { ...created };
    },
  };
}

/**
 * @param {Record<string, string>} delegates  delegate name -> model name, e.g. { dobbanto: "Dobbanto" }
 * @param {object} [extension]                a Prisma extension object with query.$allModels.$allOperations
 * @param {Record<string, object[]>} [tables] initial rows per model name
 */
export function createFakePrisma(delegates, extension, tables = {}) {
  const store = makeStore(tables);
  const hook = extension?.query?.$allModels?.$allOperations;
  const client = { tables };
  client.$transaction = async (arg) => (typeof arg === "function" ? arg(client) : Promise.all(arg));
  client.$queryRaw = async () => [];
  for (const [delegate, model] of Object.entries(delegates)) {
    client[delegate] = new Proxy({}, {
      get: (_, operation) => async (args) => {
        const query = async (a) => {
          if (!store[operation]) throw new Error(`fakePrisma: unsupported operation ${operation}`);
          return store[operation](model, a);
        };
        return hook ? hook({ model, operation, args, query }) : query(args);
      },
    });
  }
  return client;
}
