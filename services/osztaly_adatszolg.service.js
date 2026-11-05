import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

const pattern = new ServicePattern(
  "OsztalyAdatszolg",
  "id",
  {},
  {},
  {
    yearField: "tanev_kezdete",
    alapadatokField: "alapadatok_id",
  }
);

export async function getAll(alapadatok_id, ev) {
  return await pattern.findByAlapadatokIdAndYear(alapadatok_id, ev);
}

export async function getNappaliClasses(alapadatok_id, ev) {
  const records = await pattern.findByAlapadatokIdAndYear(alapadatok_id, ev);
  if (!Array.isArray(records)) return [];

  const nappaliSet = new Set();
  records.forEach((r) => {
    const munkarend = r.Munkarend || r.munkarend || "";
    if (String(munkarend).toLowerCase().includes("nappali")) {
      const cls = r.Osztaly_neve || r.osztaly_neve || "";
      if (cls && String(cls).trim()) {
        nappaliSet.add(String(cls).trim());
      }
    }
  });

  return Array.from(nappaliSet);
}

export async function createMany(alapadatok_id, data, tanev_kezdete, userId = "cc2c2d68-5b38-4f9b-9e4f-1a3c9a0fb2a4") {
  const alapadatokExists = await prisma.alapadatok.findUnique({
    where: { id: alapadatok_id },
  });

  if (!alapadatokExists) {
    throw new Error(`Alapadatok with id ${alapadatok_id} not found`);
  }

  // Delete existing records first for this year and school
  await pattern.deleteByAlapadatokIdAndExactYear(alapadatok_id, tanev_kezdete);

  // Prepare data
  const preparedData = data.map((item) => ({
    ...item,
    alapadatok_id,
    createBy: userId,
    tanev_kezdete: parseInt(tanev_kezdete, 10),
  }));

  // Remove unwanted fields
  preparedData.forEach((element) => {
    delete element.__index;
    delete element.__errors;
  });

  return await pattern.createMany(preparedData);
}
