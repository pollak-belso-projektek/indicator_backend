import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";
import { scheduleSnapshot } from "./form_history.service.js";
import {
  NINCS_MEGHATAROZVA,
  SCHOOL_KEPZES_INCLUDE,
  normalizeKepzesName,
  normalizeAgazatName,
  kepzesNameKey,
  agazatNameKey,
  indexByKepzesName,
  schoolKepzesLookup,
} from "../utils/kepzesName.js";

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
        // The "Nincs meghatározva" bucket may not exist yet if nothing has been
        // generated into it; every other sector must already exist.
        szakirany:
          record.szakirany === NINCS_MEGHATAROZVA
            ? { connectOrCreate: { where: { nev: NINCS_MEGHATAROZVA }, create: { nev: NINCS_MEGHATAROZVA } } }
            : { connect: { nev: record.szakirany } },
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
    include: SCHOOL_KEPZES_INCLUDE,
  });

  if (!school) {
    throw new Error(`School with id ${alapadatok_id} not found`);
  }

  // Existing dictionary entries, matched by normalized name (KRÉTA code suffixes and
  // letter case ignored) so imports link to the canonical record instead of
  // creating "Cukrász (4 1013 23 01)" next to "Cukrász".
  const szakiranyIndex = indexByKepzesName(
    await prisma.szakirany.findMany({ select: { id: true, nev: true } }),
    agazatNameKey,
  );
  const szakmaIndex = indexByKepzesName(
    await prisma.szakma.findMany({ select: { id: true, nev: true } }),
  );

  // The school's own configured records always win, so counts are linked to exactly
  // the rows the indicator table displays, even when the dictionary contains
  // look-alikes ("    Burkoló" vs "Burkoló (4 0732 06 03)").
  const {
    szakirany: configuredSzakirany,
    szakma: configuredSzakma,
    szakmaToSzakirany: szakmaToSzakiranyMap,
    categories: configuredCategories,
  } = schoolKepzesLookup(school);

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
    // Normalized names; configured spelling wins so the counts land on the rows the
    // indicator table shows for this school.
    const rawSzakma = normalizeKepzesName(
      student.uj_szkt_szakma_tipusa || student.szakma_nev || student.szakkepzes_nev,
    );
    const szakmaNev = rawSzakma
      ? configuredSzakma.get(kepzesNameKey(rawSzakma))?.nev ?? rawSzakma
      : NINCS_MEGHATAROZVA;
    const rawSzakirany = normalizeAgazatName(student.uj_Szkt_agazat_tipusa);
    const szakiranyName = rawSzakirany
      ? configuredSzakirany.get(agazatNameKey(rawSzakirany))?.nev ?? rawSzakirany
      : NINCS_MEGHATAROZVA;

    // Every student counts, whatever the grade is called: grades such as
    // "Dobbantó előkészítő" or "Műhelyiskola osztály" have no number and used to be
    // dropped entirely.
    const evfolyam = student.evfolyam || "";

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

    // Every student lands on a row the indicator table shows:
    //  1. a profession configured for the school -> its own row
    //  2. otherwise a sector configured for the school -> "Nincs meghatározva (<sector>)"
    //  3. otherwise (no sector/profession in KRÉTA, or one the school has not
    //     configured) -> the separate "Nincs meghatározva" row at the bottom.
    let targetSzakiranyName = NINCS_MEGHATAROZVA;
    let targetSzakmaNev = null;
    const sectorOfSzakma =
      szakmaNev !== NINCS_MEGHATAROZVA ? szakmaToSzakiranyMap.get(kepzesNameKey(szakmaNev)) : undefined;
    if (sectorOfSzakma) {
      targetSzakiranyName = sectorOfSzakma;
      targetSzakmaNev = szakmaNev;
    } else if (configuredSzakirany.has(agazatNameKey(szakiranyName))) {
      targetSzakiranyName = szakiranyName;
    }

    const entry = getEntry(targetSzakiranyName, targetSzakmaNev);
    entry[jogvTipus] += 1;
  }

  // Students without a usable sector are stored under one shared dictionary entry
  // named "Nincs meghatározva" (szakirany_id is required). The manual save of the
  // indicator page (bulkSave) connects to the same entry by name.
  let unassigned;
  const unassignedSzakirany = async () =>
    (unassigned ??=
      (await prisma.szakirany.findUnique({ where: { nev: NINCS_MEGHATAROZVA } })) ??
      (await prisma.szakirany.create({ data: { nev: NINCS_MEGHATAROZVA } })));

  // Build records to insert
  const recordsToInsert = [];

  for (const entry of counts.values()) {
    const isUnassigned = entry.szakiranyName === NINCS_MEGHATAROZVA;
    // Only stored when someone is actually in it.
    if (isUnassigned && !entry[0] && !entry[1]) continue;

    const szakiranyKey = agazatNameKey(entry.szakiranyName);
    let szakiranyId = isUnassigned
      ? (await unassignedSzakirany()).id
      : configuredSzakirany.get(szakiranyKey)?.id ?? szakiranyIndex.get(szakiranyKey)?.id;
    if (!szakiranyId && entry.szakiranyName && entry.szakiranyName !== NINCS_MEGHATAROZVA) {
      const created = await prisma.szakirany.create({
        data: { nev: entry.szakiranyName },
      });
      szakiranyId = created.id;
      szakiranyIndex.set(szakiranyKey, created);
    }

    if (!szakiranyId) {
      continue;
    }

    let szakmaId = null;
    if (entry.szakmaNev && entry.szakmaNev !== NINCS_MEGHATAROZVA) {
      const szakmaKey = kepzesNameKey(entry.szakmaNev);
      szakmaId = configuredSzakma.get(szakmaKey)?.id ?? szakmaIndex.get(szakmaKey)?.id;
      if (!szakmaId) {
        const created = await prisma.szakma.create({
          data: { nev: entry.szakmaNev },
        });
        szakmaId = created.id;
        szakmaIndex.set(kepzesNameKey(entry.szakmaNev), created);
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

