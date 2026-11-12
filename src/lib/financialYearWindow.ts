import { getZonedDateParts, zonedDateTimeToUtcDate } from "./orderSaleAmount";

export function fyStartYear(fy: string): number {
  return parseInt(fy.split("-")[0], 10);
}

export function formatFinancialYear(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function shiftFinancialYear(fy: string, delta: number): string {
  return formatFinancialYear(fyStartYear(fy) + delta);
}

export function fyFromDate(date: Date, timeZone: string): string {
  const parts = getZonedDateParts(date, timeZone);
  return formatFinancialYear(parts.month >= 4 ? parts.year : parts.year - 1);
}

export function getFinancialYearStart(fy: string, timeZone: string): Date {
  return zonedDateTimeToUtcDate(timeZone, fyStartYear(fy), 3, 1, 0, 0, 0, 0);
}

export function getFinancialYearEnd(fy: string, timeZone: string): Date {
  return zonedDateTimeToUtcDate(timeZone, fyStartYear(fy) + 1, 3, 1, 0, 0, 0, 0);
}

/** Oldest first; starts at the later of (endFy - maxYears + 1) and earliestFy. */
export function buildFinancialYearWindow(
  endFy: string,
  earliestFy: string | null,
  maxYears = 10
): string[] {
  const endStart = fyStartYear(endFy);
  let firstStart = endStart - (maxYears - 1);
  if (earliestFy) {
    firstStart = Math.max(firstStart, Math.min(fyStartYear(earliestFy), endStart));
  } else {
    firstStart = endStart;
  }
  const years: string[] = [];
  for (let y = firstStart; y <= endStart; y++) {
    years.push(formatFinancialYear(y));
  }
  return years;
}

export function earliestFinancialYear(candidates: Array<string | null | undefined>): string | null {
  const valid = candidates.filter((fy): fy is string => Boolean(fy));
  if (valid.length === 0) return null;
  return valid.reduce((min, fy) => (fyStartYear(fy) < fyStartYear(min) ? fy : min));
}
