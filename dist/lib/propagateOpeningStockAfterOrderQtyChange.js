"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENING_STOCK_RECALC_DAYS = void 0;
exports.listPropagationYmds = listPropagationYmds;
exports.propagateOpeningStockAfterOrderQtyChange = propagateOpeningStockAfterOrderQtyChange;
exports.buildOrderItemQtyDeltas = buildOrderItemQtyDeltas;
const orderItemEditLock_1 = require("./orderItemEditLock");
const prisma_1 = require("./prisma");
const schemeDates_1 = require("./schemeDates");
/** One more than the order-item edit lock so openings stay correct at the lock edge. */
exports.OPENING_STOCK_RECALC_DAYS = orderItemEditLock_1.ORDER_ITEM_EDIT_LOCK_DAYS + 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function addIstDays(ymd, days) {
    const start = (0, schemeDates_1.istDayStart)(ymd);
    return (0, schemeDates_1.toIstYmd)(new Date(start.getTime() + days * MS_PER_DAY));
}
/**
 * IST calendar YMDs whose OpeningStock should be adjusted after an order qty change.
 * From the day after `orderDate` through `today`, capped to the last `maxDays` IST days.
 */
function listPropagationYmds(orderDate, today = new Date(), maxDays = exports.OPENING_STOCK_RECALC_DAYS) {
    const todayYmd = (0, schemeDates_1.toIstYmd)(today);
    const windowStartYmd = addIstDays(todayYmd, -(maxDays - 1));
    const dayAfterOrderYmd = addIstDays((0, schemeDates_1.toIstYmd)(orderDate), 1);
    const propagateFromYmd = dayAfterOrderYmd > windowStartYmd ? dayAfterOrderYmd : windowStartYmd;
    if (propagateFromYmd > todayYmd) {
        return [];
    }
    const ymds = [];
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
async function propagateOpeningStockAfterOrderQtyChange(params) {
    const { productDeltas, orderDate, today = new Date() } = params;
    const db = params.db ?? prisma_1.prisma;
    const nonzero = productDeltas.filter((d) => d.deltaQty !== 0);
    if (nonzero.length === 0)
        return;
    const ymds = listPropagationYmds(orderDate, today);
    if (ymds.length === 0)
        return;
    for (const ymd of ymds) {
        const dayStart = (0, schemeDates_1.istDayStart)(ymd);
        const dayEnd = (0, schemeDates_1.istDayEnd)(ymd);
        for (const { productId, deltaQty } of nonzero) {
            const openingAdjust = -deltaQty;
            const updated = await db.openingStock.updateMany({
                where: {
                    productId,
                    snapshotDate: { gte: dayStart, lte: dayEnd },
                },
                data: { quantity: { increment: openingAdjust } },
            });
            if (updated.count === 0)
                continue;
            const negativeRows = await db.openingStock.findMany({
                where: {
                    productId,
                    snapshotDate: { gte: dayStart, lte: dayEnd },
                    quantity: { lt: 0 },
                },
                select: { id: true, quantity: true },
            });
            for (const row of negativeRows) {
                console.warn(`[propagateOpeningStock] clamping negative opening stock product=${productId} date=${ymd} qty=${row.quantity} → 0`);
                await db.openingStock.update({
                    where: { id: row.id },
                    data: { quantity: 0 },
                });
            }
        }
    }
}
/** Build product deltas from existing vs incoming line quantities (missing = 0). */
function buildOrderItemQtyDeltas(incoming, existingItems) {
    const existingQty = new Map(existingItems.map((i) => [i.productId, i.quantity]));
    const seen = new Set();
    const deltas = [];
    for (const item of incoming) {
        seen.add(item.productId);
        const oldQty = existingQty.get(item.productId) ?? 0;
        const deltaQty = item.quantity - oldQty;
        if (deltaQty !== 0) {
            deltas.push({ productId: item.productId, deltaQty });
        }
    }
    for (const [productId, oldQty] of existingQty) {
        if (seen.has(productId))
            continue;
        if (oldQty !== 0) {
            deltas.push({ productId, deltaQty: -oldQty });
        }
    }
    return deltas;
}
//# sourceMappingURL=propagateOpeningStockAfterOrderQtyChange.js.map