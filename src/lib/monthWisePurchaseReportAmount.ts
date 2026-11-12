import {
  buildFyMonthBuckets,
  getMarchPriorFyBucket,
  type MonthlyAmountOverrides,
} from "./monthWiseSalesReportAmount";

type PurchaseInvoiceRow = {
  invoiceAmount: number | null;
  invoiceDate: Date | null;
};

export type MonthWisePurchaseReportComputedRow = {
  monthIndex: number;
  monthLabel: string;
  achieved: number;
  qWiseTarget: number;
  qWiseAchieved: number;
  achievePercent: number | null;
  quarterAchievePercent: number | null;
  compareFromPreviousMonth: number | null;
};
function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

function sumAchievedInRange(
  invoices: PurchaseInvoiceRow[],
  start: Date,
  end: Date
): number {
  return invoices
    .filter((inv) => {
      if (!inv.invoiceDate) return false;
      const d = new Date(inv.invoiceDate);
      return isDateInRange(d, start, end);
    })
    .reduce((sum, inv) => sum + (inv.invoiceAmount ?? 0), 0);
}

export function computeMonthWisePurchaseReportRows(
  financialYear: string,
  invoices: PurchaseInvoiceRow[],
  manualTargets: Array<number | null>,
  timeZone: string,
  achievedOverrides?: MonthlyAmountOverrides
): MonthWisePurchaseReportComputedRow[] {
  const buckets = buildFyMonthBuckets(financialYear, timeZone);
  const priorMarch = getMarchPriorFyBucket(financialYear, timeZone);

  const achievedByMonth = buckets.map(
    (bucket, i) =>
      achievedOverrides?.months[i] ?? sumAchievedInRange(invoices, bucket.start, bucket.end)
  );

  const priorMarchAchieved =
    achievedOverrides?.priorMarch ??
    sumAchievedInRange(invoices, priorMarch.start, priorMarch.end);

  const quarterTarget = [0, 0, 0, 0];
  const quarterAchieved = [0, 0, 0, 0];
  for (let q = 0; q < 4; q++) {
    const start = q * 3;
    for (let j = start; j < start + 3; j++) {
      quarterTarget[q] += manualTargets[j] ?? 0;
      quarterAchieved[q] += achievedByMonth[j];
    }
  }

  return buckets.map((bucket, monthIndex) => {
    const achieved = achievedByMonth[monthIndex];
    const target = manualTargets[monthIndex] ?? null;
    const quarterIndex = Math.floor(monthIndex / 3);

    const qWiseTarget = quarterTarget[quarterIndex];
    const qWiseAchieved = quarterAchieved[quarterIndex];

    const achievePercent =
      target !== null && target > 0 ? (achieved / target) * 100 : null;
    const quarterAchievePercent =
      qWiseTarget > 0 ? (qWiseAchieved / qWiseTarget) * 100 : null;

    const previousAchieved = monthIndex === 0 ? priorMarchAchieved : achievedByMonth[monthIndex - 1];
    const compareFromPreviousMonth =
      previousAchieved === 0 ? null : ((achieved - previousAchieved) / previousAchieved) * 100;

    return {
      monthIndex: bucket.monthIndex,
      monthLabel: bucket.monthLabel,
      achieved,
      qWiseTarget,
      qWiseAchieved,
      achievePercent,
      quarterAchievePercent,
      compareFromPreviousMonth,
    };
  });
}
