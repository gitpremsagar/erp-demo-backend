"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCatalog = getCatalog;
exports.invalidateCatalogCache = invalidateCatalogCache;
const prisma_1 = require("../../lib/prisma");
const CACHE_TTL_MS = 5 * 60 * 1000;
let cached = null;
async function getCatalog(force = false) {
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached;
    }
    const [products, transporters, statusTypes] = await Promise.all([
        prisma_1.prisma.product.findMany({
            select: {
                id: true,
                name: true,
                productCode: true,
                mrp: true,
                gstPercentage: true,
                packetsPerCarton: true,
                costPricePerCarton: true,
                costPricePerPacket: true,
                sellingPricePerCartonForDb: true,
                sellingPricePerPacketForDb: true,
                sellingPricePerCartonForRss: true,
                sellingPricePerPacketForRss: true,
                festivePricePerPacket: true,
                festivePricePerCarton: true,
                cartonsPerPallet: true,
                lifeOfProduct: true,
                lowStockLimit: true,
                isDiscontinued: true,
            },
            take: 20000,
        }),
        prisma_1.prisma.transporter.findMany({
            select: { id: true, name: true },
            take: 5000,
        }),
        prisma_1.prisma.orderStatusType.findMany({
            select: { id: true, name: true, displayName: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
        }),
    ]);
    cached = {
        products,
        transporters,
        statusTypes,
        loadedAt: Date.now(),
    };
    return cached;
}
function invalidateCatalogCache() {
    cached = null;
}
//# sourceMappingURL=ai.catalogCache.js.map