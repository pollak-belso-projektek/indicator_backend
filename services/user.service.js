import { hashPassword } from "../utils/hash.js";
import prisma from "../utils/prisma.js";
import * as cache from "../utils/cache.js";
import { enrichUserWithPermissions } from "../utils/permissions.js";

// Cache TTLs
const CACHE_TTL = {
  LIST: 5 * 60 * 1000, // 5 minutes for lists
  DETAIL: 10 * 60 * 1000, // 10 minutes for details
};

/** Cache bucket for a user list: who is asking determines which users are visible. */
function listScope(user) {
  const p = user?.permissionsDetails || {};
  if (p.isSuperadmin) return "super";
  if (p.isHSZC && p.isAdmin) return "hszc";
  return `school:${user?.alapadatokId}`;
}

/**
 * Users visible to `user` (the authenticated – or, in alias mode, impersonated – user).
 */
export async function getAll(user) {
  if (!user?.permissionsDetails) return [];
  const cacheKey = `users:all:${listScope(user)}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  let whereClause = {};

  // Apply filtering based on user permissions
  if (user.permissionsDetails.isSuperadmin) {
    // Superadmin gets all users - no filtering needed
    whereClause = {};
  } else if (
    user.permissionsDetails.isHSZC &&
    user.permissionsDetails.isAdmin
  ) {
    // HSZC + Admin gets everyone who is HSZC or lower (HSZC, Admin, Privileged, Standard)
    // Exclude superadmin (bit 16) by checking permissions < 16 OR specific combinations that include HSZC but not superadmin
    whereClause = {
      AND: [
        { permissions: { lt: 16 } }, // Exclude superadmin
        {
          OR: [
            { permissions: { gte: 8 } }, // HSZC and combinations (but less than 16)
            { permissions: { in: [4, 2, 1] } }, // Admin, Privileged, Standard only
          ],
        },
      ],
    };
  } else if (!user.permissionsDetails.isSuperadmin && !user.permissionsDetails.isHSZC) {
    // Non-superadmin/HSZC users only get users with the same alapadatokId
    if (!user.alapadatokId) return [];
    whereClause = {
      alapadatokId: user.alapadatokId,
    };
  } else {
    return [];
  }

  const data = await prisma.user.findMany({
    where: whereClause,
    include: {
      tableAccess: {
        include: {
          table: true,
        },
      },
      alapadatok: true,
    },
  });
  // Enrich each user with permission details
  const enrichedData = data.map((user) => enrichUserWithPermissions(user));

  // Store in cache
  await cache.set(cacheKey, enrichedData, CACHE_TTL.LIST);

  return enrichedData;
}

export async function getByEmail(email) {
  const cacheKey = `users:email:${email}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.user.findUnique({
    include: {
      // Only include what's needed for login to optimize query
      tableAccess: {
        include: {
          table: true,
        },
      },
      alapadatok: true,
    },
    where: {
      email: email,
    },
  });

  if (!data) {
    return null;
  }

  // Enrich user with permission details
  const enrichedData = enrichUserWithPermissions(data);
  // Store in cache
  await cache.set(cacheKey, enrichedData, CACHE_TTL.DETAIL);

  return enrichedData;
}

