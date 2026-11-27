import {
  ENDPOINT_TABLES,
  PUBLIC_READ_SEGMENTS,
  tablesForSnapshot,
  userHasTableAccess,
} from "../utils/tableAccessMap.js";

const FORBIDDEN = { message: "Forbidden - You don't have access to this endpoint" };

/**
 * Table-permission check for every router mounted on protectedRouter.
 * The endpoint is identified by its first path segment after /api/v1/ and mapped to
 * its permission table(s) explicitly (utils/tableAccessMap.js) – no substring
 * matching, query strings never count, unknown endpoints are denied.
 */
export default function endpointAccessMiddleware(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Developers bypass table permissions.
  if (user.permissionsDetails?.isSuperadmin) {
    return next();
  }

  const path = req.originalUrl.split("?")[0].replace(/^\/api\/v1\/?/, "");
  const [segment, ...rest] = path.split("/").map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  const method = req.method;

  // Dot segments never name an endpoint; refuse them instead of guessing.
  if ([segment, ...rest].some((part) => part === "." || part === "..")) {
    return res.status(403).json(FORBIDDEN);
  }

  if ((method === "GET" || method === "HEAD") && PUBLIC_READ_SEGMENTS.has(segment)) {
    return next();
  }

  if (!Object.prototype.hasOwnProperty.call(ENDPOINT_TABLES, segment)) {
    return res.status(403).json(FORBIDDEN);
  }

  if (segment === "form_history") {
    // GET /form_history/:alapadatok_id/:table_name -> read right on that table.
    if (method === "GET") {
      return userHasTableAccess(user, tablesForSnapshot(rest[1]), "GET")
        ? next()
        : res.status(403).json(FORBIDDEN);
    }
    // POST /form_history/rollback/:id -> the controller checks the update right on
    // the snapshot's table once it has loaded the snapshot.
    if (method === "POST" && rest[0] === "rollback") return next();
    return res.status(403).json(FORBIDDEN);
  }

  return userHasTableAccess(user, ENDPOINT_TABLES[segment], method)
    ? next()
    : res.status(403).json(FORBIDDEN);
}
