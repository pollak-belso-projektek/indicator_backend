import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";

// Initialize ServicePattern for tanulo_letszam with relations
const pattern = new ServicePattern(
  "tanulo_Letszam",
  "id",
  {
    szakirany: true,
    szakma: true,
  },
  {} // no select restrictions
);

export async function getAll() {
  // Use current year to get relevant data
  return await pattern.findAllCurrentYear();
}

export async function getById(id) {
  // Get data by alapadatok_id for current year
  return await pattern.findByAlapadatokCurrentYear(id);
}

export async function create(
  letszam,
  alapadatok_id,
  jogv_tipus,
  szakirany,
  szakma,
  tanev_kezdete
) {
  // Build data object based on whether szakma is provided
  const data = {
    tanev_kezdete: Number(tanev_kezdete),
    szakirany: { connect: { nev: szakirany } },
    alapadatok: { connect: { id: alapadatok_id } },
    jogv_tipus: Number(jogv_tipus),
    letszam: Number(letszam),
  };

  // Only connect szakma if it's provided and not "Nincs meghatározva"
  if (szakma && szakma !== "Nincs meghatározva") {
    data.szakma = { connect: { nev: szakma } };
  }

  // Use custom create since we need the connect syntax
  const result = await prisma.tanulo_Letszam.create({
    data,
    include: pattern.include,
  });

  // Invalidate related caches manually since we bypassed pattern.create
  await pattern.serviceCache.invalidateRelated("create", result.id);

  return result;
}

export async function update(
  id,
  letszam,
  alapadatok_id,
  jogv_tipus,
  szakirany,
  szakma,
  tanev_kezdete
) {
  // Build data object based on whether szakma is provided
  const data = {
    letszam: Number(letszam),
    alapadatok: { connect: { id: alapadatok_id } },
    jogv_tipus: Number(jogv_tipus),
    szakirany: { connect: { nev: szakirany } },
    tanev_kezdete: Number(tanev_kezdete),
  };

  // Only connect szakma if it's provided and not "Nincs meghatározva"
  if (szakma && szakma !== "Nincs meghatározva") {
    data.szakma = { connect: { nev: szakma } };
  }

  // Use custom update since we need the connect syntax
  const result = await prisma.tanulo_Letszam.update({
    where: { id: id },
    data,
    include: pattern.include,
  });

  // Invalidate related caches manually since we bypassed pattern.update
  await pattern.serviceCache.invalidateRelated("update", id);

  return result;
}

export async function deleteMany(alapadatok_id, year) {
  // Use pattern's method which handles the proper field name and cache invalidation
  const result = await prisma.tanulo_Letszam.deleteMany({
    where: {
      alapadatok_id,
      tanev_kezdete: Number(year),
    },
  });

  // Invalidate related caches
  await pattern.serviceCache.invalidateRelated("deleteMany", alapadatok_id);

  return result;
}
