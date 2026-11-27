/**
 * Normalizes sector (ágazat) and profession (szakma) names coming from the KRÉTA
 * "Tanulók tanügyi adatai" export, so they match the names configured for a school.
 *
 * KRÉTA has used several formats for the same value:
 *   old: "Cukrász - 4 1013 23 01 (2020)"     "Turizmus-vendéglátás - 23 (2020)"
 *   new: "Cukrász (4 1013 23 01)"           "Gépészet - Szakképző iskola"
 * Profession names may contain " - " themselves ("Pincér - vendégtéri szakember"),
 * so for professions only the code is removed. Sector (ágazat) names never contain
 * " - ", so for them everything after it is dropped.
 *
 * Keep in sync with indicator_frontend/src/utils/kepzesName.js.
 */
export const NINCS_MEGHATAROZVA = "Nincs meghatározva";

const OLD_CODE_SUFFIX = /\s+-\s+\d[\d\s]*(\(\d{4}\))?\s*$/; // " - 4 1013 23 01 (2020)", " - 23 (2020)", " - 061"
const NEW_CODE_SUFFIX = /\s*\(\s*\d[\d\s]*\)\s*$/; //     " (4 1013 23 01)"
const EMPTY = /^(na|n\/a|-|nincs meghatározva)$/i;

/** Clean profession (szakma) name, or null when the value means "not specified". */
export function normalizeKepzesName(value) {
  if (value === null || value === undefined) return null;
  const name = String(value).trim().replace(OLD_CODE_SUFFIX, "").replace(NEW_CODE_SUFFIX, "").replace(/\s+/g, " ").trim();
  return !name || EMPTY.test(name) ? null : name;
}

export const normalizeSzakmaName = normalizeKepzesName;

/** Clean sector (ágazat) name, or null when the value means "not specified". */
export function normalizeAgazatName(value) {
  const name = normalizeKepzesName(value)?.split(" - ")[0].trim();
  return name && !EMPTY.test(name) ? name : null;
}

/** Comparison key for professions: normalized, case-insensitive. */
export function kepzesNameKey(value) {
  return normalizeKepzesName(value)?.toLocaleLowerCase("hu") ?? null;
}

/** Comparison key for sectors. */
export function agazatNameKey(value) {
  return normalizeAgazatName(value)?.toLocaleLowerCase("hu") ?? null;
}

/**
 * Index records ({ nev }) by comparison key. When several records share a key
 * (e.g. "Cukrász" and an older auto-created "Cukrász (4 1013 23 01)"), the one whose
 * stored name is already clean wins, so data links to the canonical record.
 */
export function indexByKepzesName(records, keyOf = kepzesNameKey) {
  const index = new Map();
  for (const record of records) {
    const key = keyOf(record?.nev);
    if (!key) continue;
    const current = index.get(key);
    const isClean = normalizeKepzesName(record.nev) === record.nev;
    if (!current || (isClean && normalizeKepzesName(current.nev) !== current.nev)) index.set(key, record);
  }
  return index;
}

/** Prisma include that loads what schoolKepzesLookup needs. */
export const SCHOOL_KEPZES_INCLUDE = {
  alapadatok_szakma: { select: { szakma_id: true } },
  alapadatok_szakirany: {
    include: { szakirany: { include: { szakma: { include: { szakma: true } } } } },
  },
};

/**
 * The sectors and professions configured for a school (loaded with
 * SCHOOL_KEPZES_INCLUDE), keyed by kepzesNameKey. Mirrors what the indicator pages
 * show (alapadatok.service): a profession belongs to the school only if it is linked
 * both to the school and to one of the school's sectors.
 */
export function schoolKepzesLookup(school) {
  const szakirany = new Map(); // agazatNameKey -> { id, nev }
  const szakma = new Map(); // key -> { id, nev }
  const szakmaToSzakirany = new Map(); // szakma key -> configured szakirány name
  const categories = []; // [{ szakiranyName, szakmaNev|null }] in configuration order
  const schoolSzakmaIds = new Set((school?.alapadatok_szakma || []).map((rel) => rel.szakma_id));

  for (const rel of school?.alapadatok_szakirany || []) {
    const sector = rel.szakirany;
    if (!sector?.nev) continue;
    szakirany.set(agazatNameKey(sector.nev), sector);
    categories.push({ szakiranyName: sector.nev, szakmaNev: null });
    for (const link of sector.szakma || []) {
      const profession = link.szakma;
      if (!profession?.nev || !schoolSzakmaIds.has(profession.id)) continue;
      szakma.set(kepzesNameKey(profession.nev), profession);
      szakmaToSzakirany.set(kepzesNameKey(profession.nev), sector.nev);
      categories.push({ szakiranyName: sector.nev, szakmaNev: profession.nev });
    }
  }
  return { szakirany, szakma, szakmaToSzakirany, categories };
}