export async function getById(id) {
  const cacheKey = `users:id:${id}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.user.findUnique({
    include: {
      tableAccess: {
        include: {
          table: true,
        },
      },
      alapadatok: true,
    },
    where: {
      id: id,
    },
  });

  if (!data) {
    return null;
  }

  // Enrich user with permission details
  const enrichedData = enrichUserWithPermissions(data);
  // Store in cache
  await cache.set(cacheKey, enrichedData, CACHE_TTL.DETAIL);

  return enrichedData;
}

export async function getAllFiltered(user) {
  if (!user?.permissionsDetails) return [];
  const cacheKey = `users:all:filtered:${listScope(user)}`;
  const cachedData = await cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  let whereClause = {};

  // Apply filtering based on user permissions
  if (user.permissionsDetails.isSuperadmin) {
    // Superadmin gets all users - no filtering needed
    whereClause = {};
  } else if (
    user.permissionsDetails.isHSZC &&
    user.permissionsDetails.isAdmin
  ) {
    // HSZC + Admin gets everyone who is HSZC or lower (HSZC, Admin, Privileged, Standard)
    // Exclude superadmin (bit 16) by checking permissions < 16 OR specific combinations that include HSZC but not superadmin
    whereClause = {
      AND: [
        { permissions: { lt: 16 } }, // Exclude superadmin
        {
          OR: [
            { permissions: { gte: 8 } }, // HSZC and combinations (but less than 16)
            { permissions: { in: [4, 2, 1] } }, // Admin, Privileged, Standard only
          ],
        },
      ],
    };
  } else if (!user.permissionsDetails.isSuperadmin && !user.permissionsDetails.isHSZC) {
    // Non-superadmin/HSZC users only get users with the same alapadatokId
    if (!user.alapadatokId) return [];
    whereClause = {
      alapadatokId: user.alapadatokId,
    };
  } else {
    return [];
  }

  const data = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Store in cache
  await cache.set(cacheKey, data, CACHE_TTL.LIST);

  return data;
}

export async function create(
  email,
  name,
  password,
  permissions = 1,
  tableAccess = [],
  alapadatok_id = null,
  isActive = true,
) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : email;

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (existingUser) {
    const error = new Error("Ezzel az e-mail címmel már létezik felhasználó!");
    error.status = 409;
    error.code = "EMAIL_ALREADY_EXISTS";
    error.field = "email";
    throw error;
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      password: await hashPassword(password),
      permissions: permissions,
      alapadatokId: alapadatok_id ? alapadatok_id : null,
      isActive,
    },
  });
  if (tableAccess && tableAccess.length > 0) {
    await Promise.all(
      tableAccess.map(async (access) => {
        const table = await prisma.tableList.findUnique({
          where: { name: access.tableName },
        });

        if (!table) {
          throw new Error(
            `Table with name ${access.tableName} does not exist.`,
          );
        }

        await prisma.tableAccess.create({
          data: {
            userId: user.id,
            tableId: table.id,
            access: access.access,
          },
        });
      }),
    );
  }

  // Invalidate cache after creating a user
  await cache.invalidate("users:*");

  return user;
}

export async function update(
  id,
  email,
  name,
  permissions = 0b00001,
  tableAccess = [],
  alapadatokId = null,
  isActive = true,
) {
  const user = await prisma.user.update({
    where: { id: id },
    data: {
      email,
      name,
      permissions: Number(permissions),
      alapadatokId: alapadatokId ? alapadatokId : null,
      isActive,
    },
  });
  // Handle tableAccess updates
  let validTableIds = [];

  if (tableAccess && tableAccess.length > 0) {
    validTableIds = await Promise.all(
      tableAccess.map(async (access) => {
        const table = await prisma.tableList.findUnique({
          where: { name: access.tableName },
        });

        if (!table) {
          throw new Error(
            `Table with name ${access.tableName} does not exist.`,
          );
        }

        await prisma.tableAccess.upsert({
          where: {
            userId_tableId: {
              userId: user.id,
              tableId: table.id,
            },
          },
          create: {
            userId: user.id,
            tableId: table.id,
            access: access.access,
          },
          update: {
            access: access.access,
          },
        });

        return table.id;
      }),
    );
  }

  // Remove any table access that is not in the current list
  await prisma.tableAccess.deleteMany({
    where: {
      userId: user.id,
      tableId: { notIn: validTableIds },
    },
  });

  // Invalidate all user caches including specific user email and the users list,
  // and the token -> user cache so role / active-state changes apply immediately.
  await cache.invalidate("users:*");
  await cache.invalidate("token:user:");

  return user;
}

export async function updatePassword(id, newPassword, newPasswordConfirm) {
  if (newPassword !== newPasswordConfirm) {
    throw new Error("Passwords do not match");
  }

  const hashedPassword = await hashPassword(newPassword);

  await cache.invalidate("users:*");

  return prisma.user.update({
    where: { id },
    data: { 
      password: hashedPassword,
      mustChangePassword: false
    },
  });
}

export async function updatePersonalInformation(id, name, email) {
  await cache.invalidate("users:*");

  return prisma.user.update({
    where: { id },
    data: {
      name,
      email,
    },
  });
}

export async function inactivateUser(id) {
  const result = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  // After the write, so a concurrent request cannot re-cache the still-active user.
  // token:user: makes the inactivation effective for already issued access tokens.
  await cache.invalidate("users:*");
  await cache.invalidate("token:user:");
  return result;
}
