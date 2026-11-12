import { Prisma } from "@prisma/client";
import {
  computeOrderGrossSaleForReport,
  formatMonthLabel,
  ReportOrderRow,
  resolveSafeTimeZone,
  zonedDateTimeToUtcDate,
} from "./orderSaleAmount";
import { resolveDbCategory, resolveOrderItemSnapshotRates } from "./orderItemPriceSnapshot";

const PRODUCT_PRICE_SELECT = {
  sellingPricePerCartonForDb: true,
  sellingPricePerCartonForRss: true,
  costPricePerCarton: true,
} satisfies Prisma.ProductSelect;

const RETURN_ORDER_ITEM_SELECT = {
  productId: true,
  quantity: true,
  pricingTier: true,
  gstPercentage: true,
  packetsPerCarton: true,
  costPricePerCarton: true,
  costPricePerPacket: true,
  sellingPricePerCartonForDb: true,
  sellingPricePerPacketForDb: true,
  sellingPricePerCartonForRss: true,
  sellingPricePerPacketForRss: true,
  Product: { select: PRODUCT_PRICE_SELECT },
} satisfies Prisma.OrderItemSelect;

export const RETURN_CREDIT_ORDER_SELECT = {
  Customer: {
    select: {
      CustomerDetail: {
        select: { dbCategory: true },
        take: 1,
      },
    },
  },
  OrderItem: { select: RETURN_ORDER_ITEM_SELECT },
} satisfies Prisma.OrderSelect;

type ReturnOrderRow = Prisma.OrderGetPayload<{ select: typeof RETURN_CREDIT_ORDER_SELECT }>;
type ReturnOrderItemRow = Prisma.OrderItemGetPayload<{ select: typeof RETURN_ORDER_ITEM_SELECT }>;

type ProductPriceRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_PRICE_SELECT }>;

const FY_MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

export type FyMonthBucket = {
  monthIndex: number;
  monthName: string;
  calendarYear: number;
  calendarMonth: number;
  monthLabel: string;
  start: Date;
  end: Date;
};

export function getPriorFinancialYear(fy: string): string {
  const startYear = parseInt(fy.split("-")[0], 10);
  return `${startYear - 1}-${String(startYear).slice(2)}`;
}

export function buildFyMonthBuckets(financialYear: string, timeZone: string): FyMonthBucket[] {
  const fyStartYear = parseInt(financialYear.split("-")[0], 10);
  return FY_MONTH_NAMES.map((name, monthIndex) => {
    const calendarMonth = ((3 + monthIndex) % 12) + 1;
    const calendarYear = calendarMonth >= 4 ? fyStartYear : fyStartYear + 1;
    const start = zonedDateTimeToUtcDate(timeZone, calendarYear, calendarMonth - 1, 1, 0, 0, 0, 0);
    const end = zonedDateTimeToUtcDate(
      timeZone,
      calendarMonth === 12 ? calendarYear + 1 : calendarYear,
      calendarMonth === 12 ? 0 : calendarMonth,
      1,
      0,
      0,
      0,
      0
    );
    return {
      monthIndex,
      monthName: name,
      calendarYear,
      calendarMonth,
      monthLabel: formatMonthLabel(calendarYear, calendarMonth),
      start,
      end,
    };
  });
}

export function getMarchPriorFyBucket(financialYear: string, timeZone: string): FyMonthBucket {
  const priorFy = getPriorFinancialYear(financialYear);
  const buckets = buildFyMonthBuckets(priorFy, timeZone);
  return buckets[11];
}

function getProductCartonRateExGst(product: ProductPriceRow, dbCategory: string): number {
  if (dbCategory === "RSS") return product.sellingPricePerCartonForRss ?? 0;
  if (dbCategory === "SS") return product.costPricePerCarton ?? 0;
  return product.sellingPricePerCartonForDb ?? 0;
}

/** Gross amount for a returned/credited line using order-item snapshot ex-GST rates. */
export function computeReturnLineGrossAmount(
  order: ReturnOrderRow,
  productId: string,
  qty: number
): number {
  const orderItem = order.OrderItem.find((oi) => oi.productId === productId);
  if (!orderItem || qty <= 0) return 0;

  const dbCategory = resolveDbCategory(order.Customer ?? null);
  const resolved = resolveOrderItemSnapshotRates(orderItem);

  if (resolved && resolved.carton > 0) {
    return qty * resolved.carton;
  }

  const product = orderItem.Product;
  if (product) {
    const rate = getProductCartonRateExGst(product, dbCategory);
    if (rate > 0) return qty * rate;
  }

  return 0;
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date < end;
}

function findMonthIndexForDate(
  date: Date,
  buckets: FyMonthBucket[],
  extraBucket?: FyMonthBucket
): number | null {
  const allBuckets = extraBucket ? [...buckets, extraBucket] : buckets;
  for (const bucket of allBuckets) {
    if (isDateInRange(date, bucket.start, bucket.end)) {
      return bucket.monthIndex;
    }
  }
  return null;
}

