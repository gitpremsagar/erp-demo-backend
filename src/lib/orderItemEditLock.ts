import { istDayStart, toIstYmd } from "./schemeDates";

export const ORDER_ITEM_EDIT_LOCK_DAYS = 10;

export const ORDER_ITEM_EDIT_LOCKED_MESSAGE =
  `This order is older than ${ORDER_ITEM_EDIT_LOCK_DAYS} days, so its items can no longer be added, removed, or changed.`;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** IST calendar days from `from` to `to` (today − stock deduction date). */
export function istCalendarDaysBetween(from: Date, to: Date = new Date()): number {
  const fromStart = istDayStart(toIstYmd(from)).getTime();
  const toStart = istDayStart(toIstYmd(to)).getTime();
  return Math.round((toStart - fromStart) / MS_PER_DAY);
}

export function isVerifiedOrderItemEditLocked(order: {
  isVerifiedByAdmin?: boolean | null;
  verifiedAt?: Date | null;
}): boolean {
  if (order.isVerifiedByAdmin !== true) return false;
  // Verified but missing deduction timestamp: treat as locked (cannot prove it is recent).
  if (!order.verifiedAt) return true;
  return istCalendarDaysBetween(order.verifiedAt) > ORDER_ITEM_EDIT_LOCK_DAYS;
}

/** True when incoming line items add, remove, or change quantity (not discount-only). */
export function hasOrderItemQuantityChanges(
  incoming: { productId: string; quantity: number }[],
  existingItems: { productId: string; quantity: number }[]
): boolean {
  const existingQty = new Map(existingItems.map((item) => [item.productId, item.quantity]));
  for (const item of incoming) {
    const previous = existingQty.get(item.productId) ?? 0;
    if (item.quantity !== previous) return true;
  }
  return false;
}
