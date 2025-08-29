import prisma, { executeWithRetry } from "../utils/prisma.js";
import { enrichUserWithPermissions } from "../utils/permissions.js";

export async function getByEmail(email) {
  try {
    const user = await executeWithRetry(async (prismaInstance) => {
      return await prismaInstance.user.findUnique({
        where: {
          email: email,
        },
        include: {
          // Only include what's needed for login to optimize query
          tableAccess: {
            include: {
              table: true,
            },
          },
          alapadatok: true,
        },
      });
    });

    enrichUserWithPermissions(user);

    return user;
  } catch (error) {
    console.error("Error fetching user by email:", error);
    throw error;
  }
}

export async function getById(id) {
  try {
    const user = await executeWithRetry(async (prismaInstance) => {
      return await prismaInstance.user.findUnique({
        where: {
          id: id,
        },
        include: {
          // Only include what's needed for login to optimize query
          tableAccess: {
            include: {
              table: true,
            },
          },
          alapadatok: true,
        },
      });
    });

    enrichUserWithPermissions(user);

    return user;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    throw error;
  }
}
