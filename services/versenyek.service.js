import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

const pattern = new ServicePattern("versenyek", "id", {
  versenyNev: true,
  alapadatok: true,
});

export async function getAll(tanev) {
  return await pattern.findAllByYear(tanev);
}

export async function getAllByAlapadatok(alapadatokId, tanev) {
  return await pattern.findByAlapadatokIdAndYear(alapadatokId, tanev);
}

export async function create(
  versenyKategoria,
  versenyNev,
  helyezett_1,
  helyezett_1_3,
  dontobeJutott,
  nevezettekSzama,
  tanev_kezdete,
  alapadatokId
) {
  // Since this has complex relationships with versenyNev, we'll use direct Prisma for now
  // but still leverage cache invalidation from pattern
  const data = await prisma.versenyek.create({
    data: {
      helyezett_1,
      helyezett_1_3,
      dontobeJutott,
      nevezettekSzama,
      tanev_kezdete,
      alapadatok_id: alapadatokId,
      versenyNev: {
        connectOrCreate: {
          where: { id: versenyNev },
          create: {
            nev: versenyNev,
            versenyKategoria: {
              connectOrCreate: {
                where: { id: versenyKategoria },
                create: {
                  nev: versenyKategoria,
                },
              },
            },
          },
        },
      },
    },
  });

  // Use pattern's cache invalidation
  await pattern.serviceCache.invalidateRelated("create", data.id);

  return data;
}

export async function update(
  id,
  versenyKategoria,
  versenyNev,
  helyezett_1,
  helyezett_1_3,
  dontobeJutott,
  nevezettekSzama,
  tanev_kezdete
) {
  // Since this has complex relationships with versenyNev, we'll use direct Prisma for now
  // but still leverage cache invalidation from pattern
  const data = await prisma.versenyek.update({
    where: { id },
    data: {
      helyezett_1,
      helyezett_1_3,
      dontobeJutott,
      nevezettekSzama,
      tanev_kezdete,
      versenyNev: {
        connectOrCreate: {
          where: { id: versenyNev },
          create: {
            nev: versenyNev,
            versenyKategoria: {
              connectOrCreate: {
                where: { id: versenyKategoria },
                create: {
                  nev: versenyKategoria,
                },
              },
            },
          },
        },
      },
    },
  });

  // Use pattern's cache invalidation
  await pattern.serviceCache.invalidateRelated("update", id);

  return data;
}
