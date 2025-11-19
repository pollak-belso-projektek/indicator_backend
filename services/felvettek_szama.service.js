import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";

// Initialize ServicePattern for felvettek_szama with relations
const pattern = new ServicePattern(
  "felvettek_Szama",
  "id",
  {
    szakma: true,
    szakirany: true,
  },
  {} // no select restrictions
);

export async function create(data) {
  const {
    alapadatok_id,
    tanev_kezdete,
    szakmaNev,
    szakiranyNev,
    jelentkezo_letszam,
    felveheto_letszam,
    felvett_letszam,
  } = data;

  let szakma = null;

  // Find szakma and szakirany by name
  if (szakmaNev && szakmaNev !== "Nincs meghatározva") {
    szakma = await prisma.szakma.findUnique({
      where: { nev: szakmaNev },
    });
  }

  const szakirany = await prisma.szakirany.findUnique({
    where: { nev: szakiranyNev },
  });

  if (!szakirany) {
    throw new Error(`Szakirany with name ${szakiranyNev} not found`);
  }

  // Create with resolved IDs - use custom create for proper relations
  const result = await prisma.felvettek_Szama.create({
    data: {
      alapadatok_id,
      tanev_kezdete,
      szakma_id: szakma ? szakma.id : null,
      szakiranyId: szakirany.id,
      jelentkezo_letszam,
      felveheto_letszam,
      felvett_letszam,
    },
    include: pattern.include,
  });

  // Invalidate related caches manually since we bypassed pattern.create
  await pattern.serviceCache.invalidateRelated("create", result.id);

  return result;
}

export async function getAll(tanev) {
  // Use pattern's method for year-based query with custom cache operation
  return await pattern.serviceCache.get(
    "all_with_year_ordered",
    async () => {
      const { firstYear, lastYear } = pattern.getYearRange(tanev);
      return await prisma.felvettek_Szama.findMany({
        where: {
          tanev_kezdete: { gte: firstYear, lte: lastYear },
        },
        include: pattern.include,
        orderBy: { createAt: "desc" },
      });
    },
    CACHE_TTL.SHORT,
    tanev
  );
}

export async function getById(alapadatok_id, tanev) {
  // Use pattern's method for alapadatok and year
  return await pattern.findByAlapadatokIdAndYear(alapadatok_id, tanev);
}

export async function update(id, data) {
  const {
    alapadatok_id,
    tanev_kezdete,
    szakmaNev,
    szakiranyNev,
    jelentkezo_letszam,
    felveheto_letszam,
    felvett_letszam,
  } = data;

  let szakma = null;

  // Find szakma and szakirany by name
  if (szakmaNev && szakmaNev !== "Nincs meghatározva") {
    szakma = await prisma.szakma.findUnique({
      where: { nev: szakmaNev },
    });
  }

  const szakirany = await prisma.szakirany.findUnique({
    where: { nev: szakiranyNev },
  });

  if (!szakirany) {
    throw new Error(`Szakirany with name ${szakiranyNev} not found`);
  }

  // Update with resolved IDs - use custom update for proper relations
  const result = await prisma.felvettek_Szama.update({
    where: { id },
    data: {
      alapadatok_id,
      tanev_kezdete,
      szakma_id: szakma ? szakma.id : null,
      szakiranyId: szakirany.id,
      jelentkezo_letszam,
      felveheto_letszam,
      felvett_letszam,
    },
    include: pattern.include,
  });

  // Invalidate related caches manually since we bypassed pattern.update
  await pattern.serviceCache.invalidateRelated("update", id);

  return result;
}
