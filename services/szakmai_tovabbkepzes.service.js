import prisma from "../utils/prisma.js";
import { ServicePattern, CACHE_TTL } from "../utils/ServicePattern.js";
import { scheduleSnapshot } from "./form_history.service.js";

const pattern = new ServicePattern(
  "szakmaiTovabbkepzes", // must be the Prisma delegate name 
  "id", 
  {
    alapadatok: true,
  },
  {},
  { yearField: "tanev" }
);

export async function getAll(tanev) {
  return await pattern.serviceCache.get(
    'all_with_year',
    async () => {
      const { firstYear, lastYear } = pattern.getYearRange(tanev);
      return await prisma.szakmaiTovabbkepzes.findMany({
        where: {
          tanev: { gte: firstYear, lte: lastYear },
        },
        orderBy: { tanev: "asc" },
        include: pattern.include,
      });
    },
    CACHE_TTL.SHORT,
    tanev
  );
}

export async function getAllByAlapadatok(alapadatokId, tanev) {
  return await pattern.serviceCache.get(
    'alapadatok_with_year',
    async () => {
      const { firstYear, lastYear } = pattern.getYearRange(tanev);
      return await prisma.szakmaiTovabbkepzes.findMany({
        where: {
          alapadatok_id: alapadatokId,
          tanev: { gte: firstYear, lte: lastYear },
        },
        orderBy: { tanev: "asc" },
        include: pattern.include,
      });
    },
    CACHE_TTL.SHORT,
    alapadatokId,
    tanev
  );
}

export async function upsertBulk(alapadatokId, data) {
  // data is an array of objects
  const results = [];
  
  for (const item of data) {
    if (!item.tanev) continue;
    
    // Clean up empty or missing float fields
    const parseFloatField = (val) => val === null || val === undefined || val === "" ? null : parseFloat(val);
    
    const payload = {
      alapadatok_id: alapadatokId,
      tanev: parseInt(item.tanev),
      oktatok_letszama: parseFloatField(item.oktatok_letszama),
      veztok_letszama: parseFloatField(item.veztok_letszama),
      ikk_10_alatt: parseFloatField(item.ikk_10_alatt),
      ikk_10: parseFloatField(item.ikk_10),
      ikk_20: parseFloatField(item.ikk_20),
      ikk_30: parseFloatField(item.ikk_30),
      ikk_40: parseFloatField(item.ikk_40),
      ikk_50: parseFloatField(item.ikk_50),
      ikk_60: parseFloatField(item.ikk_60),
      ikk_90: parseFloatField(item.ikk_90),
      ikk_120: parseFloatField(item.ikk_120),
      vallalati_tovabbkepzes: parseFloatField(item.vallalati_tovabbkepzes),
      egyedi_oraszam: parseFloatField(item.egyedi_oraszam),
      ujabb_diploma: parseFloatField(item.ujabb_diploma),
      alapkepesites_mesterfokozat: parseFloatField(item.alapkepesites_mesterfokozat),
      pedagogus_szakvizsga: parseFloatField(item.pedagogus_szakvizsga),
      egyeb_posztgradualis: parseFloatField(item.egyeb_posztgradualis),
      forditott_osszeg: parseFloatField(item.forditott_osszeg),
    };

    const existingRecord = await prisma.szakmaiTovabbkepzes.findUnique({
      where: {
        alapadatok_id_tanev: {
          alapadatok_id: alapadatokId,
          tanev: parseInt(item.tanev)
        }
      }
    });

    if (existingRecord) {
      const updated = await prisma.szakmaiTovabbkepzes.update({
        where: { id: existingRecord.id },
        data: payload
      });
      results.push(updated);
    } else {
      const created = await prisma.szakmaiTovabbkepzes.create({
        data: payload
      });
      results.push(created);
    }
  }

  // Invalidate caches
  await pattern.serviceCache.invalidateAll();
  
  scheduleSnapshot(alapadatokId, "szakmai_tovabbkepzes");
  
  return results;
}

export async function deleteAllByAlapadatok(alapadatokId, tanev) {
  // Assuming pattern.deleteByAlapadatokIdAndYear uses tanev_kezdete internally if not overridden, 
  // but since we have tanev here, we might need a custom delete method.
  const { firstYear, lastYear } = pattern.getYearRange(tanev);
  
  const deleted = await prisma.szakmaiTovabbkepzes.deleteMany({
    where: {
      alapadatok_id: alapadatokId,
      tanev: {
        gte: firstYear,
        lte: lastYear
      }
    }
  });
  
  await pattern.serviceCache.invalidateAll();
  return deleted;
}
