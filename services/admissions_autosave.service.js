import prisma from "../utils/prisma.js";
import { ServiceCache } from "../utils/ServiceCache.js";
import { scheduleSnapshot } from "./form_history.service.js";
import {
  SCHOOL_KEPZES_INCLUDE,
  normalizeKepzesName,
  normalizeAgazatName,
  kepzesNameKey,
  agazatNameKey,
  indexByKepzesName,
  schoolKepzesLookup,
} from "../utils/kepzesName.js";

const cache = new ServiceCache("felvettek_Szama");

export async function generateAndSaveAdmissionsFromTanugyiAdatok(schoolId, year) {
  const scope = { alapadatok_id: schoolId, tanev_kezdete: Number(year) };
  const students = await prisma.tanugyi_Adatok.findMany({ where: scope });
  const counts = new Map();
  for (const student of students) {
    if (Number.parseInt(student.felvetel_taneve, 10) !== Number(year)) continue;
    if (student.tanulo_jogviszonya !== "Tanulói jogviszony") continue;
    const grade = String(student.evfolyam || "").trim();
    if (!/^9(?:[.\s/]|$)/.test(grade) && !grade.includes("1/")) continue;
    const sector = normalizeAgazatName(student.uj_Szkt_agazat_tipusa);
    if (!sector) continue;
    const profession = normalizeKepzesName(student.uj_szkt_szakma_tipusa);
    const key = JSON.stringify([sector, profession]);
    const entry = counts.get(key) || { sector, profession, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }

  // Link to the school's configured sector/profession records first (what the
  // indicator page shows), then to any existing record with the same normalized name.
  const school = await prisma.alapadatok.findUnique({ where: { id: schoolId }, include: SCHOOL_KEPZES_INCLUDE });
  const configured = schoolKepzesLookup(school);

  const result = await prisma.$transaction(async tx => {
    const szakiranyIndex = indexByKepzesName(await tx.szakirany.findMany({ select: { id: true, nev: true } }), agazatNameKey);
    const szakmaIndex = indexByKepzesName(await tx.szakma.findMany({ select: { id: true, nev: true } }));
    const resolve = async (name, configuredMap, index, model, keyOf) => {
      const key = keyOf(name);
      const found = configuredMap.get(key) ?? index.get(key);
      if (found) return found;
      const created = await model.create({ data: { nev: name } });
      index.set(key, created);
      return created;
    };
    // Keep applicant counts, capacity and existing IDs. Recompute only admissions.
    await tx.felvettek_Szama.updateMany({ where: scope, data: { felvett_letszam: 0 } });
    for (const { sector, profession, count } of counts.values()) {
      const szakirany = await resolve(sector, configured.szakirany, szakiranyIndex, tx.szakirany, agazatNameKey);
      const szakma = profession ? await resolve(profession, configured.szakma, szakmaIndex, tx.szakma, kepzesNameKey) : null;
      const where = { ...scope, szakiranyId: szakirany.id, szakma_id: szakma?.id || null };
      const existing = await tx.felvettek_Szama.findMany({ where, select: { id: true } });
      if (existing.length) {
        await tx.felvettek_Szama.updateMany({ where, data: { felvett_letszam: count } });
      } else {
        await tx.felvettek_Szama.create({
          data: { ...where, felvett_letszam: count, jelentkezo_letszam: 0, felveheto_letszam: 0 },
        });
      }
    }
    return { count: counts.size };
  });
  await cache.invalidateAll();
  await scheduleSnapshot(schoolId, "felvettek_Szama");
  return result;
}
