import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";
import { currentAcademicYear } from "../utils/academicYear.js";

// Note: This service uses different field naming (TanevKezdete vs tanev_kezdete)
const pattern = new ServicePattern('alkalmazottak_Munkaugy', 'id', {}, {}, {
  yearField: 'TanevKezdete', // Different field name in this model
  alapadatokField: 'alapadatok_id'
});

export async function getAll(alapadatok_id, tanev_kezdete) {
  if (tanev_kezdete) {
    return await pattern.findByAlapadatokIdAndYear(alapadatok_id, tanev_kezdete);
  }
  return await pattern.findAllByAlapadatok(alapadatok_id);
}

export async function createMany(alapadatok_id, data) {
  // Validate alapadatok_id exists
  const alapadatokExists = await prisma.alapadatok.findUnique({
    where: { id: alapadatok_id },
  });

  if (!alapadatokExists) {
    throw new Error(`Alapadatok with id ${alapadatok_id} not found`);
  }

  // Delete existing records first
  await pattern.deleteByAlapadatokId(alapadatok_id);

  const year = currentAcademicYear();

  // Prepare data with validation and cleanup
  const preparedData = data.map((item) => {
    const processedItem = {
      ...item,
      alapadatok_id,
      TanevKezdete: item.TanevKezdete || year,
    };

    // A sémában Decimal(5,2) van, szóval max 999.99 lehet
    // De a gyakorlatban óránál ritkán van 100+ óra, szóval limitáljuk
    if (processedItem.Oraszam && parseFloat(processedItem.Oraszam) > 99.99) {
      console.warn(`Oraszam value ${processedItem.Oraszam} capped to 99.99`);
      processedItem.Oraszam = 99.99;
    }
    if (
      processedItem.FeladattalTerheltOraszam &&
      parseFloat(processedItem.FeladattalTerheltOraszam) > 99.99
    ) {
      console.warn(
        `FeladattalTerheltOraszam value ${processedItem.FeladattalTerheltOraszam} capped to 99.99`
      );
      processedItem.FeladattalTerheltOraszam = 99.99;
    }
    if (
      processedItem.PedagogusHetiOraszama &&
      parseFloat(processedItem.PedagogusHetiOraszama) > 99.99
    ) {
      console.warn(
        `PedagogusHetiOraszama value ${processedItem.PedagogusHetiOraszama} capped to 99.99`
      );
      processedItem.PedagogusHetiOraszama = 99.99;
    }

    return processedItem;
  });

  // Remove unwanted fields
  preparedData.forEach((element) => {
    delete element.__index;
    delete element.__errors;
  });

  console.log(
    `Creating ${preparedData.length} alkalmazottak_munkaugy records for alapadatok_id: ${alapadatok_id}`
  );

  return await pattern.createMany(preparedData);
}
