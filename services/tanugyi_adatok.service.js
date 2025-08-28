import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";

// Note: Using custom field mapping for camelCase vs snake_case difference
const pattern = new ServicePattern(
  "tanugyi_Adatok",
  "id",
  {},
  {},
  {
    yearField: "tanev_kezdete", // This service uses tanev_kezdete field
    alapadatokField: "alapadatok_id",
  }
);

export async function getAll(alapadatok_id, ev) {
  return await pattern.findAllByAlapadatok(alapadatok_id);
}

export async function createMany(alapadatok_id, data) {
  const alapadatokExists = await prisma.alapadatok.findUnique({
    where: { id: alapadatok_id },
  });

  if (!alapadatokExists) {
    throw new Error(`Alapadatok with id ${alapadatok_id} not found`);
  }

  let year = new Date().getFullYear();
  const month = new Date().getMonth();

  if (month <= 8) {
    year -= 1;
  }

  // Delete existing records first
  await pattern.deleteByAlapadatokIdAndExactYear(alapadatok_id, year);

  // Prepare data
  const preparedData = data.map((item) => ({
    ...item,
    alapadatok_id,
    createBy: "cc2c2d68-5b38-4f9b-9e4f-1a3c9a0fb2a4",
    tanev_kezdete: year,
  }));

  // Remove unwanted fields
  preparedData.forEach((element) => {
    delete element.__index;
    delete element.__errors;
  });

  return await pattern.createMany(preparedData);
}
