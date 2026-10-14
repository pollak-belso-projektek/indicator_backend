import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";
import { scheduleSnapshot } from "./form_history.service.js";

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
  pattern.serviceCache.invalidateRelated("create", result.id);

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
  pattern.serviceCache.invalidateRelated("update", id);

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
  pattern.serviceCache.invalidateRelated("deleteMany", alapadatok_id);

  return result;
}

export async function bulkSave(alapadatok_id, records) {
  // We perform all creates and updates in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    let affected = 0;
    for (const record of records) {
      const data = {
        letszam: Number(record.letszam),
        alapadatok: { connect: { id: alapadatok_id } },
        jogv_tipus: Number(record.jogv_tipus),
        szakirany: { connect: { nev: record.szakirany } },
        tanev_kezdete: Number(record.tanev_kezdete),
      };

      if (record.szakma && record.szakma !== "Nincs meghatározva") {
        data.szakma = { connect: { nev: record.szakma } };
      }

      if (record.id) {
        // Update existing
        await tx.tanulo_Letszam.update({
          where: { id: record.id },
          data,
        });
      } else {
        // Create new
        await tx.tanulo_Letszam.create({
          data,
        });
      }
      affected++;
    }
    return { count: affected };
  });

  // Invalidate cache
  pattern.serviceCache.invalidateRelated("createMany", alapadatok_id);
  pattern.serviceCache.invalidateRelated("update", alapadatok_id);

  // Schedule exactly one snapshot after the bulk save finishes
  await scheduleSnapshot(alapadatok_id, "tanulo_Letszam");

  return result;
}

/**
 * Automatically calculates and saves student enrollment data (tanulo_letszam)
 * from educational data (tanugyi_adatok) for a specific school and school year.
 *
 * @param {string} alapadatok_id - School UUID
 * @param {number} year - School year start (e.g. 2025, 2026)
 * @returns {Promise<{ count: number }>}
 */
