import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

const pattern = new ServicePattern("szakkepzesiMunkaszerzodesAranya", "id", {
  szakirany: true,
  szakma: true,
});

export async function getAll(tanev) {
  return await pattern.findAllByYear(tanev);
}

export async function getSzakkepzesiMunkaszerzodesAranya(alapadatokId, tanev) {
  return await pattern.findByAlapadatokIdAndYear(alapadatokId, tanev);
}

export async function createSzakkepzesiMunkaszerzodesAranya(
  alapadatok_id,
  szakiranyNev,
  szakmaNev,
  tanulok_osszeletszam,
  munkaszerzodeses_tanulok_szama,
  createBy = null,
  tanev_kezdete
) {
  // Since this has complex relationships with szakirany/szakma connects, use direct Prisma
  let newRecord;
  if (szakmaNev && szakmaNev !== "Nincs meghatározva") {
    newRecord = await prisma.szakkepzesiMunkaszerzodesAranya.create({
      data: {
        alapadatok: { connect: { id: alapadatok_id } },
        szakirany: { connect: { nev: szakiranyNev } },
        szakma: { connect: { nev: szakmaNev } },
        tanev_kezdete: tanev_kezdete,
        tanulok_osszeletszam: Number(tanulok_osszeletszam),
        munkaszerzodeses_tanulok_szama: Number(munkaszerzodeses_tanulok_szama),
        createAt: new Date(),
        createBy: createBy,
      },
    });
  } else {
    newRecord = await prisma.szakkepzesiMunkaszerzodesAranya.create({
      data: {
        alapadatok: { connect: { id: alapadatok_id } },
        szakirany: { connect: { nev: szakiranyNev } },
        tanev_kezdete: tanev_kezdete,
        tanulok_osszeletszam: Number(tanulok_osszeletszam),
        munkaszerzodeses_tanulok_szama: Number(munkaszerzodeses_tanulok_szama),
        createAt: new Date(),
        createBy: createBy,
      },
    });
  }

  // Use pattern's cache invalidation
  await pattern.serviceCache.invalidateRelated("create", newRecord.id);

  return newRecord;
}

export async function updateSzakkepzesiMunkaszerzodesAranya(
  id,
  alapadatok_id,
  szakiranyNev,
  szakmaNev,
  tanulok_osszeletszam,
  munkaszerzodeses_tanulok_szama,
  createBy = null,
  tanev_kezdete
) {
  // Since this has complex relationships with szakirany/szakma connects, use direct Prisma
  let updatedRecord;
  if (szakmaNev && szakmaNev !== "Nincs meghatározva") {
    updatedRecord = await prisma.szakkepzesiMunkaszerzodesAranya.update({
      where: { id },
      data: {
        alapadatok: { connect: { id: alapadatok_id } },
        szakirany: { connect: { nev: szakiranyNev } },
        szakma: { connect: { nev: szakmaNev } },
        tanulok_osszeletszam: Number(tanulok_osszeletszam),
        munkaszerzodeses_tanulok_szama: Number(munkaszerzodeses_tanulok_szama),
        createAt: new Date(),
        createBy: createBy,
        tanev_kezdete: tanev_kezdete,
      },
    });
  } else {
    updatedRecord = await prisma.szakkepzesiMunkaszerzodesAranya.update({
      where: { id },
      data: {
        alapadatok: { connect: { id: alapadatok_id } },
        szakirany: { connect: { nev: szakiranyNev } },
        tanulok_osszeletszam: Number(tanulok_osszeletszam),
        munkaszerzodeses_tanulok_szama: Number(munkaszerzodeses_tanulok_szama),
        createAt: new Date(),
        createBy: createBy,
        tanev_kezdete: tanev_kezdete,
      },
    });
  }

  // Use pattern's cache invalidation
  await pattern.serviceCache.invalidateRelated("update", id);

  return updatedRecord;
}

export async function deleteSzakkepzesiMunkaszerzodesAranya(id) {
  const record = await pattern.findById(id);

  if (!record) {
    throw new Error("Record not found");
  }

  await pattern.delete(id);

  return { message: "Record deleted successfully" };
}
