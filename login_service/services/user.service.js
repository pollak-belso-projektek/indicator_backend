import prisma, { executeWithRetry } from "../utils/prisma.js";
import { enrichUserWithPermissions } from "../utils/permissions.js";

export async function getByEmail(email) {
  try {
    const user = await executeWithRetry(async (prismaInstance) => {
      return await prismaInstance.user.findUnique({
        where: {
          email: email,
        },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          alapadatokId: true,
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
        select: {
          id: true,
          email: true,
          name: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          alapadatokId: true,
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
