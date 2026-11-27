import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";

let patternInstance = null;
function getPattern() {
  if (!patternInstance) {
    patternInstance = new ServicePattern("formHistory", "id", {}, {}, { alapadatokField: "alapadatok_id" });
  }
  return patternInstance;
}

export function getPrismaModelName(tableName) {
  const overrides = {
    'intezmenyi_elismeresek': 'intezményiElismeresek',
    'munkavallalok_elismeresek': 'munkavallalokElismeresek',
    'IntezmenyiNeveltsegiMutatok': 'intezmenyiNeveltsegiMutatok'
  };
  if (overrides[tableName]) return overrides[tableName];

  if (!prisma[tableName]) {
    const keys = Object.keys(prisma);
    const normalizedTableName = tableName.toLowerCase().replace(/_/g, "");
    const match = keys.find(k => k.toLowerCase() === normalizedTableName);
    if (match) return match;
  }
  
  return tableName;
}

const snapshotTimeouts = {};

export async function createSnapshot(alapadatok_id, table_name) {
  const modelName = getPrismaModelName(table_name);
  // Lekérdezzük az összes sort a táblából (dinamikus táblanév miatt itt a Prisma natív hívása marad)
  const rows = await prisma[modelName].findMany({
    where: { alapadatok_id: alapadatok_id }
  });

  // Set all previous to inactive
  await prisma.formHistory.updateMany({
    where: { alapadatok_id, table_name },
    data: { is_active: false }
  });

  // Elmentjük a snapshotot
  const result = await getPattern().create({
    alapadatok_id,
    table_name,
    snapshot_data: rows,
    is_active: true
  });

  // Keep only the last 10 snapshots per table per alapadatok_id to prevent bloat
  const historyCount = await getPattern().count({ alapadatok_id, table_name });

  if (historyCount > 10) {
    const oldestSnapshots = await prisma.formHistory.findMany({
      where: { alapadatok_id, table_name },
      orderBy: { created_at: 'asc' },
      take: historyCount - 10,
      select: { id: true }
    });

    const oldestIds = oldestSnapshots.map(s => s.id);
    if (oldestIds.length > 0) {
      await getPattern().deleteMany({ id: { in: oldestIds } });
    }
  }

  return result;
}

export function scheduleSnapshot(alapadatok_id, table_name) {
  const key = `${alapadatok_id}_${table_name}`;
  if (snapshotTimeouts[key]) {
    clearTimeout(snapshotTimeouts[key]);
  }
  snapshotTimeouts[key] = setTimeout(() => {
    createSnapshot(alapadatok_id, table_name).catch(err => {
      console.error(`Error creating snapshot for ${table_name}:`, err);
    });
    delete snapshotTimeouts[key];
  }, 2000); // 2 másodperc debounce
}

export async function getHistory(alapadatok_id, table_name) {
  return await prisma.formHistory.findMany({
    where: { alapadatok_id, table_name },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      created_at: true,
      is_active: true
    }
  });
}

/** A single snapshot (null when missing or, for school users, another school's). */
export async function getHistoryById(history_id) {
  return await getPattern().findById(history_id);
}

export async function rollback(history_id) {
  const history = await getPattern().findById(history_id);

  if (!history) throw new Error("A mentési pont nem található.");

  const { alapadatok_id, table_name, snapshot_data } = history;

  const modelName = getPrismaModelName(table_name);

  // Tranzakcióban törlünk és visszatöltünk
  const result = await prisma.$transaction(async (tx) => {
    // Törlünk mindent
    await tx[modelName].deleteMany({
      where: { alapadatok_id }
    });

    // Beszúrjuk az összes régi sort
    if (Array.isArray(snapshot_data) && snapshot_data.length > 0) {
      await tx[modelName].createMany({
        data: snapshot_data
      });
    }

    // Mark active status
    await tx.formHistory.updateMany({
      where: { alapadatok_id, table_name },
      data: { is_active: false }
    });

    await tx.formHistory.update({
      where: { id: history_id },
      data: { is_active: true }
    });

    return { success: true, message: "Sikeres visszaállítás" };
  });

  // Törölni kell a cél tábla cache-ét, különben a kliens továbbra is a régi adatokat látja
  try {
    const { ServiceCache } = await import("../utils/ServiceCache.js");
    const targetCache = new ServiceCache(table_name);
    targetCache.invalidateByAlapadatokId(alapadatok_id);
    targetCache.invalidateAll();
  } catch(err) {
    console.error("Error invalidating cache after rollback:", err);
  }

  return result;
}
