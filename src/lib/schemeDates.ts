const IST = "Asia/Kolkata";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar date (YYYY-MM-DD) in Asia/Kolkata for an instant. */
export function toIstYmd(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}

/** Subtract calendar months from a YYYY-MM-DD, clamping the day to the target month. */
export function subtractCalendarMonthsYmd(ymd: string, months: number): string {
  if (!YMD_RE.test(ymd)) {
    throw new Error(`Invalid date for month subtraction: ${ymd}`);
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(clampedDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Earliest order date MIS may query on admin Sales History (IST today − 3 months). */
export function getMisSalesHistoryEarliestYmd(now: Date = new Date()): string {
  return subtractCalendarMonthsYmd(toIstYmd(now), 3);
}

/** Add (or subtract) calendar days from a YYYY-MM-DD string. */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  if (!YMD_RE.test(ymd)) {
    throw new Error(`Invalid date for day arithmetic: ${ymd}`);
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Start of an IST calendar day. */
export function istDayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000+05:30`);
}

/** End of an IST calendar day (inclusive). */
export function istDayEnd(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

const YMD_FULL_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

/** IST calendar month key (YYYY-MM) from a YYYY-MM-DD date string. */
export function toIstYearMonthFromYmd(ymd: string): string {
  if (!YMD_FULL_RE.test(ymd)) {
    throw new Error(`Invalid date for year-month: ${ymd}`);
  }
  return ymd.slice(0, 7);
}

/** Inclusive IST start/end for a calendar month (from YYYY-MM-DD or YYYY-MM). */
export function istMonthBounds(dateOrYearMonth: string): {
  yearMonth: string;
  monthStart: Date;
  monthEnd: Date;
} {
  const trimmed = dateOrYearMonth.trim();
  let yearMonth: string;
  if (YMD_FULL_RE.test(trimmed)) {
    yearMonth = trimmed.slice(0, 7);
  } else if (YEAR_MONTH_RE.test(trimmed)) {
    yearMonth = trimmed;
  } else {
    throw new Error(`Invalid month key: ${dateOrYearMonth}`);
  }
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, "0");
  return {
    yearMonth,
    monthStart: istDayStart(`${yearMonth}-01`),
    monthEnd: istDayEnd(`${yearMonth}-${lastDayStr}`),
  };
}

/** Short English month label for headers, e.g. "Aug". */
export function istMonthShortLabel(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split("-");
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 1));
  return d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

const YEAR_MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export function isIstYearMonth(value: string): boolean {
  if (!YEAR_MONTH_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Shift an IST YYYY-MM key by `delta` calendar months. */
export function shiftIstYearMonth(yearMonth: string, delta: number): string {
  if (!isIstYearMonth(yearMonth)) {
    throw new Error(`Invalid year-month: ${yearMonth}`);
  }
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** IST calendar day numbers (1..N) for a YYYY-MM key. */
export function istMonthDayNumbers(yearMonth: string): number[] {
  const { monthEnd } = istMonthBounds(yearMonth);
  const lastDay = Number(toIstYmd(monthEnd).slice(8, 10));
  const days: number[] = [];
  for (let d = 1; d <= lastDay; d++) days.push(d);
  return days;
}

/**
 * Resolve the intended calendar day from a date-only string or Date.
 * Date-only strings (YYYY-MM-DD) are treated as that IST calendar day.
 * Legacy UTC-midnight timestamps keep that UTC calendar day (UI date).
 * Other instants use their IST calendar date.
 */
function resolveSchemeYmd(input: string | Date): string {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (YMD_RE.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid scheme date: ${input}`);
    }
    return resolveSchemeYmd(parsed);
  }
  if (Number.isNaN(input.getTime())) {
    throw new Error("Invalid scheme date");
  }
  // Legacy saves: date-only → UTC midnight. Keep that UTC YMD as the UI day.
  const iso = input.toISOString();
  if (/T00:00:00(\.0+)?Z$/.test(iso)) {
    return iso.slice(0, 10);
  }
  return toIstYmd(input);
}

/** Persist scheme start as start of that IST calendar day. */
export function normalizeSchemeStart(input: string | Date): Date {
  return istDayStart(resolveSchemeYmd(input));
}

/** Persist scheme end as end of that IST calendar day. */
export function normalizeSchemeEnd(input: string | Date): Date {
  return istDayEnd(resolveSchemeYmd(input));
}

/**
 * IST calendar-day window for eligibility checks.
 * A scheme overlaps this day when startDate <= endOfDay AND endDate >= startOfDay.
 */
export function schemeActiveOn(referenceDate: Date = new Date()): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const ymd = toIstYmd(referenceDate);
  return {
    startOfDay: istDayStart(ymd),
    endOfDay: istDayEnd(ymd),
  };
}
