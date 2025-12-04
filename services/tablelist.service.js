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
  return await prisma.tableList.findUnique({
    where: { id },
  });
}

export async function getByName(name) {
  return await prisma.tableList.findUnique({
    where: { name },
  });
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
  return await prisma.tableList.update({
    where: { id },
    data: { alias },
  });
}

export async function lock(id) {
  return await prisma.tableList.update({
    where: { id },
    data: { isLocked: true },
  });
}

export async function unlock(id) {
  return await prisma.tableList.update({
    where: { id },
    data: { isLocked: false },
  });
}

export async function isTableLocked(id) {
  const table = await prisma.tableList.findUnique({
    where: { id },
    select: { isLocked: true },
  });
  return table?.isLocked ?? false;
}

export async function isTableLockedByName(name) {
  const table = await prisma.tableList.findUnique({
    where: { name },
    select: { isLocked: true },
  });
  return table?.isLocked ?? false;
}
