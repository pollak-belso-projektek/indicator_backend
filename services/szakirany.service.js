import { ServicePattern } from "../utils/ServicePattern.js";
import prisma from "../utils/prisma.js";
import { NINCS_MEGHATAROZVA } from "../utils/kepzesName.js";

const pattern = new ServicePattern(
  "szakirany",
  "id",
  {},
  {},
  { orderBy: { nev: "asc" } }
);

export async function getAll() {
  // "Nincs meghatározva" is the technical bucket for students without a sector
  // (tanulo_letszam); it is not a real sector and must not be assignable to a school.
  return (await pattern.findAll()).filter((szakirany) => szakirany.nev !== NINCS_MEGHATAROZVA);
}
