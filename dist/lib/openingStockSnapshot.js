"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIstYmd = isIstYmd;
exports.addIstDays = addIstDays;
exports.listRecentIstYmds = listRecentIstYmds;
exports.openingSnapshotDayBounds = openingSnapshotDayBounds;
exports.reconstructOpeningQuantity = reconstructOpeningQuantity;
exports.pickOpeningByProduct = pickOpeningByProduct;
exports.reconcileTodayOpeningClosing = reconcileTodayOpeningClosing;
exports.fetchLiveBatchSumByProduct = fetchLiveBatchSumByProduct;
exports.computeOpeningQuantitiesForIstDay = computeOpeningQuantitiesForIstDay;
exports.replaceOpeningStockSnapshotForIstDay = replaceOpeningStockSnapshotForIstDay;
exports.rebuildRecentOpeningStockSnapshots = rebuildRecentOpeningStockSnapshots;
const prisma_1 = require("./prisma");
const propagateOpeningStockAfterOrderQtyChange_1 = require("./propagateOpeningStockAfterOrderQtyChange");
const schemeDates_1 = require("./schemeDates");
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function isIstYmd(value) {
    return YMD_RE.test(value);
}
function addIstDays(ymd, days) {
    const start = (0, schemeDates_1.istDayStart)(ymd);
    return (0, schemeDates_1.toIstYmd)(new Date(start.getTime() + days * MS_PER_DAY));
}
/** Inclusive IST YMDs from today-(days-1) through today. */
function listRecentIstYmds(todayYmd, days = propagateOpeningStockAfterOrderQtyChange_1.OPENING_STOCK_RECALC_DAYS) {
    const ymds = [];
    for (let i = days - 1; i >= 0; i--) {
        ymds.push(addIstDays(todayYmd, -i));
    }
    return ymds;
}
function openingSnapshotDayBounds(ymd) {
    const dayStart = (0, schemeDates_1.istDayStart)(ymd);
    return {
        dayStart,
        dayEnd: (0, schemeDates_1.istDayEnd)(ymd),
        snapshotDate: dayStart,
    };
}
/**
 * Invert closing = opening + inward - outward using live batch qty
 * and all ledger activity from the target day through now.
 */
function reconstructOpeningQuantity(liveBatchSum, inwardFromDayThroughNow, outwardFromDayThroughNow) {
    return liveBatchSum + outwardFromDayThroughNow - inwardFromDayThroughNow;
}
/**
 * One opening qty per product for an IST day.
 * Prefer the canonical midnight snapshot; otherwise the earliest snapshotDate.
 */
function pickOpeningByProduct(rows, canonicalSnapshotDate) {
    const chosen = new Map();
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
        if (existingIsCanonical && !rowIsCanonical)
            continue;
        if (row.snapshotDate.getTime() < existing.snapshotDate.getTime()) {
            chosen.set(row.productId, row);
        }
    }
    const quantities = new Map();
    for (const [productId, row] of chosen) {
        quantities.set(productId, row.quantity);
    }
    return quantities;
}
function reconcileTodayOpeningClosing(params) {
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
async function fetchLiveBatchSumByProduct() {
    const batches = await prisma_1.prisma.stockBatch.groupBy({
        by: ["productId"],
        _sum: { stockQuantity: true },
    });
    return new Map(batches.map((b) => [b.productId, b._sum.stockQuantity ?? 0]));
}
/**
 * Start-of-day opening for `ymd`, reconstructed from live batches plus
 * inward/outward from that IST day through the end of today.
 */
async function computeOpeningQuantitiesForIstDay(ymd, now = new Date()) {
    const dayStart = (0, schemeDates_1.istDayStart)(ymd);
    const windowEnd = (0, schemeDates_1.istDayEnd)((0, schemeDates_1.toIstYmd)(now));
    const [liveByProduct, allProducts, inwardAgg, outwardAgg] = await Promise.all([
        fetchLiveBatchSumByProduct(),
        prisma_1.prisma.product.findMany({ select: { id: true } }),
        prisma_1.prisma.stockRecord.groupBy({
            by: ["productId"],
            where: {
                changeType: "INCREASE",
                changeDate: { gte: dayStart, lte: windowEnd },
            },
            _sum: { changeInStock: true },
        }),
        prisma_1.prisma.stockRecord.groupBy({
            by: ["productId"],
            where: {
                changeType: "DECREASE",
                changeDate: { gte: dayStart, lte: windowEnd },
            },
            _sum: { changeInStock: true },
        }),
    ]);
    const inwardByProduct = new Map(inwardAgg.map((r) => [r.productId, r._sum.changeInStock ?? 0]));
    const outwardByProduct = new Map(outwardAgg.map((r) => [r.productId, Math.abs(r._sum.changeInStock ?? 0)]));
    const quantities = new Map();
    for (const { id } of allProducts) {
        const live = liveByProduct.get(id) ?? 0;
        const inward = inwardByProduct.get(id) ?? 0;
        const outward = outwardByProduct.get(id) ?? 0;
        quantities.set(id, reconstructOpeningQuantity(live, inward, outward));
    }
    return quantities;
}
async function replaceOpeningStockSnapshotForIstDay(ymd) {
    const { dayStart, dayEnd, snapshotDate } = openingSnapshotDayBounds(ymd);
    const quantities = await computeOpeningQuantitiesForIstDay(ymd);
    const snapshotRows = [...quantities.entries()].map(([productId, quantity]) => ({
        snapshotDate,
        productId,
        quantity,
    }));
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.openingStock.deleteMany({
            where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
        }),
        ...(snapshotRows.length
            ? [prisma_1.prisma.openingStock.createMany({ data: snapshotRows })]
            : []),
    ]);
    return { productCount: snapshotRows.length };
}
async function rebuildRecentOpeningStockSnapshots(today = new Date(), days = propagateOpeningStockAfterOrderQtyChange_1.OPENING_STOCK_RECALC_DAYS) {
    const ymds = listRecentIstYmds((0, schemeDates_1.toIstYmd)(today), days);
    let productCount = 0;
    for (const ymd of ymds) {
        const result = await replaceOpeningStockSnapshotForIstDay(ymd);
        productCount = result.productCount;
    }
    return { dates: ymds, productCount };
}
//# sourceMappingURL=openingStockSnapshot.js.map