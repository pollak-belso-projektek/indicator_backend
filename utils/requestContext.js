import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context (the acting user) available to deeper layers – the Prisma
 * school-scope extension and the cache – without threading `req` through services.
 * Outside a request (startup, background jobs, auth lookups) there is no context
 * and nothing is scoped.
 */
const storage = new AsyncLocalStorage();

/** Matches no school: used when a school-scoped user has no school assigned. */
export const NO_SCHOOL = "00000000-0000-0000-0000-000000000000";

/**
 * Only developers (superadmin) and HSZC (central) users may see other schools.
 * Everyone else – school admin, standard and privileged users – is limited to their own.
 */
export function isSchoolScopedUser(user) {
  const { isSuperadmin, isHSZC } = user?.permissionsDetails || {};
  return !isSuperadmin && !isHSZC;
}

/** The school a user is restricted to, or null when they may see every school. */
export function schoolScopeFor(user) {
  if (!isSchoolScopedUser(user)) return null;
  const id = user?.alapadatokId;
  return typeof id === "string" && id ? id : NO_SCHOOL;
}

export function createRequestContext(user) {
  return { user, schoolId: schoolScopeFor(user), violation: false };
}

export function runWithContext(context, fn) {
  return storage.run(context, fn);
}

export function runWithUser(user, fn) {
  return runWithContext(createRequestContext(user), fn);
}

/** Current request's school restriction, or null (unrestricted / no request). */
export function currentSchoolScope() {
  return storage.getStore()?.schoolId ?? null;
}

export function currentUserId() {
  return storage.getStore()?.user?.id ?? null;
}

/** Records that a query was blocked, so the response can become a 403 instead of a 500. */
export function markScopeViolation() {
  const store = storage.getStore();
  if (store) store.violation = true;
}

export function hasScopeViolation() {
  return storage.getStore()?.violation === true;
}
