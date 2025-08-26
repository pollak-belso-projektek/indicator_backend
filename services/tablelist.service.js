import { ServicePattern } from "../utils/ServicePattern.js";

const pattern = new ServicePattern("tableList", "id");

export async function getAll() {
  return await pattern.findAll();
}

export async function create(name, isAvailable) {
  return await pattern.create({
    name,
    isAvailable,
  });
}

export async function update(id, name, isAvailable) {
  return await pattern.update(id, {
    name,
    isAvailable,
  });
}
