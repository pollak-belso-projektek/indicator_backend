import { ServicePattern } from "../utils/ServicePattern.js";

const pattern = new ServicePattern("dobbanto", "id", {
  alapadatok: true,
});

export async function getAll(tanev_kezdete) {
  return await pattern.findAllByYear(tanev_kezdete);
}

export async function getAllByAlapadatok(alapadatokId, tanev_kezdete) {
  return await pattern.findByAlapadatokIdAndYear(alapadatokId, tanev_kezdete);
}

export async function create(
  alapadatok_id,
  tanev_kezdete,
  dobbanto_szama,
  tanulok_osszesen
) {
  return await pattern.create({
    alapadatok_id,
    tanev_kezdete: parseInt(tanev_kezdete),
    dobbanto_szama: parseInt(dobbanto_szama),
    tanulok_osszesen: parseInt(tanulok_osszesen),
  });
}

export async function update(
  id,
  alapadatok_id,
  tanev_kezdete,
  dobbanto_szama,
  tanulok_osszesen
) {
  return await pattern.update(id, {
    alapadatok_id,
    tanev_kezdete: parseInt(tanev_kezdete),
    dobbanto_szama: parseInt(dobbanto_szama),
    tanulok_osszesen: parseInt(tanulok_osszesen),
  });
}

export async function deleteAllByAlapadatok(alapadatokId, tanev_kezdete) {
  return await pattern.deleteByAlapadatokIdAndYear(alapadatokId, tanev_kezdete);
}
