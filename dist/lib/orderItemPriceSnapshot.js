"use strict";
/**
 * Invoice line rates at stock-assignment time (RSS → RSS selling, SS → cost, else → DB).
 * Persisted using the same field names as Product (sparse snapshot: only the tier’s pair is non-null).
 * Carton amounts follow Product form: carton = packet × packetsPerCarton when packetsPerCarton > 0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveCartonRateFromPacket = deriveCartonRateFromPacket;
exports.resolveDbCategory = resolveDbCategory;
exports.buildOrderItemPriceSnapshot = buildOrderItemPriceSnapshot;
exports.resolveOrderItemSnapshotRates = resolveOrderItemSnapshotRates;
const client_1 = require("@prisma/client");
/** Aligns with bulk product import: parseFloat((packetsPerCarton * pricePerPacket).toFixed(4)) */
function deriveCartonRateFromPacket(packetRate, storedCartonRate, packetsPerCarton) {
    const ppc = packetsPerCarton ?? 0;
    if (ppc > 0) {
        return parseFloat((packetRate * ppc).toFixed(4));
    }
    return storedCartonRate;
}
function resolveDbCategory(customer) {
    return customer?.CustomerDetail?.[0]?.dbCategory ?? "DISTRIBUTOR";
}
function buildOrderItemPriceSnapshot(product, dbCategory, isFestivePrice) {
    const gstPercentage = product.gstPercentage ?? 0;
    const ppc = product.packetsPerCarton ?? null;
    // Festive price override: uses festive price in the tier-appropriate selling price fields
    if (isFestivePrice && product.festivePricePerPacket != null) {
        const pkt = product.festivePricePerPacket;
        const storedCart = product.festivePricePerCarton ?? 0;
        const carton = deriveCartonRateFromPacket(pkt, storedCart, ppc);
        // Determine which tier fields to populate based on customer category
        if (dbCategory === "RSS") {
            return {
                pricingTier: client_1.OrderItemPricingTier.RSS,
                gstPercentage,
                packetsPerCarton: ppc,
                costPricePerCarton: null,
                costPricePerPacket: null,
                sellingPricePerCartonForDb: null,
                sellingPricePerPacketForDb: null,
                sellingPricePerCartonForRss: carton,
                sellingPricePerPacketForRss: pkt,
            };
        }
        if (dbCategory === "SS") {
            return {
                pricingTier: client_1.OrderItemPricingTier.SS,
                gstPercentage,
                packetsPerCarton: ppc,
                costPricePerCarton: carton,
                costPricePerPacket: pkt,
                sellingPricePerCartonForDb: null,
                sellingPricePerPacketForDb: null,
                sellingPricePerCartonForRss: null,
                sellingPricePerPacketForRss: null,
            };
        }
        // Default: DB tier
        return {
            pricingTier: client_1.OrderItemPricingTier.DB,
            gstPercentage,
            packetsPerCarton: ppc,
            costPricePerCarton: null,
            costPricePerPacket: null,
            sellingPricePerCartonForDb: carton,
            sellingPricePerPacketForDb: pkt,
            sellingPricePerCartonForRss: null,
            sellingPricePerPacketForRss: null,
        };
    }
    if (dbCategory === "RSS") {
        const pkt = product.sellingPricePerPacketForRss ?? 0;
        const storedCart = product.sellingPricePerCartonForRss ?? 0;
        return {
            pricingTier: client_1.OrderItemPricingTier.RSS,
            gstPercentage,
            packetsPerCarton: ppc,
            costPricePerCarton: null,
            costPricePerPacket: null,
            sellingPricePerCartonForDb: null,
            sellingPricePerPacketForDb: null,
            sellingPricePerCartonForRss: deriveCartonRateFromPacket(pkt, storedCart, ppc),
            sellingPricePerPacketForRss: pkt,
        };
    }
    if (dbCategory === "SS") {
        const pkt = product.costPricePerPacket ?? 0;
        const storedCart = product.costPricePerCarton ?? 0;
        return {
            pricingTier: client_1.OrderItemPricingTier.SS,
            gstPercentage,
            packetsPerCarton: ppc,
            costPricePerCarton: deriveCartonRateFromPacket(pkt, storedCart, ppc),
            costPricePerPacket: pkt,
            sellingPricePerCartonForDb: null,
            sellingPricePerPacketForDb: null,
            sellingPricePerCartonForRss: null,
            sellingPricePerPacketForRss: null,
        };
    }
    const pkt = product.sellingPricePerPacketForDb ?? 0;
    const storedCart = product.sellingPricePerCartonForDb ?? 0;
    return {
        pricingTier: client_1.OrderItemPricingTier.DB,
        gstPercentage,
        packetsPerCarton: ppc,
        costPricePerCarton: null,
        costPricePerPacket: null,
        sellingPricePerCartonForDb: deriveCartonRateFromPacket(pkt, storedCart, ppc),
        sellingPricePerPacketForDb: pkt,
        sellingPricePerCartonForRss: null,
        sellingPricePerPacketForRss: null,
    };
}
/** Use OrderItem snapshot only (no Product). Returns null if no usable pricing snapshot on the line. */
function resolveOrderItemSnapshotRates(item) {
    if (item.gstPercentage === null || item.gstPercentage === undefined) {
        return null;
    }
    const gstPercent = item.gstPercentage ?? 0;
    const tier = item.pricingTier;
    const ppc = item.packetsPerCarton;
    function finish(packetRate, storedCarton) {
        return {
            packet: packetRate,
            carton: deriveCartonRateFromPacket(packetRate, storedCarton, ppc),
            gstPercent,
        };
    }
    if (tier === client_1.OrderItemPricingTier.RSS) {
        const pkt = item.sellingPricePerPacketForRss ?? 0;
        const stored = item.sellingPricePerCartonForRss ?? 0;
        return finish(pkt, stored);
    }
    if (tier === client_1.OrderItemPricingTier.SS) {
        const pkt = item.costPricePerPacket ?? 0;
        const stored = item.costPricePerCarton ?? 0;
        return finish(pkt, stored);
    }
    if (tier === client_1.OrderItemPricingTier.DB) {
        const pkt = item.sellingPricePerPacketForDb ?? 0;
        const stored = item.sellingPricePerCartonForDb ?? 0;
        return finish(pkt, stored);
    }
    if (item.sellingPricePerCartonForRss !== null && item.sellingPricePerCartonForRss !== undefined) {
        const pkt = item.sellingPricePerPacketForRss ?? 0;
        return finish(pkt, item.sellingPricePerCartonForRss);
    }
    if (item.costPricePerCarton !== null && item.costPricePerCarton !== undefined) {
        const pkt = item.costPricePerPacket ?? 0;
        return finish(pkt, item.costPricePerCarton);
    }
    if (item.sellingPricePerCartonForDb !== null && item.sellingPricePerCartonForDb !== undefined) {
        const pkt = item.sellingPricePerPacketForDb ?? 0;
        return finish(pkt, item.sellingPricePerCartonForDb);
    }
    if (item.sellingPricePerPacketForRss !== null && item.sellingPricePerPacketForRss !== undefined) {
        const pkt = item.sellingPricePerPacketForRss;
        const stored = item.sellingPricePerCartonForRss ?? 0;
        return finish(pkt, stored);
    }
    if (item.costPricePerPacket !== null && item.costPricePerPacket !== undefined) {
        const pkt = item.costPricePerPacket;
        const stored = item.costPricePerCarton ?? 0;
        return finish(pkt, stored);
    }
    if (item.sellingPricePerPacketForDb !== null && item.sellingPricePerPacketForDb !== undefined) {
        const pkt = item.sellingPricePerPacketForDb;
        const stored = item.sellingPricePerCartonForDb ?? 0;
        return finish(pkt, stored);
    }
    return null;
}
//# sourceMappingURL=orderItemPriceSnapshot.js.map