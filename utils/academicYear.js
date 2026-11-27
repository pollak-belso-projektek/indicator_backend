/**
 * Academic (school) year helpers. The Hungarian school year starts on 1 September,
 * and a year is identified by its starting calendar year: 2025 = 2025/2026.
 * The frontend uses the same rule (`getMonth() >= 8`), so keep them in sync.
 */

/** Starting year of the academic year that contains `date`. */
export function currentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  return date.getMonth() >= 8 ? year : year - 1; // getMonth(): 8 = September
}

/** The 5-year window [year - 4, year] used by the indicator lists. */
export function academicYearRange(year, span = 5) {
  const lastYear = parseInt(year, 10);
  return { firstYear: lastYear - (span - 1), lastYear };
}
