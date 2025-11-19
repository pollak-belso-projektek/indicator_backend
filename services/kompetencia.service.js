import prisma from "../utils/prisma.js";
import { ServicePattern } from "../utils/ServicePattern.js";

// Initialize ServicePattern for kompetencia
const pattern = new ServicePattern("kompetencia", "id");

export async function getAll() {
  return await pattern.findAll();
}

export async function getById(id) {
  return await pattern.findAllByAlapadatok(id);
}

export async function create(
  alapadatok_id,
  tanev_kezdete,
  mat_orsz_p,
  szoveg_orsz_p,
  mat_int_p,
  szoveg_int_p,
  kepzes_forma
) {
  // Delete existing records first (as per original logic)
  await deleteAllByAlapadatokId(alapadatok_id, tanev_kezdete);

  return await pattern.create({
    alapadatok_id: alapadatok_id,
    tanev_kezdete: Number(tanev_kezdete),
    mat_int_p,
    mat_orsz_p,
    szoveg_int_p,
    szoveg_orsz_p,
    kepzes_forma,
  });
}

export async function deleteAllByAlapadatokId(alapadatok_id, year) {
  // Use custom delete to match exact year instead of year range
  const result = await prisma.kompetencia.deleteMany({
    where: {
      alapadatok_id: alapadatok_id,
      tanev_kezdete: Number(year),
    },
  });

  // Invalidate related caches
  await pattern.serviceCache.invalidateRelated("deleteMany", alapadatok_id);

  return result;
}
