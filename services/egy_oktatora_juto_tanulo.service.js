import { ServicePattern } from "../utils/ServicePattern.js";

// Initialize ServicePattern for egyOktatoraJutoTanulo
const pattern = new ServicePattern("egyOktatoraJutoTanulo", "id");

export async function getAll() {
  return await pattern.findAll();
}

export async function getById(alapadatok_id) {
  return await pattern.findAllByAlapadatok(alapadatok_id);
}

export async function create(tanev_kezdete, letszam, alapadatok_id) {
  return await pattern.create({
    tanev_kezdete: tanev_kezdete,
    letszam: Number(letszam),
    alapadatok_id: alapadatok_id,
  });
}

export async function update(id, tanev_kezdete, letszam, alapadatok_id) {
  return await pattern.update(id, {
    tanev_kezdete: tanev_kezdete,
    letszam: Number(letszam),
    alapadatok_id: alapadatok_id,
  });
}
