import prisma from "../utils/prisma.js";
import * as cache from "../utils/cache.js";

// Cache TTLs
const CACHE_TTL = {
  LIST: 5 * 60 * 1000, // 5 minutes for lists
  DETAIL: 10 * 60 * 1000, // 10 minutes for details
};

export async function getAll() {
  const cacheKey = "alapadatok:all";
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  const data = await prisma.alapadatok.findMany({
    include: {
      alapadatok_szakma: {
        include: {
          szakma: true,
        },
      },
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
    where: {
      deleted: false, // Exclude deleted records
    },
  });

  const filteredBySzakma = data.map((item) => {
    const alapadatok_szakma = item.alapadatok_szakma.map((rel) => rel.szakma);
    return {
      ...item,
      alapadatok_szakirany: item.alapadatok_szakirany.map((szakirany_rel) => ({
        ...szakirany_rel,
        szakirany: {
          ...szakirany_rel.szakirany,
          szakma: szakirany_rel.szakirany.szakma.filter((szakmaRel) =>
            alapadatok_szakma.some((s) => s.id === szakmaRel.szakma.id)
          ),
        },
      })),
    };
  });

  // Store in cache
  // cache.set(cacheKey, filteredBySzakma, CACHE_TTL.LIST);

  return filteredBySzakma;
}

export async function getById(id) {
  const cacheKey = `alapadatok:id:${id}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return cachedData;
  }

  let year = new Date().getFullYear();
  const month = new Date().getMonth();

  if (month < 6) {
    year -= 1;
  }

  const data = await prisma.alapadatok.findUnique({
    where: {
      id: id,
    },
    include: {
      alapadatok_szakma: {
        include: {
          szakma: true,
        },
      },
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
    where: {
      deleted: false, // Exclude deleted records
    },
  });

  const alapadatok_szakma = data.alapadatok_szakma.map((rel) => rel.szakma);

  const filteredBySzakma = {
    ...data,
    alapadatok_szakirany: data.alapadatok_szakirany.map((szakirany_rel) => ({
      ...szakirany_rel,
      szakirany: {
        ...szakirany_rel.szakirany,
        szakma: szakirany_rel.szakirany.szakma.filter((szakmaRel) =>
          alapadatok_szakma.some((s) => s.id === szakmaRel.szakma.id)
        ),
      },
    })),
  };

  // Store in cache
  // cache.set(cacheKey, filteredBySzakma, CACHE_TTL.DETAIL);

  return filteredBySzakma;
}

export async function add(
  iskola_neve,
  intezmeny_tipus,
  alapadatok_szakirany = []
) {
  // Invalidate the list cache before adding
  cache.del("alapadatok:all");

  alapadatok_szakirany.map((szakirany) => {
    szakirany.szakirany.szakma.map((szakma) => {
      console.log(szakma.szakma);
    });
  });

  const foundOrCreatedSzakirany = await Promise.all(
    alapadatok_szakirany.map(async (szakirany) => {
      const szakiranyNev = szakirany.szakirany.nev;

      // Check if the szakirany already exists
      const existingSzakirany = await prisma.szakirany.findUnique({
        where: {
          nev: szakiranyNev,
        },
      });

      if (existingSzakirany) {
        // Get existing szakma for this szakirany
        const existingSzakiranyWithSzakma = await prisma.szakirany.findUnique({
          where: { id: existingSzakirany.id },
          include: {
            szakma: {
              include: {
                szakma: true,
              },
            },
          },
        });

        const existingSzakmaNames = existingSzakiranyWithSzakma.szakma.map(
          (s) => s.szakma.nev
        );

        // Filter out szakma that are already connected
        const newSzakmaToAdd = szakirany.szakirany.szakma.filter(
          (szakma) => !existingSzakmaNames.includes(szakma.szakma.nev)
        );

        // Only update if there are new szakma to add
        if (newSzakmaToAdd.length > 0) {
          await prisma.szakirany.update({
            where: { id: existingSzakirany.id },
            data: {
              nev: szakiranyNev,
              szakma: {
                create: newSzakmaToAdd.map((szakma) => ({
                  szakma: {
                    connectOrCreate: {
                      where: { nev: szakma.szakma.nev },
                      create: {
                        nev: szakma.szakma.nev,
                      },
                    },
                  },
                })),
              },
            },
          });
        }

        return existingSzakirany;
      }

      // If not, create it
      return await prisma.szakirany.create({
        data: {
          nev: szakiranyNev,
          szakma: {
            create: szakirany.szakirany.szakma.map((szakma) => ({
              szakma: {
                connectOrCreate: {
                  where: { nev: szakma.szakma.nev },
                  create: {
                    nev: szakma.szakma.nev,
                  },
                },
              },
            })),
          },
        },
      });
    })
  );

  const szakmakNev = alapadatok_szakirany.flatMap((szakirany) =>
    szakirany.szakirany.szakma.map((szakma) => ({
      nev: szakma.szakma.nev,
    }))
  );

  const foundSzakmak = await prisma.szakma.findMany({
    where: {
      nev: {
        in: szakmakNev.map((szakma) => szakma.nev),
      },
    },
  });

  const foundOrCreatedSzakmak = szakmakNev.map((szakma) => {
    const existingSzakma = foundSzakmak.find((s) => s.nev === szakma.nev);
    if (existingSzakma) {
      return existingSzakma;
    }
    return prisma.szakma.create({
      data: {
        nev: szakma.nev,
      },
    });
  });

  const createdSzakmak = await Promise.all(foundOrCreatedSzakmak);

  const result = await prisma.alapadatok.create({
    data: {
      iskola_neve: iskola_neve,
      intezmeny_tipus: intezmeny_tipus,
      alapadatok_szakirany: {
        create: foundOrCreatedSzakirany.map((szakirany) => ({
          szakirany_id: szakirany.id,
        })),
      },
      alapadatok_szakma: {
        create: createdSzakmak.map((szakma) => ({
          szakma_id: szakma.id,
        })),
      },
    },
  });

  return result;
}

export async function update(
  id,
  iskola_neve,
  intezmeny_tipus,
  alapadatok_szakirany
) {
  // Invalidate both list and specific item cache
  cache.del("alapadatok:all");
  cache.del(`alapadatok:id:${id}`);

  const foundOrCreatedSzakirany = await Promise.all(
    alapadatok_szakirany.map(async (szakirany) => {
      const szakiranyNev = szakirany.szakirany.nev;

      // Check if the szakirany already exists
      const existingSzakirany = await prisma.szakirany.findUnique({
        where: {
          nev: szakiranyNev,
        },
      });
      if (existingSzakirany) {
        // Get existing szakma for this szakirany
        const existingSzakiranyWithSzakma = await prisma.szakirany.findUnique({
          where: { id: existingSzakirany.id },
          include: {
            szakma: {
              include: {
                szakma: true,
              },
            },
          },
        });

        const existingSzakmaNames = existingSzakiranyWithSzakma.szakma.map(
          (s) => s.szakma.nev
        );

        // Filter out szakma that are already connected
        const newSzakmaToAdd = szakirany.szakirany.szakma.filter(
          (szakma) => !existingSzakmaNames.includes(szakma.szakma.nev)
        );

        // Only update if there are new szakma to add
        if (newSzakmaToAdd.length > 0) {
          await prisma.szakirany.update({
            where: { id: existingSzakirany.id },
            data: {
              nev: szakiranyNev,
              szakma: {
                create: newSzakmaToAdd.map((szakma) => ({
                  szakma: {
                    connectOrCreate: {
                      where: { nev: szakma.szakma.nev },
                      create: {
                        nev: szakma.szakma.nev,
                      },
                    },
                  },
                })),
              },
            },
          });
        }

        return existingSzakirany;
      }

      // If not, create it
      return await prisma.szakirany.create({
        data: {
          nev: szakiranyNev,
          szakma: {
            create: szakirany.szakirany.szakma.map((szakma) => ({
              szakma: {
                connectOrCreate: {
                  where: { nev: szakma.szakma.nev },
                  create: {
                    nev: szakma.szakma.nev,
                  },
                },
              },
            })),
          },
        },
      });
    })
  );

  const szakmakNev = alapadatok_szakirany.flatMap((szakirany) =>
    szakirany.szakirany.szakma.map((szakma) => ({
      nev: szakma.szakma.nev,
    }))
  );

  const foundSzakmak = await prisma.szakma.findMany({
    where: {
      nev: {
        in: szakmakNev.map((szakma) => szakma.nev),
      },
    },
  });

  const foundOrCreatedSzakmak = szakmakNev.map((szakma) => {
    const existingSzakma = foundSzakmak.find((s) => s.nev === szakma.nev);
    if (existingSzakma) {
      return existingSzakma;
    }
    return prisma.szakma.create({
      data: {
        nev: szakma.nev,
      },
    });
  });

  const createdSzakmak = await Promise.all(foundOrCreatedSzakmak);

  // First, get existing relationships
  const existingData = await prisma.alapadatok.findUnique({
    where: { id: id },
    include: {
      alapadatok_szakirany: true,
      alapadatok_szakma: true,
    },
  });

  // Get existing szakirany and szakma IDs
  const existingSzakiranyIds = existingData.alapadatok_szakirany.map(
    (rel) => rel.szakirany_id
  );
  const existingSzakmaIds = existingData.alapadatok_szakma.map(
    (rel) => rel.szakma_id
  );

  // Filter out already connected szakirany
  const newSzakiranyConnections = foundOrCreatedSzakirany
    .filter((szakirany) => !existingSzakiranyIds.includes(szakirany.id))
    .map((szakirany) => ({ szakirany_id: szakirany.id }));

  // Filter out already connected szakma
  const newSzakmaConnections = createdSzakmak
    .filter((szakma) => !existingSzakmaIds.includes(szakma.id))
    .map((szakma) => ({ szakma_id: szakma.id }));

  const retData = await prisma.alapadatok.update({
    data: {
      iskola_neve: iskola_neve,
      intezmeny_tipus: intezmeny_tipus,
      ...(newSzakiranyConnections.length > 0 && {
        alapadatok_szakirany: {
          create: newSzakiranyConnections,
        },
      }),
      ...(newSzakmaConnections.length > 0 && {
        alapadatok_szakma: {
          create: newSzakmaConnections,
        },
      }),
    },
    where: {
      id: id,
    },
  });

  return retData;
}

export async function removeSzakiranyFromAlapadatok(
  alapadatok_id,
  szakirany_id
) {
  // Invalidate both list and specific item cache
  cache.del("alapadatok:all");
  cache.del(`alapadatok:id:${alapadatok_id}`);

  await prisma.alapadatok_Szakirany.deleteMany({
    where: {
      alapadatok_id: alapadatok_id,
      szakirany_id: szakirany_id,
    },
  });

  cache.del(`alapadatok:id:${alapadatok_id}`);
}

export async function removeSzakmaFromAlapadatok(alapadatok_id, szakma_id) {
  // Invalidate both list and specific item cache
  cache.del("alapadatok:all");
  cache.del(`alapadatok:id:${alapadatok_id}`);

  await prisma.alapadatok_Szakma.deleteMany({
    where: {
      alapadatok_id: alapadatok_id,
      szakma_id: szakma_id,
    },
  });

  cache.del(`alapadatok:id:${alapadatok_id}`);

  return { message: "Szakma removed from Alapadatok" };
}

export async function deleteById(id) {
  // Invalidate both list and specific item cache
  cache.del("alapadatok:all");
  cache.del(`alapadatok:id:${id}`);

  await prisma.alapadatok.update({
    where: { id: id },
    data: {
      deleted: true,
    },
  });

  return { message: "Alapadatok deleted" };
}
