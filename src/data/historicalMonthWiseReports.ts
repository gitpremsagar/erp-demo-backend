import { shiftFinancialYear } from "../lib/financialYearWindow";

/** 12 slots per FY, monthIndex 0 = Apr … 11 = Mar; `null` = no historical value (use live data). */
type HistoricalMonths<T> = Array<T | null>;

/** Months before live ERP data was reliable (Apr 2023 – Jun 2026), from the Haldiram yearly compare sheet. */
export const HISTORICAL_FIRST_FY = "2023-24";

export const HISTORICAL_PURCHASE_BY_FY: Record<string, HistoricalMonths<{ target: number; achieved: number }>> = {
  "2023-24": [
    { target: 40000000, achieved: 38179237 }, // Apr-23
    { target: 42100000, achieved: 38896592 }, // May-23
    { target: 41700000, achieved: 41005165 }, // Jun-23
    { target: 43700000, achieved: 43697635 }, // Jul-23
    { target: 47800000, achieved: 47801941 }, // Aug-23
    { target: 48600000, achieved: 49071823 }, // Sep-23
    { target: 50700000, achieved: 50162974 }, // Oct-23
    { target: 39800000, achieved: 39739418 }, // Nov-23
    { target: 54400000, achieved: 54208415 }, // Dec-23
    { target: 41900000, achieved: 40535053 }, // Jan-24
    { target: 48700000, achieved: 47373923 }, // Feb-24
    { target: 42600000, achieved: 41281694 }, // Mar-24
  ],
  "2024-25": [
    { target: 48000000, achieved: 50054435 }, // Apr-24
    { target: 48500000, achieved: 49358459 }, // May-24
    { target: 47800000, achieved: 47545747 }, // Jun-24
    { target: 50700000, achieved: 53743346.32 }, // Jul-24
    { target: 54550000, achieved: 57772534.71 }, // Aug-24
    { target: 58000000, achieved: 60531952.35 }, // Sep-24
    { target: 55500000, achieved: 55823791.95 }, // Oct-24
    { target: 58000000, achieved: 46914718 }, // Nov-24
    { target: 59900000, achieved: 55752420.71 }, // Dec-24
    { target: 55700000, achieved: 58833909.79 }, // Jan-25
    { target: 56000000, achieved: 59390529.63 }, // Feb-25
    { target: 63600000, achieved: 64773981.57 }, // Mar-25
  ],
  "2025-26": [
    { target: 57300000, achieved: 51657172.55 }, // Apr-25
    { target: 61700000, achieved: 62440198.23 }, // May-25
    { target: 63500000, achieved: 57012559 }, // Jun-25
    { target: 64300000, achieved: 64670090 }, // Jul-25
    { target: 68500000, achieved: 68650596 }, // Aug-25
    { target: 69900000, achieved: 69765482.01 }, // Sep-25
    { target: 69800000, achieved: 55021557.39 }, // Oct-25
    { target: 58200000, achieved: 75592650 }, // Nov-25
    { target: 69000000, achieved: 71939224 }, // Dec-25
    { target: 63400000, achieved: 63871764.88 }, // Jan-26
    { target: 65000000, achieved: 45903959.65 }, // Feb-26
    { target: 70000000, achieved: 50139676.91 }, // Mar-26
  ],
  "2026-27": [
    { target: 70700000, achieved: 63921462 }, // Apr-26
    { target: 69600000, achieved: 54443235 }, // May-26
    { target: 64100000, achieved: 64781089 }, // Jun-26
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
};

export const HISTORICAL_SALES_BY_FY: Record<string, HistoricalMonths<{ tally: number; dms: number }>> = {
  "2023-24": [
    { tally: 39244085, dms: 39734934.41 }, // Apr-23
    { tally: 43034842, dms: 42232716.73 }, // May-23
    { tally: 44202009, dms: 44453077.3 }, // Jun-23
    { tally: 48028777, dms: 48332789.49 }, // Jul-23
    { tally: 48924127, dms: 47287492.78 }, // Aug-23
    { tally: 51250303, dms: 50911300.31 }, // Sep-23
    { tally: 46591769, dms: 49700959.15 }, // Oct-23
    { tally: 54020404, dms: 58265691.5 }, // Nov-23
    { tally: 48306164, dms: 49261612.81 }, // Dec-23
    { tally: 46539179, dms: 48334872.84 }, // Jan-24
    { tally: 50042884, dms: 45146876.4 }, // Feb-24
    { tally: 46504560, dms: 46080466.33 }, // Mar-24
  ],
  "2024-25": [
    { tally: 47083860, dms: 48276197.52 }, // Apr-24
    { tally: 51476497, dms: 51225022.82 }, // May-24
    { tally: 51359855, dms: 50599732.31 }, // Jun-24
    { tally: 56441922, dms: 51791899.31 }, // Jul-24
    { tally: 56585205, dms: 56218493.17 }, // Aug-24
    { tally: 55088735, dms: 57479836.6 }, // Sep-24
    { tally: 58151234, dms: 57528117.57 }, // Oct-24
    { tally: 59241463, dms: 55751171.22 }, // Nov-24
    { tally: 52847146, dms: 61267691.08 }, // Dec-24
    { tally: 58994682, dms: 56153999 }, // Jan-25
    { tally: 61094565, dms: 61307676.59 }, // Feb-25
    { tally: 57495569, dms: 58621704.68 }, // Mar-25
  ],
  "2025-26": [
    { tally: 59769462.06, dms: 59658972.76 }, // Apr-25
    { tally: 65209754, dms: 62538501.95 }, // May-25
    { tally: 56026442, dms: 60117075.4 }, // Jun-25
    { tally: 69043284, dms: 66566029.55 }, // Jul-25
    { tally: 70388106, dms: 75181335 }, // Aug-25
    { tally: 67588810, dms: 66321990.81 }, // Sep-25
    { tally: 69297108, dms: 62039100.03 }, // Oct-25
    { tally: 67642298, dms: 69537651.02 }, // Nov-25
    { tally: 73727336, dms: 74619530.64 }, // Dec-25
    { tally: 60281768, dms: 59708218.25 }, // Jan-26
    { tally: 53780383, dms: 57107465.4 }, // Feb-26
    { tally: 56707343, dms: 58665856.01 }, // Mar-26
  ],
  "2026-27": [
    { tally: 68974851, dms: 68769629.67 }, // Apr-26
    { tally: 62840870, dms: 64605180.96 }, // May-26
    { tally: 65600917, dms: 64624910.07 }, // Jun-26
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
};

export function historicalMonthValues<T, K extends keyof T>(
  map: Record<string, HistoricalMonths<T>>,
  financialYear: string,
  field: K
): Array<T[K] | null> {
  const months = map[financialYear];
  return Array.from({ length: 12 }, (_, i) => {
    const entry = months?.[i];
    return entry ? entry[field] : null;
  });
}

/** March of the previous FY, used for the April "compare from previous month". */
export function historicalPriorMarch<T, K extends keyof T>(
  map: Record<string, HistoricalMonths<T>>,
  financialYear: string,
  field: K
): T[K] | null {
  const entry = map[shiftFinancialYear(financialYear, -1)]?.[11];
  return entry ? entry[field] : null;
}
