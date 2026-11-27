/**
 * Which permission table (table_list.name, see TableAccess) governs which API
 * endpoint. Previously endpointAccess matched table names as substrings of the URL,
 * which both locked users out (e.g. /szakmairendezvenyek vs "szakmai_rendezvenyek")
 * and over-granted (the "kompetencia" right opened /digitalis_kompetencia).
 *
 * Key: first path segment after /api/v1/. Value: tables of which ANY grants access.
 * Every router mounted on protectedRouter in index.js must be listed here (or in
 * PUBLIC_READ_SEGMENTS); a test enforces this, and unknown segments are denied.
 */
export const ENDPOINT_TABLES = {
  tanugyi_adatok: ["tanugyi_adatok"],
  tanulo_letszam: ["tanulo_letszam"],
  kompetencia: ["kompetencia"],
  felvettek_szama: ["felvettek_szama"],
  users: ["user"],
  tablelist: ["tablelist"],
  egy_oktatora_juto_tanulo: ["egy_oktatora_juto_tanulo"],
  szmsz: ["szmsz"],
  versenyek: ["versenyek"],
  dobbanto: ["dobbanto"],
  elegedettseg_meres: ["elegedettseg_meres"],
  elegedettseg: ["elegedettseg"],
  elhelyezkedes: ["elhelyezkedes"],
  hh_es_hhh: ["hh_es_hhh"],
  // Used by both the "Intézményi neveltség" page and indicator 17.
  intezmenyi_neveltsegi_mutatok: ["intezmenyi_neveltsegi_mutatok", "intezmenyi_neveltseg"],
  lemorzsolodas: ["lemorzsolodas"],
  muhelyiskola: ["muhelyiskola"],
  nszfh: ["nszfh"],
  sajatos_nevelesu_tanulok: ["sajatos_nevelesu_tanulok"],
  szakmai_vizsga_eredmenyek: ["szakmai_vizsga_eredmenyek"],
  vizsgaeredmenyek: ["vizsgaeredmenyek"],
  szakmairendezvenyek: ["szakmai_rendezvenyek"],
  "oktato-egyeb-tev": ["oktato-egyeb-tev"],
  alkalmazottak_munkaugy: ["alkalmazottak_munkaugy"],
  tanulo_adatszolgaltatas: ["tanulo_adatszolgaltatas"],
  oktato_adatszolgaltatas: ["oktato_adatszolgaltatas"],
  // Saved from the data import page together with the tanügyi data.
  osztaly_adatszolgaltatas: ["tanugyi_adatok"],
  hianyzas: ["hianyzas"],
  intezmenyi_elismeresek: ["intezmenyi_elismeresek"],
  // Part of indicator 13 (Intézményi elismerések).
  munkavallalok_elismeresek: ["intezmenyi_elismeresek"],
  szakmai_tovabbkepzes: ["szakmai_tovabbkepzesek"],
  szervezetfejlesztes: ["szervezetfejlesztes"],
  palyazatok: ["palyazatok"],
  tanulmanyi_eredmeny: ["tanulmanyi_eredmeny"],
  dualis_kepzohelyek: ["dualis_kepzohelyek"],
  innovacios_tevekenysegek: ["innovacios_tevekenysegek"],
  szakkepzes_zolditese: ["szakkepzes_zolditese"],
  projektek: ["projektek"],
  digitalis_kompetencia: ["digitalis_kompetencia"],
  palya_orientacio: ["palyaorientacio"],
  nyelvvizsgak_szama: ["nyelvvizsgak_szama"],
  egyuttmukudesek_szama: ["egyuttmukudesek_szama"],
  // Part of indicator 27 (Egy oktatóra jutó összes diák).
  engedelyezett_oratomeg: ["egy_oktatora_juto_ossz_diak"],
  // Form history is checked per snapshot table (see tablesForSnapshot).
  form_history: null,
};

/** GET is open to every authenticated user (dictionaries / data shared by pages). */
export const PUBLIC_READ_SEGMENTS = new Set([
  "tablelist",
  "tanugyi_adatok",
  "alkalmazottak_munkaugy",
  "osztaly_adatszolgaltatas",
  "szakma",
  "szakirany",
]);

const normalize = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Snapshot names (form history) that do not normalize to their permission table.
const SNAPSHOT_OVERRIDES = {
  engedelyezettoratomeg: "egy_oktatora_juto_ossz_diak",
  hheshhhtanulok: "hh_es_hhh",
  munkavallalokelismeresek: "intezmenyi_elismeresek",
  nszfhmeresek: "nszfh",
  szakkepzesimunkaszerzodesaranya: "szmsz",
  szakmaitovabbkepzes: "szakmai_tovabbkepzesek",
  oktatoadatszolg: "oktato_adatszolgaltatas",
  tanuloadatszolg: "tanulo_adatszolgaltatas",
  osztalyadatszolg: "tanugyi_adatok",
};

/**
 * Permission tables for a form-history table name such as "tanulo_Letszam",
 * "nszfhMeresek" or "palya_orientacio". Returns [] when unknown (deny).
 */
export function tablesForSnapshot(snapshotTable) {
  const key = normalize(snapshotTable);
  if (!key) return [];
  if (SNAPSHOT_OVERRIDES[key]) return [SNAPSHOT_OVERRIDES[key]];
  const viaEndpoint = Object.entries(ENDPOINT_TABLES).find(([segment, tables]) => tables && normalize(segment) === key);
  if (viaEndpoint) return viaEndpoint[1];
  const direct = Object.values(ENDPOINT_TABLES).flat().find((table) => table && normalize(table) === key);
  return direct ? [direct] : [];
}

const METHOD_PERMISSION = { GET: "canRead", HEAD: "canRead", POST: "canCreate", PUT: "canUpdate", PATCH: "canUpdate", DELETE: "canDelete" };

/** True when `user` has the permission needed for `method` on any of `tables`. */
export function userHasTableAccess(user, tables, method) {
  const permission = METHOD_PERMISSION[method];
  if (!permission || !tables?.length) return false;
  return (user?.tableAccess || []).some(
    (access) => tables.includes(access.tableName) && access.permissionsDetails?.[permission],
  );
}
