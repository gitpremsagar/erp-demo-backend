"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPurchaseLinePricingComplete = isPurchaseLinePricingComplete;
exports.isPurchasePricingComplete = isPurchasePricingComplete;
exports.attachPricingComplete = attachPricingComplete;
function isPurchaseLinePricingComplete(item) {
    const mrp = item.mrp ?? 0;
    const packetRate = item.costPricePerPacket ?? 0;
    const cartonRate = item.costPricePerCarton ?? 0;
    return mrp > 0 && packetRate > 0 && cartonRate > 0;
}
function isPurchasePricingComplete(invoices) {
    const lines = invoices.flatMap((inv) => inv.PurchaseInvoiceItem);
    if (lines.length === 0)
        return false;
    return lines.every(isPurchaseLinePricingComplete);
}
function attachPricingComplete(purchase) {
    return {
        ...purchase,
        pricingComplete: isPurchasePricingComplete(purchase.PurchaseInvoice),
    };
}
//# sourceMappingURL=purchasePricing.js.map