import type { Prisma } from "@prisma/client";
import { ORDER_ITEM_EDIT_LOCK_DAYS } from "./orderItemEditLock";
import { prisma } from "./prisma";
import { istDayEnd, istDayStart, toIstYmd } from "./schemeDates";

/** One more than the order-item edit lock so openings stay correct at the lock edge. */
export const OPENING_STOCK_RECALC_DAYS = ORDER_ITEM_EDIT_LOCK_DAYS + 1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ProductQtyDelta = {
  productId: string;
  /** newQty − oldQty (delete: −oldQty). */
  deltaQty: number;
};

export type StockLedgerDb = Prisma.TransactionClient | typeof prisma;

function addIstDays(ymd: string, days: number): string {
  const start = istDayStart(ymd);
  return toIstYmd(new Date(start.getTime() + days * MS_PER_DAY));
}

/**
 * IST calendar YMDs whose OpeningStock should be adjusted after an order qty change.
 * From the day after `orderDate` through `today`, capped to the last `maxDays` IST days.
 */
export function listPropagationYmds(
  orderDate: Date,
  today: Date = new Date(),
  maxDays: number = OPENING_STOCK_RECALC_DAYS
): string[] {
  const todayYmd = toIstYmd(today);
  const windowStartYmd = addIstDays(todayYmd, -(maxDays - 1));
  const dayAfterOrderYmd = addIstDays(toIstYmd(orderDate), 1);

  const propagateFromYmd =
    dayAfterOrderYmd > windowStartYmd ? dayAfterOrderYmd : windowStartYmd;

  if (propagateFromYmd > todayYmd) {
    return [];
  }

  const ymds: string[] = [];
  for (let ymd = propagateFromYmd; ymd <= todayYmd; ymd = addIstDays(ymd, 1)) {
    ymds.push(ymd);
  }
  return ymds;
}

/**
 * Apply −Δqty to OpeningStock.quantity for each affected product on every day
 * from day-after(orderDate) through today (max last OPENING_STOCK_RECALC_DAYS IST days).
 * Skips missing rows; clamps quantity below 0 to 0.
 */
export async function propagateOpeningStockAfterOrderQtyChange(params: {
  productDeltas: ProductQtyDelta[];
  orderDate: Date;
  db?: StockLedgerDb;
  today?: Date;
}): Promise<void> {
  const { productDeltas, orderDate, today = new Date() } = params;
  const db = params.db ?? prisma;

  const nonzero = productDeltas.filter((d) => d.deltaQty !== 0);
  if (nonzero.length === 0) return;

  const ymds = listPropagationYmds(orderDate, today);
  if (ymds.length === 0) return;

  for (const ymd of ymds) {
    const dayStart = istDayStart(ymd);
    const dayEnd = istDayEnd(ymd);

    for (const { productId, deltaQty } of nonzero) {
      const openingAdjust = -deltaQty;
      const updated = await db.openingStock.updateMany({
        where: {
          productId,
          snapshotDate: { gte: dayStart, lte: dayEnd },
        },
        data: { quantity: { increment: openingAdjust } },
      });

      if (updated.count === 0) continue;

      const negativeRows = await db.openingStock.findMany({
        where: {
          productId,
          snapshotDate: { gte: dayStart, lte: dayEnd },
          quantity: { lt: 0 },
        },
        select: { id: true, quantity: true },
      });

      for (const row of negativeRows) {
        console.warn(
          `[propagateOpeningStock] clamping negative opening stock product=${productId} date=${ymd} qty=${row.quantity} → 0`
        );
        await db.openingStock.update({
          where: { id: row.id },
          data: { quantity: 0 },
        });
      }
    }
  }
}

/** Build product deltas from existing vs incoming line quantities (missing = 0). */
export function buildOrderItemQtyDeltas(
  incoming: { productId: string; quantity: number }[],
  existingItems: { productId: string; quantity: number }[]
): ProductQtyDelta[] {
  const existingQty = new Map(existingItems.map((i) => [i.productId, i.quantity]));
  const seen = new Set<string>();
  const deltas: ProductQtyDelta[] = [];

  for (const item of incoming) {
    seen.add(item.productId);
    const oldQty = existingQty.get(item.productId) ?? 0;
    const deltaQty = item.quantity - oldQty;
    if (deltaQty !== 0) {
      deltas.push({ productId: item.productId, deltaQty });
    }
  }

  for (const [productId, oldQty] of existingQty) {
    if (seen.has(productId)) continue;
    if (oldQty !== 0) {
      deltas.push({ productId, deltaQty: -oldQty });
    }
  }

  return deltas;
}
