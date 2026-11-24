export const USER_ROLES = [1, 2, 4, 9, 10, 15, 31];
const SCHOOL_ROLES = [1, 2, 4];
const CENTRAL_ADMIN_ROLES = [1, 2, 4, 9, 10];

/** Roles the acting user may assign, or null if they may not manage users at all. */
export function assignableRoles(actor) {
  const { isAdmin, isHSZC, isSuperadmin } = actor?.permissionsDetails || {};
  if (isSuperadmin) return USER_ROLES;
  if (!isAdmin) return null;
  return isHSZC ? CENTRAL_ADMIN_ROLES : SCHOOL_ROLES;
}

/** True when the actor is a school-level admin, restricted to their own school. */
export function isSchoolScoped(actor) {
  const { isHSZC, isSuperadmin } = actor?.permissionsDetails || {};
  return !isSuperadmin && !isHSZC;
}

/**
 * Checks whether `actor` may modify an existing `target` user (update, password, inactivate).
 * Returns null when allowed, otherwise `{ status, message }`.
 * A target is manageable only if the actor could have created it: same school for
 * school admins, and a current role inside the actor's assignable roles.
 */
export function checkTargetAccess(actor, target) {
  const roles = assignableRoles(actor);
  if (!roles) {
    return { status: 403, message: "Csak adminisztrátor vagy fejlesztő módosíthat felhasználót!" };
  }
  if (actor.permissionsDetails.isSuperadmin) return null;
  if (!target) {
    return { status: 403, message: "Nincs jogosultságod a felhasználó módosításához!" };
  }
  if (isSchoolScoped(actor)) {
    const ownSchool = actor.alapadatokId;
    if (typeof ownSchool !== "string" || !ownSchool || target.alapadatokId !== ownSchool) {
      return { status: 403, message: "Nincs jogosultságod más iskola felhasználójának módosításához!" };
    }
  }
  if (!roles.includes(target.permissions)) {
    return { status: 403, message: "Nincs jogosultságod ilyen típusú felhasználó módosításához!" };
  }
  return null;
}

export default function userCreationMiddleware(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const allowedRoles = assignableRoles(user);
  if (!allowedRoles) {
    return res.status(403).json({ message: "Csak adminisztrátor vagy fejlesztő hozhat létre felhasználót!" });
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Érvénytelen felhasználói adatok!" });
  }

  const targetRole = req.body.permissions === undefined ? 1 : req.body.permissions;
  if (!Number.isInteger(targetRole) || !USER_ROLES.includes(targetRole)) {
    return res.status(400).json({ message: "Érvénytelen felhasználótípus!" });
  }

  if (!allowedRoles.includes(targetRole)) {
    return res.status(403).json({ message: "Nincs jogosultságod ilyen típusú felhasználót létrehozni!" });
  }

  if (isSchoolScoped(user)) {
    const ownSchool = user.alapadatokId;
    const requestedSchool = req.body.alapadatokId;
    if (typeof ownSchool !== "string" || !ownSchool ||
        (requestedSchool != null && requestedSchool !== ownSchool)) {
      return res.status(403).json({ message: "Csak a saját iskoládhoz hozhatsz létre felhasználót!" });
    }
    // Never let school admins create an unassigned user, even if the field is omitted.
    req.body.alapadatokId = ownSchool;
  }

  req.body.permissions = targetRole;
  next();
}
