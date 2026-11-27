import { createRequestContext, runWithContext } from "../utils/requestContext.js";

const FORBIDDEN_MESSAGE = "Nincs jogosultságod más iskola adataihoz!";
const SCHOOL_KEY = /^alapadatok(_?id)?$/i;
const SCHOOL_IDS_TTL = 5 * 60 * 1000;

function decode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function* queryValues(query) {
  for (const value of Object.values(query || {})) {
    if (Array.isArray(value)) yield* value.filter((v) => typeof v === "string");
    else if (typeof value === "string") yield value;
  }
}

/** Values of alapadatok_id / alapadatokId / alapadatok keys anywhere in the body. */
function* bodySchoolValues(body, depth = 0) {
  if (!body || typeof body !== "object" || depth > 10) return;
  for (const [key, value] of Object.entries(body)) {
    if (SCHOOL_KEY.test(key) && typeof value === "string") yield value;
    else if (value && typeof value === "object") yield* bodySchoolValues(value, depth + 1);
  }
}

/** Returns true when the request explicitly references a school other than `own`. */
export function referencesForeignSchool(req, own, schoolIds) {
  const isForeign = (v) => v !== own && schoolIds.has(v);
  const path = (req.originalUrl || req.url || "").split("?")[0];
  if (path.split("/").map(decode).some(isForeign)) return true;
  for (const v of queryValues(req.query)) if (isForeign(v)) return true;
  for (const v of bodySchoolValues(req.body)) if (v !== own) return true;
  return false;
}

/**
 * Must run right after authMiddleware. Starts the per-request context used by the
 * Prisma school-scope extension and the cache, and for school-scoped users:
 *   - rejects requests that name another school in the path, query or body (403)
 *   - turns a 5xx caused by a blocked query into a 403 instead of an internal error
 *
 * @param {{ loadSchoolIds: () => Promise<Iterable<string>> }} options
 */
export function createSchoolScopeMiddleware({ loadSchoolIds }) {
  let cached = null;
  let cachedAt = 0;

  async function schoolIds() {
    if (!cached || Date.now() - cachedAt > SCHOOL_IDS_TTL) {
      try {
        cached = new Set(await loadSchoolIds());
        cachedAt = Date.now();
      } catch (error) {
        console.error("School scope: failed to load school ids:", error.message);
        return cached ?? new Set();
      }
    }
    return cached;
  }

  return async function schoolScopeMiddleware(req, res, next) {
    const context = createRequestContext(req.user);

    if (context.schoolId) {
      if (referencesForeignSchool(req, context.schoolId, await schoolIds())) {
        return res.status(403).json({ message: FORBIDDEN_MESSAGE });
      }

      let converted = false;
      const status = res.status.bind(res);
      const json = res.json.bind(res);
      res.status = (code) => {
        if (code >= 500 && context.violation) {
          converted = true;
          return status(403);
        }
        return status(code);
      };
      res.json = (body) => json(converted ? { message: FORBIDDEN_MESSAGE } : body);
    }

    return runWithContext(context, next);
  };
}

/** Lets only developers (superadmin) through, judged by the real, non-impersonated user. */
export function requireSuperadmin(req, res, next) {
  const realUser = req.impersonator ?? req.user;
  if (!realUser) return res.status(401).json({ message: "Unauthorized" });
  if (!realUser.permissionsDetails?.isSuperadmin) {
    return res.status(403).json({ message: "Csak fejlesztő érheti el!" });
  }
  return next();
}