export async function generateAndSaveFromTanugyiAdatok(alapadatok_id, year) {
  const school = await prisma.alapadatok.findUnique({
    where: { id: alapadatok_id },
    include: {
      alapadatok_szakirany: {
        include: {
          szakirany: {
            include: {
              szakma: {
                include: {
                  szakma: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!school) {
    throw new Error(`School with id ${alapadatok_id} not found`);
  }

  // Pre-fetch all szakirany and szakma to resolve IDs
  const allSzakiranyok = await prisma.szakirany.findMany({
    select: { id: true, nev: true },
  });
  const szakiranyMap = new Map(allSzakiranyok.map((s) => [s.nev, s.id]));

  const allSzakmak = await prisma.szakma.findMany({
    select: { id: true, nev: true },
  });
  const szakmaMap = new Map(allSzakmak.map((s) => [s.nev, s.id]));

  // Build mapping of szakma to parent szakirany and list all configured categories for the school
  const szakmaToSzakiranyMap = new Map();
  const configuredCategories = [];

  if (school.alapadatok_szakirany && Array.isArray(school.alapadatok_szakirany)) {
    for (const item of school.alapadatok_szakirany) {
      const szakirany = item.szakirany;
      if (!szakirany || !szakirany.nev) continue;
      const szakiranyName = szakirany.nev;

      // Always include "Nincs meghatározva" for each szakirany
      configuredCategories.push({ szakiranyName, szakmaNev: null });

      if (szakirany.szakma && Array.isArray(szakirany.szakma)) {
        for (const sItem of szakirany.szakma) {
          const s = sItem.szakma;
          if (s && s.nev) {
            szakmaToSzakiranyMap.set(s.nev, szakiranyName);
            configuredCategories.push({ szakiranyName, szakmaNev: s.nev });
          }
        }
      }
    }
  }

  // Fetch student records from tanugyi_Adatok for this school and year
  const tanugyiData = await prisma.tanugyi_Adatok.findMany({
    where: {
      alapadatok_id,
      tanev_kezdete: Number(year),
    },
  });

  if (!tanugyiData || tanugyiData.length === 0) {
    return { count: 0 };
  }

  const counts = new Map();
  const getEntry = (szakiranyName, szakmaNev) => {
    const key = `${szakiranyName}____${szakmaNev || "NULL"}`;
    if (!counts.has(key)) {
      counts.set(key, {
        szakiranyName,
        szakmaNev: szakmaNev || null,
        0: 0,
        1: 0,
      });
    }
    return counts.get(key);
  };

  // Pre-seed configured categories with 0
  for (const cat of configuredCategories) {
    getEntry(cat.szakiranyName, cat.szakmaNev);
  }

  // Aggregate student numbers
  for (const student of tanugyiData) {
    let szakmaNev =
      student.uj_szkt_szakma_tipusa ||
      student.szakma_nev ||
      student.szakkepzes_nev ||
      "Nincs meghatározva";

    if (szakmaNev && szakmaNev !== "Nincs meghatározva") {
      szakmaNev = szakmaNev.split(" - ")[0].trim();
    }
    if (["Na", "NA", "na"].includes(szakmaNev)) {
      szakmaNev = "Nincs meghatározva";
    }

    let szakiranyName = student.uj_Szkt_agazat_tipusa || "Nincs meghatározva";
    if (szakiranyName && szakiranyName !== "Nincs meghatározva") {
      szakiranyName = szakiranyName.split(" - ")[0].trim();
    }
    if (["Na", "NA", "na"].includes(szakiranyName)) {
      szakiranyName = "Nincs meghatározva";
    }

    const evfolyam = student.evfolyam || "";
    const isTechnikum = evfolyam.toLowerCase().includes("technikum");
    const isSzakkepzo = evfolyam.toLowerCase().includes("szakképző");
    const hasEvfolyamNumber = /\d+/.test(evfolyam);

    if (!isTechnikum && !isSzakkepzo && !hasEvfolyamNumber) {
      continue;
    }

    const isFelnott =
      student.tanulo_jogviszonya?.toLowerCase().includes("felnőtt") ||
      student.munkarend?.toLowerCase().includes("felnőtt") ||
      student.munkarend?.toLowerCase().includes("levelező") ||
      student.munkarend?.toLowerCase().includes("esti") ||
      evfolyam.toLowerCase().includes("felnőtt") ||
      evfolyam.toLowerCase().includes("levelező") ||
      evfolyam.toLowerCase().includes("esti") ||
      student.kepzes_forma?.toLowerCase().includes("felnőtt");

    const jogvTipus = isFelnott ? 1 : 0;

    let targetSzakiranyName = szakiranyName;
    let targetSzakmaNev = null;

    if (szakmaNev === "Nincs meghatározva") {
      targetSzakmaNev = null;
      targetSzakiranyName = szakiranyName;
    } else {
      targetSzakmaNev = szakmaNev;
      if (szakmaToSzakiranyMap.has(szakmaNev)) {
        targetSzakiranyName = szakmaToSzakiranyMap.get(szakmaNev);
      } else {
        targetSzakiranyName = szakiranyName;
      }
    }

    const entry = getEntry(targetSzakiranyName, targetSzakmaNev);
    entry[jogvTipus] += 1;
  }

  // Build records to insert
  const recordsToInsert = [];

  for (const entry of counts.values()) {
    let szakiranyId = szakiranyMap.get(entry.szakiranyName);
    if (!szakiranyId && entry.szakiranyName && entry.szakiranyName !== "Nincs meghatározva") {
      const created = await prisma.szakirany.create({
        data: { nev: entry.szakiranyName },
      });
      szakiranyId = created.id;
      szakiranyMap.set(entry.szakiranyName, szakiranyId);
    }

    if (!szakiranyId) {
      continue;
    }

    let szakmaId = null;
    if (entry.szakmaNev && entry.szakmaNev !== "Nincs meghatározva") {
      szakmaId = szakmaMap.get(entry.szakmaNev);
      if (!szakmaId) {
        const created = await prisma.szakma.create({
          data: { nev: entry.szakmaNev },
        });
        szakmaId = created.id;
        szakmaMap.set(entry.szakmaNev, szakmaId);
      }
    }

    // 0: Tanulói jogviszony
    recordsToInsert.push({
      alapadatok_id,
      tanev_kezdete: Number(year),
      jogv_tipus: 0,
      letszam: entry[0] || 0,
      szakirany_id: szakiranyId,
      szakma_id: szakmaId || null,
    });

    // 1: Felnőttképzési jogviszony
    recordsToInsert.push({
      alapadatok_id,
      tanev_kezdete: Number(year),
      jogv_tipus: 1,
      letszam: entry[1] || 0,
      szakirany_id: szakiranyId,
      szakma_id: szakmaId || null,
    });
  }

  // Atomically delete existing records for this school & year and insert fresh ones
  const result = await prisma.$transaction(async (tx) => {
    await tx.tanulo_Letszam.deleteMany({
      where: {
        alapadatok_id,
        tanev_kezdete: Number(year),
      },
    });

    if (recordsToInsert.length > 0) {
      await tx.tanulo_Letszam.createMany({
        data: recordsToInsert,
      });
    }

    return { count: recordsToInsert.length };
  });

  // Invalidate caches
  pattern.serviceCache.invalidateRelated("createMany", alapadatok_id);
  pattern.serviceCache.invalidateRelated("deleteMany", alapadatok_id);
  pattern.serviceCache.invalidateRelated("update", alapadatok_id);

  // Take history snapshot
  await scheduleSnapshot(alapadatok_id, "tanulo_Letszam");

  return result;
}

