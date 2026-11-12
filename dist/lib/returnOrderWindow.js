"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETURN_ORDER_LOOKBACK_MONTHS = void 0;
exports.getReturnOrderEarliestYmd = getReturnOrderEarliestYmd;
exports.getReturnOrderWindow = getReturnOrderWindow;
exports.isOrderWithinReturnWindow = isOrderWithinReturnWindow;
exports.returnOrderWindowMessage = returnOrderWindowMessage;
const schemeDates_1 = require("./schemeDates");
/**
 * Sales returns and credit notes may only be linked to an order placed within
 * this many calendar months. Keep in sync with
 * `frontend/src/lib/utils/returnOrders.ts` and `sgt-admin-mobile/src/lib/format.ts`.
 */
exports.RETURN_ORDER_LOOKBACK_MONTHS = 3;
/** Earliest order date (IST, YYYY-MM-DD) allowed for a return / credit note. */
function getReturnOrderEarliestYmd(now = new Date()) {
    return (0, schemeDates_1.subtractCalendarMonthsYmd)((0, schemeDates_1.toIstYmd)(now), exports.RETURN_ORDER_LOOKBACK_MONTHS);
}
/**
 * Inclusive IST calendar-day window for return-eligible orders.
 * `startDate` = today − RETURN_ORDER_LOOKBACK_MONTHS, `endDate` = today.
 */
function getReturnOrderWindow(now = new Date()) {
    return {
        startDate: getReturnOrderEarliestYmd(now),
        endDate: (0, schemeDates_1.toIstYmd)(now),
    };
}
/** Whether an order (by its order date) falls inside the return window. */
function isOrderWithinReturnWindow(orderDate, now = new Date()) {
    if (!orderDate)
        return false;
    const parsed = orderDate instanceof Date ? orderDate : new Date(orderDate);
    if (Number.isNaN(parsed.getTime()))
        return false;
    return parsed.getTime() >= (0, schemeDates_1.istDayStart)(getReturnOrderEarliestYmd(now)).getTime();
}
/** User-facing rejection message for an order outside the return window. */
function returnOrderWindowMessage(docLabel) {
    return `This order is older than ${exports.RETURN_ORDER_LOOKBACK_MONTHS} months, so it cannot be used for a ${docLabel}. Choose an order from the last ${exports.RETURN_ORDER_LOOKBACK_MONTHS} months.`;
}
//# sourceMappingURL=returnOrderWindow.js.map