export type MonthWiseSalesReportComputedRow = {
  monthIndex: number;
  monthLabel: string;
  tallyAchieved: number;
  achievePercent: number | null;
  qWiseTarget: number;
  qWiseAchieved: number;
  quarterAchievePercent: number | null;
  compareFromPreviousMonth: number | null;
};

/** Per-month values that replace the live amount when non-null (`priorMarch` feeds April's compare). */
export type MonthlyAmountOverrides = {
  months: Array<number | null>;
  priorMarch: number | null;
};

export function computeMonthWiseSalesReportRows(
  financialYear: string,
  orders: ReportOrderRow[],
  salesReturns: Array<{
    returnDate: Date;
    SalesReturnItem: Array<{ productId: string; quantity: number }>;
    order: ReturnOrderRow;
  }>,
  creditNotes: Array<{
    noteDate: Date;
    CreditNoteItem: Array<{ productId: string; quantity: number }>;
    order: ReturnOrderRow;
  }>,
  manualTargets: Array<number | null> = Array(12).fill(null),
  timeZone?: string,
  tallyOverrides?: MonthlyAmountOverrides
): MonthWiseSalesReportComputedRow[] {
  const tz = resolveSafeTimeZone(timeZone);
  const buckets = buildFyMonthBuckets(financialYear, tz);
  const priorMarch = getMarchPriorFyBucket(financialYear, tz);

  const salesByMonth = new Array<number>(12).fill(0);
  const returnsByMonth = new Array<number>(12).fill(0);

  for (const order of orders) {
    const d = new Date(order.orderDate);
    const idx = findMonthIndexForDate(d, buckets);
    if (idx !== null) {
      salesByMonth[idx] += computeOrderGrossSaleForReport(order);
    }
  }

  for (const sr of salesReturns) {
    const d = new Date(sr.returnDate);
    const idx = findMonthIndexForDate(d, buckets);
    if (idx === null) continue;
    for (const item of sr.SalesReturnItem) {
      returnsByMonth[idx] += computeReturnLineGrossAmount(sr.order, item.productId, item.quantity);
    }
  }

  for (const cn of creditNotes) {
    const d = new Date(cn.noteDate);
    const idx = findMonthIndexForDate(d, buckets);
    if (idx === null) continue;
    for (const item of cn.CreditNoteItem) {
      returnsByMonth[idx] += computeReturnLineGrossAmount(cn.order, item.productId, item.quantity);
    }
  }

  const priorMarchTally = tallyOverrides?.priorMarch ?? (() => {
    let sales = 0;
    let deductions = 0;
    for (const order of orders) {
      const d = new Date(order.orderDate);
      if (isDateInRange(d, priorMarch.start, priorMarch.end)) {
        sales += computeOrderGrossSaleForReport(order);
      }
    }
    for (const sr of salesReturns) {
      const d = new Date(sr.returnDate);
      if (!isDateInRange(d, priorMarch.start, priorMarch.end)) continue;
      for (const item of sr.SalesReturnItem) {
        deductions += computeReturnLineGrossAmount(sr.order, item.productId, item.quantity);
      }
    }
    for (const cn of creditNotes) {
      const d = new Date(cn.noteDate);
      if (!isDateInRange(d, priorMarch.start, priorMarch.end)) continue;
      for (const item of cn.CreditNoteItem) {
        deductions += computeReturnLineGrossAmount(cn.order, item.productId, item.quantity);
      }
    }
    return sales - deductions;
  })();

  const tallyValues: number[] = [];
  for (let i = 0; i < 12; i++) {
    tallyValues.push(tallyOverrides?.months[i] ?? salesByMonth[i] - returnsByMonth[i]);
  }

  const quarterTarget = [0, 0, 0, 0];
  const quarterAchieved = [0, 0, 0, 0];
  for (let q = 0; q < 4; q++) {
    const start = q * 3;
    for (let j = start; j < start + 3; j++) {
      quarterTarget[q] += manualTargets[j] ?? 0;
      quarterAchieved[q] += tallyValues[j];
    }
  }

  return buckets.map((bucket, i) => {
    const tallyAchieved = tallyValues[i];
    const previousTally = i === 0 ? priorMarchTally : tallyValues[i - 1];
    const compareFromPreviousMonth =
      previousTally === 0 ? null : ((tallyAchieved - previousTally) / previousTally) * 100;

    const target = manualTargets[i] ?? null;
    const achievePercent =
      target !== null && target > 0 ? (tallyAchieved / target) * 100 : null;

    const quarterIndex = Math.floor(i / 3);
    const qWiseTarget = quarterTarget[quarterIndex];
    const qWiseAchieved = quarterAchieved[quarterIndex];
    const quarterAchievePercent =
      qWiseTarget > 0 ? (qWiseAchieved / qWiseTarget) * 100 : null;

    return {
      monthIndex: bucket.monthIndex,
      monthLabel: bucket.monthLabel,
      tallyAchieved,
      achievePercent,
      qWiseTarget,
      qWiseAchieved,
      quarterAchievePercent,
      compareFromPreviousMonth,
    };
  });
}
