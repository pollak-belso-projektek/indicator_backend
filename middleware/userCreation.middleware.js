const USER_ROLES = [1, 2, 4, 9, 10, 15, 31];
const SCHOOL_ROLES = [1, 2, 4];
const CENTRAL_ADMIN_ROLES = [1, 2, 4, 9, 10];

export default function userCreationMiddleware(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const { isAdmin, isHSZC, isSuperadmin } = user.permissionsDetails || {};
  if (!isAdmin && !isSuperadmin) {
    return res.status(403).json({ message: "Csak adminisztrátor vagy fejlesztő hozhat létre felhasználót!" });
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Érvénytelen felhasználói adatok!" });
  }

  const targetRole = req.body.permissions === undefined ? 1 : req.body.permissions;
  if (!Number.isInteger(targetRole) || !USER_ROLES.includes(targetRole)) {
    return res.status(400).json({ message: "Érvénytelen felhasználótípus!" });
  }

  const allowedRoles = isSuperadmin ? USER_ROLES : isHSZC ? CENTRAL_ADMIN_ROLES : SCHOOL_ROLES;
  if (!allowedRoles.includes(targetRole)) {
    return res.status(403).json({ message: "Nincs jogosultságod ilyen típusú felhasználót létrehozni!" });
  }

  if (!isSuperadmin && !isHSZC) {
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
