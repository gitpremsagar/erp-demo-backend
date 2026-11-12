import { istDayStart, subtractCalendarMonthsYmd, toIstYmd } from "./schemeDates";

/**
 * Sales returns and credit notes may only be linked to an order placed within
 * this many calendar months. Keep in sync with
 * `frontend/src/lib/utils/returnOrders.ts` and `sgt-admin-mobile/src/lib/format.ts`.
 */
export const RETURN_ORDER_LOOKBACK_MONTHS = 3;

/** Earliest order date (IST, YYYY-MM-DD) allowed for a return / credit note. */
export function getReturnOrderEarliestYmd(now: Date = new Date()): string {
  return subtractCalendarMonthsYmd(toIstYmd(now), RETURN_ORDER_LOOKBACK_MONTHS);
}

/**
 * Inclusive IST calendar-day window for return-eligible orders.
 * `startDate` = today − RETURN_ORDER_LOOKBACK_MONTHS, `endDate` = today.
 */
export function getReturnOrderWindow(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: getReturnOrderEarliestYmd(now),
    endDate: toIstYmd(now),
  };
}

/** Whether an order (by its order date) falls inside the return window. */
export function isOrderWithinReturnWindow(
  orderDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!orderDate) return false;
  const parsed = orderDate instanceof Date ? orderDate : new Date(orderDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= istDayStart(getReturnOrderEarliestYmd(now)).getTime();
}

/** User-facing rejection message for an order outside the return window. */
export function returnOrderWindowMessage(docLabel: string): string {
  return `This order is older than ${RETURN_ORDER_LOOKBACK_MONTHS} months, so it cannot be used for a ${docLabel}. Choose an order from the last ${RETURN_ORDER_LOOKBACK_MONTHS} months.`;
}
