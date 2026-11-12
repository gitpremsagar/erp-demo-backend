"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_ITEM_EDIT_LOCKED_MESSAGE = exports.ORDER_ITEM_EDIT_LOCK_DAYS = void 0;
exports.istCalendarDaysBetween = istCalendarDaysBetween;
exports.isVerifiedOrderItemEditLocked = isVerifiedOrderItemEditLocked;
exports.hasOrderItemQuantityChanges = hasOrderItemQuantityChanges;
const schemeDates_1 = require("./schemeDates");
exports.ORDER_ITEM_EDIT_LOCK_DAYS = 10;
exports.ORDER_ITEM_EDIT_LOCKED_MESSAGE = `This order is older than ${exports.ORDER_ITEM_EDIT_LOCK_DAYS} days, so its items can no longer be added, removed, or changed.`;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** IST calendar days from `from` to `to` (today − stock deduction date). */
function istCalendarDaysBetween(from, to = new Date()) {
    const fromStart = (0, schemeDates_1.istDayStart)((0, schemeDates_1.toIstYmd)(from)).getTime();
    const toStart = (0, schemeDates_1.istDayStart)((0, schemeDates_1.toIstYmd)(to)).getTime();
    return Math.round((toStart - fromStart) / MS_PER_DAY);
}
function isVerifiedOrderItemEditLocked(order) {
    if (order.isVerifiedByAdmin !== true)
        return false;
    // Verified but missing deduction timestamp: treat as locked (cannot prove it is recent).
    if (!order.verifiedAt)
        return true;
    return istCalendarDaysBetween(order.verifiedAt) > exports.ORDER_ITEM_EDIT_LOCK_DAYS;
}
/** True when incoming line items add, remove, or change quantity (not discount-only). */
function hasOrderItemQuantityChanges(incoming, existingItems) {
    const existingQty = new Map(existingItems.map((item) => [item.productId, item.quantity]));
    for (const item of incoming) {
        const previous = existingQty.get(item.productId) ?? 0;
        if (item.quantity !== previous)
            return true;
    }
    return false;
}
//# sourceMappingURL=orderItemEditLock.js.map