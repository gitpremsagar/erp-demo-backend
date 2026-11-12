"use strict";
/**
 * Purchase invoice line cost-pricing snapshot at create/update/sync time.
 * Carton rate follows product form: packet × packetsPerCarton when packetsPerCarton > 0.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPurchaseItemPriceSnapshot = buildPurchaseItemPriceSnapshot;
exports.resolvePurchaseItemSnapshotRates = resolvePurchaseItemSnapshotRates;
exports.computePurchaseLineBasicFromSnapshot = computePurchaseLineBasicFromSnapshot;
exports.computePurchaseLineAmountFromSnapshot = computePurchaseLineAmountFromSnapshot;
exports.computePurchaseInvoiceBasicFromItems = computePurchaseInvoiceBasicFromItems;
exports.computePurchaseInvoiceAmountFromItems = computePurchaseInvoiceAmountFromItems;
const orderItemPriceSnapshot_1 = require("./orderItemPriceSnapshot");
function buildPurchaseItemPriceSnapshot(product) {
    const pkt = product.costPricePerPacket ?? 0;
    const storedCart = product.costPricePerCarton ?? 0;
    const ppc = product.packetsPerCarton ?? null;
    return {
        mrp: product.mrp,
        gstPercentage: product.gstPercentage ?? null,
        packetsPerCarton: ppc,
        costPricePerPacket: product.costPricePerPacket ?? null,
        costPricePerCarton: (0, orderItemPriceSnapshot_1.deriveCartonRateFromPacket)(pkt, storedCart, ppc),
    };
}
/** Resolve billing rates from PurchaseInvoiceItem snapshot only (no Product). */
function resolvePurchaseItemSnapshotRates(item) {
    const pkt = item.costPricePerPacket ?? 0;
    const storedCart = item.costPricePerCarton ?? 0;
    const ppc = item.packetsPerCarton;
    return {
        packet: pkt,
        carton: (0, orderItemPriceSnapshot_1.deriveCartonRateFromPacket)(pkt, storedCart, ppc),
        gstPercent: item.gstPercentage ?? 0,
    };
}
/** Line basic amount (ex-GST) from purchase invoice item price snapshot. */
function computePurchaseLineBasicFromSnapshot(item) {
    const qty = item.quantity ?? 0;
    if (qty < 1)
        return 0;
    const { carton: ratePerCarton } = resolvePurchaseItemSnapshotRates(item);
    return qty * ratePerCarton;
}
/** Line total with GST from purchase invoice item price snapshot. */
function computePurchaseLineAmountFromSnapshot(item) {
    const qty = item.quantity ?? 0;
    if (qty < 1)
        return 0;
    const { carton: ratePerCarton, gstPercent } = resolvePurchaseItemSnapshotRates(item);
    const basicAmount = qty * ratePerCarton;
    return basicAmount + basicAmount * (gstPercent / 100);
}
/** Sum of line basic amounts (ex-GST) for one purchase invoice. */
function computePurchaseInvoiceBasicFromItems(items) {
    return items.reduce((sum, item) => sum + computePurchaseLineBasicFromSnapshot(item), 0);
}
/** Sum of line amounts with GST for one purchase invoice. */
function computePurchaseInvoiceAmountFromItems(items) {
    return items.reduce((sum, item) => sum + computePurchaseLineAmountFromSnapshot(item), 0);
}
//# sourceMappingURL=purchaseItemPriceSnapshot.js.map