import { ServicePattern } from "../utils/ServicePattern.js";

const pattern = new ServicePattern("oktatoEgyebTev", "id");

export async function getAllByAlapadatok(alapadatokId, tanev) {
  return await pattern.findByAlapadatokIdAndYear(alapadatokId, tanev);
}

export async function getAll(tanev) {
  return await pattern.findAllByYear(tanev);
}

export async function getById(id) {
  return await pattern.findById(id);
}

export async function create(
  alapadatok_id,
  tanev_kezdete,
  szakkepzesi_szakerto = 0,
  koznevelesi_szakerto = 0,
  koznevelesi_szaktanacsado = 0,
  vizsgafelugyelo = 0,
  agazati_alapvizsgan_elnok = 0,
  feladatkeszito_lektor = 0,
  erettsegi_elnok = 0,
  emelt_erettsegi_vb_tag = 0,
  emelt_erettsegi_vb_elnok = 0,
  erettsegi_vizsgaztato = 0,
  tanterviro = 0,
  tananyagfejleszto = 0,
  tankonyv_jegyzetiro = 0,
  szakmai_tisztsegviselo = 0,
  oktatok_letszama = 0,
  createBy = null
) {
  // Validate required fields
  if (!alapadatok_id) {
    throw new Error("alapadatok_id is required");
  }

  if (!tanev_kezdete) {
    throw new Error("tanev_kezdete is required");
  }

  // Validate tanev_kezdete is a valid year
  const tanev_int = parseInt(tanev_kezdete);
  if (isNaN(tanev_int) || tanev_int < 1900 || tanev_int > 2100) {
    throw new Error("tanev_kezdete must be a valid year between 1900 and 2100");
  }

  return await pattern.create({
    alapadatok_id,
    tanev_kezdete: tanev_int,
    szakkepzesi_szakerto: parseInt(szakkepzesi_szakerto) || 0,
    koznevelesi_szakerto: parseInt(koznevelesi_szakerto) || 0,
    koznevelesi_szaktanacsado: parseInt(koznevelesi_szaktanacsado) || 0,
    vizsgafelugyelo: parseInt(vizsgafelugyelo) || 0,
    agazati_alapvizsgan_elnok: parseInt(agazati_alapvizsgan_elnok) || 0,
    feladatkeszito_lektor: parseInt(feladatkeszito_lektor) || 0,
    erettsegi_elnok: parseInt(erettsegi_elnok) || 0,
    emelt_erettsegi_vb_tag: parseInt(emelt_erettsegi_vb_tag) || 0,
    emelt_erettsegi_vb_elnok: parseInt(emelt_erettsegi_vb_elnok) || 0,
    erettsegi_vizsgaztato: parseInt(erettsegi_vizsgaztato) || 0,
    tanterviro: parseInt(tanterviro) || 0,
    tananyagfejleszto: parseInt(tananyagfejleszto) || 0,
    tankonyv_jegyzetiro: parseInt(tankonyv_jegyzetiro) || 0,
    szakmai_tisztsegviselo: parseInt(szakmai_tisztsegviselo) || 0,
    oktatok_letszama: parseInt(oktatok_letszama) || 0,
    createBy,
  });
}

export async function update(
  id,
  alapadatok_id,
  tanev_kezdete,
  szakkepzesi_szakerto = 0,
  koznevelesi_szakerto = 0,
  koznevelesi_szaktanacsado = 0,
  vizsgafelugyelo = 0,
  agazati_alapvizsgan_elnok = 0,
  feladatkeszito_lektor = 0,
  erettsegi_elnok = 0,
  emelt_erettsegi_vb_tag = 0,
  emelt_erettsegi_vb_elnok = 0,
  erettsegi_vizsgaztato = 0,
  tanterviro = 0,
  tananyagfejleszto = 0,
  tankonyv_jegyzetiro = 0,
  szakmai_tisztsegviselo = 0,
  oktatok_letszama = 0,
  updatedBy = null
) {
  // Validate required fields
  if (!id) {
    throw new Error("id is required");
  }

  if (!alapadatok_id) {
    throw new Error("alapadatok_id is required");
  }

  if (!tanev_kezdete) {
    throw new Error("tanev_kezdete is required");
  }

  // Validate tanev_kezdete is a valid year
  const tanev_int = parseInt(tanev_kezdete);
  if (isNaN(tanev_int) || tanev_int < 1900 || tanev_int > 2100) {
    throw new Error("tanev_kezdete must be a valid year between 1900 and 2100");
  }

  return await pattern.update(id, {
    alapadatok_id,
    tanev_kezdete: tanev_int,
    szakkepzesi_szakerto: parseInt(szakkepzesi_szakerto) || 0,
    koznevelesi_szakerto: parseInt(koznevelesi_szakerto) || 0,
    koznevelesi_szaktanacsado: parseInt(koznevelesi_szaktanacsado) || 0,
    vizsgafelugyelo: parseInt(vizsgafelugyelo) || 0,
    agazati_alapvizsgan_elnok: parseInt(agazati_alapvizsgan_elnok) || 0,
    feladatkeszito_lektor: parseInt(feladatkeszito_lektor) || 0,
    erettsegi_elnok: parseInt(erettsegi_elnok) || 0,
    emelt_erettsegi_vb_tag: parseInt(emelt_erettsegi_vb_tag) || 0,
    emelt_erettsegi_vb_elnok: parseInt(emelt_erettsegi_vb_elnok) || 0,
    erettsegi_vizsgaztato: parseInt(erettsegi_vizsgaztato) || 0,
    tanterviro: parseInt(tanterviro) || 0,
    tananyagfejleszto: parseInt(tananyagfejleszto) || 0,
    tankonyv_jegyzetiro: parseInt(tankonyv_jegyzetiro) || 0,
    szakmai_tisztsegviselo: parseInt(szakmai_tisztsegviselo) || 0,
    oktatok_letszama: parseInt(oktatok_letszama) || 0,
    updatedBy,
  });
}

export async function deleteById(id) {
  if (!id) {
    throw new Error("id is required");
  }

  // Check if entry exists before deletion
  const entry = await pattern.findById(id);
  if (!entry) {
    throw new Error("Entry not found");
  }

  return await pattern.delete(id);
}
