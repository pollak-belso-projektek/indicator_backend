/**
 * Row-level school isolation enforced in the Prisma layer.
 *
 * For a school-scoped request (see requestContext.js) every query on a model that
 * belongs to a school is rewritten so it can only read or write that school's rows:
 *   - reads / updates / deletes get `AND <field> = <own school>` added to `where`
 *   - creates and updates may not set the school to anything else
 * Requests from developers and HSZC users, and code running outside a request,
 * are left untouched.
 */
import { currentSchoolScope, currentUserId, markScopeViolation } from "./requestContext.js";

export class SchoolScopeError extends Error {
  constructor(message = "Nincs jogosultságod más iskola adataihoz!") {
    super(message);
    this.name = "SchoolScopeError";
    this.status = 403;
  }
}

const READ_MANY = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"]);
const READ_UNIQUE = new Set(["findUnique", "findUniqueOrThrow"]);
const WRITE_MANY = new Set(["updateMany", "updateManyAndReturn", "deleteMany"]);
const WRITE_UNIQUE = new Set(["update", "delete"]);
const CREATE = new Set(["create", "createMany", "createManyAndReturn"]);
const WRITE_OPS = new Set([...WRITE_MANY, ...WRITE_UNIQUE, ...CREATE, "upsert"]);

/**
 * Builds the model -> scope config map from Prisma's DMMF models.
 * Every model with an `alapadatok_id` column is scoped by it; additionally the
 * school itself (Alapadatok, by `id`) and users (User, by `alapadatokId`).
 */
export function scopeConfigFromModels(models) {
  const config = {};
  for (const model of models) {
    const fieldNames = new Set(model.fields.map((f) => f.name));
    const relationFor = (column) =>
      model.fields.find((f) => f.relationFromFields?.includes(column))?.name ?? null;
    if (fieldNames.has("alapadatok_id")) {
      config[model.name] = { field: "alapadatok_id", relation: relationFor("alapadatok_id") };
    } else if (model.name === "User" && fieldNames.has("alapadatokId")) {
      config[model.name] = { field: "alapadatokId", relation: relationFor("alapadatokId"), self: true };
    } else if (model.name === "Alapadatok") {
      config[model.name] = { field: "id", relation: null, isSchool: true };
    }
  }
  return config;
}

function scopeFilter(cfg, ctx) {
  const own = { [cfg.field]: ctx.schoolId };
  // A user may always see their own account, even without an assigned school.
  return cfg.self && ctx.userId ? { OR: [own, { id: ctx.userId }] } : own;
}

function withFilter(where, filter) {
  return where && Object.keys(where).length ? { AND: [where, filter] } : filter;
}

// Unique-where inputs must keep their unique fields at top level.
function withUniqueFilter(where, filter) {
  const and = where?.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
  return { ...where, AND: [...and, filter] };
}

function unwrapSet(value) {
  return value && typeof value === "object" && "set" in value ? value.set : value;
}

/** Validates (and for creates, fills in) the school of a data payload. */
function checkData(data, cfg, ctx, { isCreate }) {
  if (data === undefined || data === null) return data;
  if (Array.isArray(data)) return data.map((d) => checkData(d, cfg, ctx, { isCreate }));
  if (typeof data !== "object") return data;

  if (cfg.isSchool && isCreate) throw new SchoolScopeError("Nincs jogosultságod új iskola létrehozásához!");

  const result = { ...data };
  const hasField = Object.prototype.hasOwnProperty.call(result, cfg.field);
  const hasRelation = cfg.relation && Object.prototype.hasOwnProperty.call(result, cfg.relation);

  if (hasField && unwrapSet(result[cfg.field]) !== ctx.schoolId) throw new SchoolScopeError();
  if (hasRelation) {
    const rel = result[cfg.relation];
    const keys = rel && typeof rel === "object" ? Object.keys(rel) : [];
    if (keys.length !== 1 || keys[0] !== "connect" || rel.connect?.id !== ctx.schoolId) {
      throw new SchoolScopeError();
    }
  }
  if (isCreate && !hasField && !hasRelation) result[cfg.field] = ctx.schoolId;
  return result;
}

/** Returns the rewritten args for a school-scoped query; throws SchoolScopeError if forbidden. */
export function scopeArgs(operation, args = {}, cfg, ctx) {
  const filter = scopeFilter(cfg, ctx);
  if (READ_MANY.has(operation) || WRITE_MANY.has(operation)) {
    const next = { ...args, where: withFilter(args.where, filter) };
    if ("data" in args) next.data = checkData(args.data, cfg, ctx, { isCreate: false });
    return next;
  }
  if (READ_UNIQUE.has(operation) || WRITE_UNIQUE.has(operation)) {
    const next = { ...args, where: withUniqueFilter(args.where, filter) };
    if ("data" in args) next.data = checkData(args.data, cfg, ctx, { isCreate: false });
    return next;
  }
  if (CREATE.has(operation)) {
    return { ...args, data: checkData(args.data, cfg, ctx, { isCreate: true }) };
  }
  if (operation === "upsert") {
    return {
      ...args,
      where: withUniqueFilter(args.where, filter),
      create: checkData(args.create, cfg, ctx, { isCreate: true }),
      update: checkData(args.update, cfg, ctx, { isCreate: false }),
    };
  }
  // Unknown operation on school data: refuse rather than risk a leak.
  throw new SchoolScopeError();
}

/**
 * Prisma client extension. `getContext` is injectable for tests.
 */
export function createSchoolScopeExtension(config, getContext = () => ({
  schoolId: currentSchoolScope(),
  userId: currentUserId(),
})) {
  return {
    name: "schoolScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const cfg = config[model];
          const ctx = cfg ? getContext() : null;
          if (!ctx?.schoolId) return query(args);

          let scoped;
          try {
            scoped = scopeArgs(operation, args, cfg, ctx);
          } catch (error) {
            markScopeViolation();
            throw error;
          }
          try {
            return await query(scoped);
          } catch (error) {
            // "Record not found" on a scoped write usually means another school's row.
            if (error?.code === "P2025" && WRITE_OPS.has(operation)) markScopeViolation();
            throw error;
          }
        },
      },
    },
  };
}
