import { hashPassword } from "../utils/hash.js";
import prisma from "../utils/prisma.js";
import * as cache from "../utils/cache.js";
import { enrichUserWithPermissions } from "../utils/permissions.js";

// Cache TTLs
const CACHE_TTL = {
  LIST: 5 * 60 * 1000, // 5 minutes for lists
  DETAIL: 10 * 60 * 1000, // 10 minutes for details
};

export async function getAll() {
  const cacheKey = "users:all";
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.user.findMany({
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
  data.forEach((user) => enrichUserWithPermissions(user));

  // Store in cache
  cache.set(cacheKey, data, CACHE_TTL.LIST);

  return data;
}

export async function getByEmail(email) {
  const cacheKey = `users:email:${email}`;
  const cachedData = cache.get(cacheKey);

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

  // Store in cache
  cache.set(cacheKey, data, CACHE_TTL.DETAIL);
  // Enrich user with permission details
  enrichUserWithPermissions(data);

  return data;
}

export async function getAllFiltered() {
  const cacheKey = `users:all:filtered`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  // Store in cache
  cache.set(cacheKey, data, CACHE_TTL.LIST);

  return data;
}

export async function create(
  email,
  name,
  password,
  permissions = 1,
  tableAccess = [],
  alapadatok_id = null
) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: await hashPassword(password),
      permissions: permissions,
      alapadatokId: alapadatok_id ? Number(alapadatok_id) : null,
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
            `Table with name ${access.tableName} does not exist.`
          );
        }

        prisma.tableAccess.create({
          data: {
            userId: user.id,
            tableId: table.id,
            access: access.access,
          },
        });
      })
    );
  }

  // Invalidate cache after creating a user
  cache.invalidate("users:*");

  return user;
}

export async function update(
  id,
  email,
  name,
  password,
  permissions = 0b00001,
  tableAccess = [],
  alapadatok_id = null
) {
  const user = await prisma.user.update({
    where: { id: id },
    data: {
      email,
      name,
      password,
      permissions: Number(permissions),
      alapadatokId: alapadatok_id ? Number(alapadatok_id) : null,
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
            `Table with name ${access.tableName} does not exist.`
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
      })
    );
  }

  // Invalidate all user caches including specific user email and the users list
  cache.invalidate("users:*");

  return user;
}

