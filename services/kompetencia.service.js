import { Decimal } from "@prisma/client/runtime/client";
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
  console.log(mat_int_p, szoveg_int_p);
  console.log(mat_orsz_p, szoveg_orsz_p);
  console.log(kepzes_forma);
  console.log(tanev_kezdete);

  return await pattern.create({
    alapadatok_id: alapadatok_id,
    tanev_kezdete: Number(tanev_kezdete),
    mat_int_p: new Decimal(mat_int_p),
    mat_orsz_p: new Decimal(mat_orsz_p),
    szoveg_int_p: new Decimal(szoveg_int_p),
    szoveg_orsz_p: new Decimal(szoveg_orsz_p),
    kepzes_forma,
  });
}

export async function update(
  id,
  alapadatok_id,
  tanev_kezdete,
  mat_orsz_p,
  szoveg_orsz_p,
  mat_int_p,
  szoveg_int_p,
  kepzes_forma
) {
  return await pattern.update(id, {
    alapadatok_id: alapadatok_id,
    tanev_kezdete: Number(tanev_kezdete),
    mat_int_p: new Decimal(mat_int_p),
    mat_orsz_p: new Decimal(mat_orsz_p),
    szoveg_int_p: new Decimal(szoveg_int_p),
    szoveg_orsz_p: new Decimal(szoveg_orsz_p),
    kepzes_forma,
  });
}

export async function deleteById(id) {
  return await pattern.delete(id);
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
  pattern.serviceCache.invalidateRelated("deleteMany", alapadatok_id);

  return result;
}
