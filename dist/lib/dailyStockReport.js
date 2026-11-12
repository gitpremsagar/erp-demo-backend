"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOnPassageQuantityByProduct = fetchOnPassageQuantityByProduct;
exports.buildDailyStockReportRows = buildDailyStockReportRows;
exports.actualStockFromDailyRow = actualStockFromDailyRow;
const prisma_1 = require("./prisma");
const schemeDates_1 = require("./schemeDates");
const openingStockSnapshot_1 = require("./openingStockSnapshot");
const dailyStockStatus_1 = require("./dailyStockStatus");
/** Sum planned purchase qty per product for active purchases not yet added to stock. */
async function fetchOnPassageQuantityByProduct() {
    const agg = await prisma_1.prisma.purchaseStockBatch.groupBy({
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
async function buildDailyStockReportRows(dateStr) {
    const dayStart = (0, schemeDates_1.istDayStart)(dateStr);
    const dayEnd = (0, schemeDates_1.istDayEnd)(dateStr);
    const isToday = dateStr === (0, schemeDates_1.toIstYmd)(new Date());
    const [products, openingRows, inwardAgg, outwardAgg, onPassageByProduct, liveByProduct, dailyByProduct,] = await Promise.all([
        prisma_1.prisma.product.findMany({
            select: {
                id: true,
                name: true,
                productCode: true,
                mrp: true,
                cartonsPerPallet: true,
            },
            orderBy: { productCode: "asc" },
        }),
        prisma_1.prisma.openingStock.findMany({
            where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
            select: {
                productId: true,
                quantity: true,
                snapshotDate: true,
            },
        }),
        prisma_1.prisma.stockRecord.groupBy({
            by: ["productId"],
            where: {
                changeType: "INCREASE",
                changeDate: { gte: dayStart, lte: dayEnd },
            },
            _sum: { changeInStock: true },
        }),
        prisma_1.prisma.stockRecord.groupBy({
            by: ["productId"],
            where: {
                changeType: "DECREASE",
                changeDate: { gte: dayStart, lte: dayEnd },
            },
            _sum: { changeInStock: true },
        }),
        fetchOnPassageQuantityByProduct(),
        isToday ? (0, openingStockSnapshot_1.fetchLiveBatchSumByProduct)() : Promise.resolve(null),
        (0, dailyStockStatus_1.fetchDailyStockStatusByProduct)(dateStr),
    ]);
    const openingByProduct = (0, openingStockSnapshot_1.pickOpeningByProduct)(openingRows, dayStart);
    const inwardByProduct = new Map(inwardAgg.map((r) => [r.productId, r._sum.changeInStock ?? 0]));
    const outwardByProduct = new Map(outwardAgg.map((r) => [r.productId, Math.abs(r._sum.changeInStock ?? 0)]));
    const rows = products.map((p) => {
        const inward = inwardByProduct.get(p.id) ?? 0;
        const outward = outwardByProduct.get(p.id) ?? 0;
        let opening = openingByProduct.get(p.id) ?? 0;
        let closing = opening + inward - outward;
        if (liveByProduct) {
            const reconciled = (0, openingStockSnapshot_1.reconcileTodayOpeningClosing)({
                opening,
                inward,
                outward,
                liveBatchSum: liveByProduct.get(p.id) ?? 0,
            });
            opening = reconciled.opening;
            closing = reconciled.closing;
        }
        const current = dailyByProduct.get(p.id) ?? { ...dailyStockStatus_1.EMPTY_DAILY_STOCK_STATUS_FIELDS };
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
function actualStockFromDailyRow(row) {
    return row.closingStock + (row.dip ?? 0) + row.onPassageQuantity;
}
//# sourceMappingURL=dailyStockReport.js.map