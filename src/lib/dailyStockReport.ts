import { prisma } from "./prisma";
import { istDayEnd, istDayStart, toIstYmd } from "./schemeDates";
import {
  fetchLiveBatchSumByProduct,
  pickOpeningByProduct,
  reconcileTodayOpeningClosing,
} from "./openingStockSnapshot";
import {
  EMPTY_DAILY_STOCK_STATUS_FIELDS,
  fetchDailyStockStatusByProduct,
  type DailyStockStatusFields,
} from "./dailyStockStatus";

export type DailyStockReportRow = {
  productId: string;
  productName: string;
  productCode: string;
  mrp: number | null;
  cartonsPerPallet: number | null;
  openingStock: number;
  inwardQuantity: number;
  outwardQuantity: number;
  closingStock: number;
  onPassageQuantity: number;
} & DailyStockStatusFields;

/** Sum planned purchase qty per product for active purchases not yet added to stock. */
export async function fetchOnPassageQuantityByProduct(): Promise<
  Map<string, number>
> {
  const agg = await prisma.purchaseStockBatch.groupBy({
    by: ["productId"],
    where: {
      Purchase: {
        purchaseTransportStatus: { not: "COMPLETED" },
        stockBatches: { none: {} },
      },
    },
    _sum: { stockQuantity: true },
  });
  return new Map(agg.map((r) => [r.productId, r._sum.stockQuantity ?? 0]));
}

/**
 * Same rows as GET /api/opening-stock/report — shared by stock-status and
 * the purchase-forecast workbook.
 */
export async function buildDailyStockReportRows(
  dateStr: string
): Promise<{
  date: string;
  dayStart: Date;
  dayEnd: Date;
  rows: DailyStockReportRow[];
}> {
  const dayStart = istDayStart(dateStr);
  const dayEnd = istDayEnd(dateStr);
  const isToday = dateStr === toIstYmd(new Date());

  const [
    products,
    openingRows,
    inwardAgg,
    outwardAgg,
    onPassageByProduct,
    liveByProduct,
    dailyByProduct,
  ] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        productCode: true,
        mrp: true,
        cartonsPerPallet: true,
      },
      orderBy: { productCode: "asc" },
    }),
    prisma.openingStock.findMany({
      where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
      select: {
        productId: true,
        quantity: true,
        snapshotDate: true,
      },
    }),
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        changeType: "INCREASE",
        changeDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { changeInStock: true },
    }),
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        changeType: "DECREASE",
        changeDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { changeInStock: true },
    }),
    fetchOnPassageQuantityByProduct(),
    isToday ? fetchLiveBatchSumByProduct() : Promise.resolve(null),
    fetchDailyStockStatusByProduct(dateStr),
  ]);

  const openingByProduct = pickOpeningByProduct(openingRows, dayStart);
  const inwardByProduct = new Map(
    inwardAgg.map((r) => [r.productId, r._sum.changeInStock ?? 0])
  );
  const outwardByProduct = new Map(
    outwardAgg.map((r) => [r.productId, Math.abs(r._sum.changeInStock ?? 0)])
  );

  const rows: DailyStockReportRow[] = products.map((p) => {
    const inward = inwardByProduct.get(p.id) ?? 0;
    const outward = outwardByProduct.get(p.id) ?? 0;
    let opening = openingByProduct.get(p.id) ?? 0;
    let closing = opening + inward - outward;
    if (liveByProduct) {
      const reconciled = reconcileTodayOpeningClosing({
        opening,
        inward,
        outward,
        liveBatchSum: liveByProduct.get(p.id) ?? 0,
      });
      opening = reconciled.opening;
      closing = reconciled.closing;
    }
    const current =
      dailyByProduct.get(p.id) ?? { ...EMPTY_DAILY_STOCK_STATUS_FIELDS };
    return {
      productId: p.id,
      productName: p.name,
      productCode: p.productCode,
      mrp: p.mrp,
      cartonsPerPallet: p.cartonsPerPallet,
      openingStock: opening,
      inwardQuantity: inward,
      outwardQuantity: outward,
      closingStock: closing,
      onPassageQuantity: onPassageByProduct.get(p.id) ?? 0,
      ...current,
    };
  });

  return { date: dateStr, dayStart, dayEnd, rows };
}

export function actualStockFromDailyRow(row: {
  closingStock: number;
  dip: number | null;
  onPassageQuantity: number;
}): number {
  return row.closingStock + (row.dip ?? 0) + row.onPassageQuantity;
}
