import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";
import { generateAndSaveFromTanugyiAdatok } from "./tanulo_letszam.service.js";

// Note: Using custom field mapping for camelCase vs snake_case difference
const pattern = new ServicePattern(
  "tanugyi_Adatok",
  "id",
  {},
  {},
  {
    yearField: "tanev_kezdete", // This service uses tanev_kezdete field
    alapadatokField: "alapadatok_id",
  },
);

export async function getAll(alapadatok_id, ev) {
  return await pattern.findAllByAlapadatok(alapadatok_id);
}

export async function createMany(alapadatok_id, data, userId) {
  const alapadatokExists = await prisma.alapadatok.findUnique({
    where: { id: alapadatok_id },
  });

  if (!alapadatokExists) {
    throw new Error(`Alapadatok with id ${alapadatok_id} not found`);
  }

  let year = new Date().getFullYear();
  const month = new Date().getMonth();

  if (month <= 7) {
    year -= 1;
  }

  // Delete existing records first
  await pattern.deleteByAlapadatokIdAndExactYear(alapadatok_id, year);

  // Prepare data
  const preparedData = data.map((item) => ({
    ...item,
    alapadatok_id,
    createBy: userId,
    tanev_kezdete: year,
  }));

  // Remove unwanted fields
  preparedData.forEach((element) => {
    delete element.__index;
    delete element.__errors;
  });

  const result = await pattern.createMany(preparedData);

  // Automatically calculate and save tanulo_letszam from the newly uploaded tanugyi_adatok
  try {
    await generateAndSaveFromTanugyiAdatok(alapadatok_id, year);
    console.log(`✅ Automatically synced tanulo_letszam for school ${alapadatok_id}, year ${year}`);
  } catch (syncError) {
    console.error("Error auto-generating tanulo_letszam from tanugyi_adatok:", syncError);
  }

  return result;
}
