"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLastOrderDateByProductId = fetchLastOrderDateByProductId;
exports.fetchInStockSummaryByProductId = fetchInStockSummaryByProductId;
exports.fetchActiveSchemesByProductId = fetchActiveSchemesByProductId;
const prisma_1 = require("./prisma");
async function fetchLastOrderDateByProductId(productIds) {
    const map = new Map();
    if (productIds.length === 0)
        return map;
    const rows = await prisma_1.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _max: { orderDate: true },
    });
    for (const row of rows) {
        if (row._max.orderDate) {
            map.set(row.productId, row._max.orderDate);
        }
    }
    return map;
}
async function fetchInStockSummaryByProductId(productIds) {
    const map = new Map();
    if (productIds.length === 0)
        return map;
    const rows = await prisma_1.prisma.stockBatch.groupBy({
        by: ["productId"],
        where: {
            productId: { in: productIds },
            stockQuantity: { gt: 0 },
        },
        _sum: { stockQuantity: true },
        _min: { arrivalDate: true, expiryDate: true },
    });
    for (const row of rows) {
        map.set(row.productId, {
            stockQuantity: row._sum.stockQuantity ?? 0,
            oldestArrivalDate: row._min.arrivalDate,
            nearestExpiryDate: row._min.expiryDate,
        });
    }
    return map;
}
const LIST_SCHEME_SELECT = {
    id: true,
    productId: true,
    schemePercentage: true,
    slab1MinCb: true,
    slab1MaxCb: true,
    slab1Percent: true,
    slab2MinCb: true,
    slab2MaxCb: true,
    slab2Percent: true,
    slab3MinCb: true,
    slab3MaxCb: true,
    slab3Percent: true,
    slab4MinCb: true,
    slab4MaxCb: true,
    slab4Percent: true,
    startDate: true,
    endDate: true,
    isActive: true,
};
async function fetchActiveSchemesByProductId(productIds) {
    const map = new Map();
    if (productIds.length === 0)
        return map;
    const schemes = await prisma_1.prisma.productScheme.findMany({
        where: {
            productId: { in: productIds },
            isActive: true,
        },
        select: LIST_SCHEME_SELECT,
    });
    for (const scheme of schemes) {
        const list = map.get(scheme.productId);
        if (list)
            list.push(scheme);
        else
            map.set(scheme.productId, [scheme]);
    }
    return map;
}
//# sourceMappingURL=productListAggregates.js.map