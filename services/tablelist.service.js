import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

const pattern = new ServicePattern(
  "tableList",
  "id",
  {},
  {},
  { orderBy: { alias: "asc" } }
);

export async function getAll() {
  return await pattern.findAll();
}

export async function getById(id) {
  return await pattern.findById(id);
}

export async function create(name, isAvailable) {
  return await pattern.create({
    name,
    isAvailable,
  });
}

export async function update(id, name, isAvailable, alias) {
  return await pattern.update(id, {
    name,
    isAvailable,
    ...(alias !== undefined && { alias }),
  });
}

export async function updateAlias(id, alias) {
  return await pattern.update(id, {
    alias,
  });
}

export async function lock(id) {
  return await pattern.update(id, {
    isLocked: true,
  });
}

export async function unlock(id) {
  return await pattern.update(id, {
    isLocked: false,
  });
}

export async function isTableLocked(id) {
  const table = await pattern.findById(id);
  return table?.isLocked ?? false;
}
