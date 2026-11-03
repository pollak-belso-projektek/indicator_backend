import prisma from "../utils/prisma.js";
import { ServiceCache } from "../utils/ServiceCache.js";
import { scheduleSnapshot } from "./form_history.service.js";

const cache = new ServiceCache("felvettek_Szama");
const normalizeName = value => {
  const name = String(value || "").split(" - ")[0].trim();
  return !name || /^(na|nincs meghatározva)$/i.test(name) ? null : name;
};

export async function generateAndSaveAdmissionsFromTanugyiAdatok(schoolId, year) {
  const scope = { alapadatok_id: schoolId, tanev_kezdete: Number(year) };
  const students = await prisma.tanugyi_Adatok.findMany({ where: scope });
  const counts = new Map();
  for (const student of students) {
    if (Number.parseInt(student.felvetel_taneve, 10) !== Number(year)) continue;
    if (student.tanulo_jogviszonya !== "Tanulói jogviszony") continue;
    const grade = String(student.evfolyam || "").trim();
    if (!/^9(?:[.\s/]|$)/.test(grade) && !grade.includes("1/")) continue;
    const sector = normalizeName(student.uj_Szkt_agazat_tipusa);
    if (!sector) continue;
    const profession = normalizeName(student.uj_szkt_szakma_tipusa);
    const key = JSON.stringify([sector, profession]);
    const entry = counts.get(key) || { sector, profession, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }

  const result = await prisma.$transaction(async tx => {
    // Keep applicant counts, capacity and existing IDs. Recompute only admissions.
    await tx.felvettek_Szama.updateMany({ where: scope, data: { felvett_letszam: 0 } });
    for (const { sector, profession, count } of counts.values()) {
      const szakirany = await tx.szakirany.upsert({ where: { nev: sector }, create: { nev: sector }, update: {} });
      const szakma = profession
        ? await tx.szakma.upsert({ where: { nev: profession }, create: { nev: profession }, update: {} })
        : null;
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
