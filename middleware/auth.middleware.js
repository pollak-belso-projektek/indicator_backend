import { refreshAccessToken, getUserFromToken } from "../utils/tokenClient.js";
import { getById } from "../services/user.service.js";

export async function authMiddleware(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token is missing" });
  }

  try {
    // Use getUserFromToken which has built-in caching
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ message: "Invalid user token" });
    }

    req.user = user;

    const impersonateUserId = req.headers["x-impersonate-user"];
    if (impersonateUserId) {
      if (user.permissionsDetails && user.permissionsDetails.isSuperadmin) {
        console.log(
          `Superadmin ${user.id} impersonating user ${impersonateUserId}`
        );
        const impersonatedUser = await getById(impersonateUserId);

        if (impersonatedUser) {
          req.impersonator = user; // Keep track of the real user
          req.user = impersonatedUser;
        } else {
          console.warn(
            `Impersonation failed: User ${impersonateUserId} not found`
          );
        }
      } else {
        console.warn(
          `User ${user.id} attempted to impersonate without permission`
        );
      }
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const refreshToken = req.headers["x-refresh-token"];
      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token is missing" });
      }
      try {
        const tokens = await refreshAccessToken(refreshToken);
        if (!tokens) {
          return res
            .status(401)
            .json({ message: "Invalid or expired refresh token" });
        }

        // Set the new token in response headers
        res.setHeader("Authorization", `Bearer ${tokens.accessToken}`);
        res.setHeader("X-Refresh-Token", tokens.refreshToken);

        // Use getUserFromToken with the new token
        let user = await getUserFromToken(tokens.accessToken);

        // Handle impersonation after token refresh as well
        const impersonateUserId = req.headers["x-impersonate-user"];
        if (impersonateUserId) {
          if (user.permissionsDetails && user.permissionsDetails.isSuperadmin) {
            console.log(
              `Superadmin ${user.id} impersonating user ${impersonateUserId} (after refresh)`
            );
            const impersonatedUser = await getById(impersonateUserId);

            if (impersonatedUser) {
              req.impersonator = user; // Keep track of the real user
              user = impersonatedUser;
            } else {
              console.warn(
                `Impersonation failed: User ${impersonateUserId} not found`
              );
            }
          }
        }

        req.user = user;
        next();
      } catch (error) {
        return res
          .status(401)
          .json({ message: "Invalid or expired refresh token" });
      }
    } else {
      return res.status(401).json({ message: "Invalid token" });
    }
  }
}
