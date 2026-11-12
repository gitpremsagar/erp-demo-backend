import { prisma } from "./prisma";
import { OPENING_STOCK_RECALC_DAYS } from "./propagateOpeningStockAfterOrderQtyChange";
import { istDayEnd, istDayStart, toIstYmd } from "./schemeDates";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isIstYmd(value: string): boolean {
  return YMD_RE.test(value);
}

export function addIstDays(ymd: string, days: number): string {
  const start = istDayStart(ymd);
  return toIstYmd(new Date(start.getTime() + days * MS_PER_DAY));
}

/** Inclusive IST YMDs from today-(days-1) through today. */
export function listRecentIstYmds(
  todayYmd: string,
  days: number = OPENING_STOCK_RECALC_DAYS
): string[] {
  const ymds: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    ymds.push(addIstDays(todayYmd, -i));
  }
  return ymds;
}

export function openingSnapshotDayBounds(ymd: string): {
  dayStart: Date;
  dayEnd: Date;
  snapshotDate: Date;
} {
  const dayStart = istDayStart(ymd);
  return {
    dayStart,
    dayEnd: istDayEnd(ymd),
    snapshotDate: dayStart,
  };
}

/**
 * Invert closing = opening + inward - outward using live batch qty
 * and all ledger activity from the target day through now.
 */
export function reconstructOpeningQuantity(
  liveBatchSum: number,
  inwardFromDayThroughNow: number,
  outwardFromDayThroughNow: number
): number {
  return liveBatchSum + outwardFromDayThroughNow - inwardFromDayThroughNow;
}

export type OpeningStockRowPick = {
  productId: string;
  quantity: number;
  snapshotDate: Date;
};

/**
 * One opening qty per product for an IST day.
 * Prefer the canonical midnight snapshot; otherwise the earliest snapshotDate.
 */
export function pickOpeningByProduct(
  rows: OpeningStockRowPick[],
  canonicalSnapshotDate: Date
): Map<string, number> {
  const chosen = new Map<string, OpeningStockRowPick>();
  const canonicalMs = canonicalSnapshotDate.getTime();

  for (const row of rows) {
    const existing = chosen.get(row.productId);
    if (!existing) {
      chosen.set(row.productId, row);
      continue;
    }

    const rowIsCanonical = row.snapshotDate.getTime() === canonicalMs;
    const existingIsCanonical = existing.snapshotDate.getTime() === canonicalMs;
    if (rowIsCanonical && !existingIsCanonical) {
      chosen.set(row.productId, row);
      continue;
    }
    if (existingIsCanonical && !rowIsCanonical) continue;
    if (row.snapshotDate.getTime() < existing.snapshotDate.getTime()) {
      chosen.set(row.productId, row);
    }
  }

  const quantities = new Map<string, number>();
  for (const [productId, row] of chosen) {
    quantities.set(productId, row.quantity);
  }
  return quantities;
}

export function reconcileTodayOpeningClosing(params: {
  opening: number;
  inward: number;
  outward: number;
  liveBatchSum: number;
}): { opening: number; closing: number } {
  const { opening, inward, outward, liveBatchSum } = params;
  const reconstructedClosing = opening + inward - outward;
  if (reconstructedClosing === liveBatchSum) {
    return { opening, closing: reconstructedClosing };
  }
  return {
    opening: reconstructOpeningQuantity(liveBatchSum, inward, outward),
    closing: liveBatchSum,
  };
}

export async function fetchLiveBatchSumByProduct(): Promise<Map<string, number>> {
  const batches = await prisma.stockBatch.groupBy({
    by: ["productId"],
    _sum: { stockQuantity: true },
  });
  return new Map(batches.map((b) => [b.productId, b._sum.stockQuantity ?? 0]));
}

/**
 * Start-of-day opening for `ymd`, reconstructed from live batches plus
 * inward/outward from that IST day through the end of today.
 */
export async function computeOpeningQuantitiesForIstDay(
  ymd: string,
  now: Date = new Date()
): Promise<Map<string, number>> {
  const dayStart = istDayStart(ymd);
  const windowEnd = istDayEnd(toIstYmd(now));

  const [liveByProduct, allProducts, inwardAgg, outwardAgg] = await Promise.all([
    fetchLiveBatchSumByProduct(),
    prisma.product.findMany({ select: { id: true } }),
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        changeType: "INCREASE",
        changeDate: { gte: dayStart, lte: windowEnd },
      },
      _sum: { changeInStock: true },
    }),
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        changeType: "DECREASE",
        changeDate: { gte: dayStart, lte: windowEnd },
      },
      _sum: { changeInStock: true },
    }),
  ]);

  const inwardByProduct = new Map(
    inwardAgg.map((r) => [r.productId, r._sum.changeInStock ?? 0])
  );
  const outwardByProduct = new Map(
    outwardAgg.map((r) => [r.productId, Math.abs(r._sum.changeInStock ?? 0)])
  );

  const quantities = new Map<string, number>();
  for (const { id } of allProducts) {
    const live = liveByProduct.get(id) ?? 0;
    const inward = inwardByProduct.get(id) ?? 0;
    const outward = outwardByProduct.get(id) ?? 0;
    quantities.set(id, reconstructOpeningQuantity(live, inward, outward));
  }
  return quantities;
}

export async function replaceOpeningStockSnapshotForIstDay(
  ymd: string
): Promise<{ productCount: number }> {
  const { dayStart, dayEnd, snapshotDate } = openingSnapshotDayBounds(ymd);
  const quantities = await computeOpeningQuantitiesForIstDay(ymd);
  const snapshotRows = [...quantities.entries()].map(([productId, quantity]) => ({
    snapshotDate,
    productId,
    quantity,
  }));

  await prisma.$transaction([
    prisma.openingStock.deleteMany({
      where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
    }),
    ...(snapshotRows.length
      ? [prisma.openingStock.createMany({ data: snapshotRows })]
      : []),
  ]);

  return { productCount: snapshotRows.length };
}

export async function rebuildRecentOpeningStockSnapshots(
  today: Date = new Date(),
  days: number = OPENING_STOCK_RECALC_DAYS
): Promise<{ dates: string[]; productCount: number }> {
  const ymds = listRecentIstYmds(toIstYmd(today), days);
  let productCount = 0;
  for (const ymd of ymds) {
    const result = await replaceOpeningStockSnapshotForIstDay(ymd);
    productCount = result.productCount;
  }
  return { dates: ymds, productCount };
}
