/**
 * Purchase invoice line cost-pricing snapshot at create/update/sync time.
 * Carton rate follows product form: packet × packetsPerCarton when packetsPerCarton > 0.
 */

import { deriveCartonRateFromPacket } from "./orderItemPriceSnapshot";

/** Product master fields (schema: packetsPerCarton, costPricePerCarton). */
export type PurchaseItemPriceProductFields = {
  mrp: number;
  gstPercentage?: number | null;
  packetsPerCarton?: number | null;
  costPricePerCarton?: number | null;
  costPricePerPacket?: number | null;
};

/** PurchaseInvoiceItem snapshot fields (schema: packetsPerCarton, costPricePerCarton). */
export type PurchaseItemPriceSnapshotPayload = {
  mrp: number;
  gstPercentage: number | null;
  packetsPerCarton: number | null;
  costPricePerPacket: number | null;
  costPricePerCarton: number;
};

export type PurchaseItemPricingFields = {
  mrp?: number | null;
  gstPercentage?: number | null;
  packetsPerCarton?: number | null;
  costPricePerCarton?: number | null;
  costPricePerPacket?: number | null;
};

export function buildPurchaseItemPriceSnapshot(
  product: PurchaseItemPriceProductFields
): PurchaseItemPriceSnapshotPayload {
  const pkt = product.costPricePerPacket ?? 0;
  const storedCart = product.costPricePerCarton ?? 0;
  const ppc = product.packetsPerCarton ?? null;

  return {
    mrp: product.mrp,
    gstPercentage: product.gstPercentage ?? null,
    packetsPerCarton: ppc,
    costPricePerPacket: product.costPricePerPacket ?? null,
    costPricePerCarton: deriveCartonRateFromPacket(pkt, storedCart, ppc),
  };
}

/** Resolve billing rates from PurchaseInvoiceItem snapshot only (no Product). */
export function resolvePurchaseItemSnapshotRates(
  item: PurchaseItemPricingFields
): { carton: number; packet: number; gstPercent: number } {
  const pkt = item.costPricePerPacket ?? 0;
  const storedCart = item.costPricePerCarton ?? 0;
  const ppc = item.packetsPerCarton;
  return {
    packet: pkt,
    carton: deriveCartonRateFromPacket(pkt, storedCart, ppc),
    gstPercent: item.gstPercentage ?? 0,
  };
}

export type PurchaseLineAmountFields = PurchaseItemPricingFields & {
  quantity?: number | null;
};

/** Line basic amount (ex-GST) from purchase invoice item price snapshot. */
export function computePurchaseLineBasicFromSnapshot(
  item: PurchaseLineAmountFields
): number {
  const qty = item.quantity ?? 0;
  if (qty < 1) return 0;
  const { carton: ratePerCarton } = resolvePurchaseItemSnapshotRates(item);
  return qty * ratePerCarton;
}

/** Line total with GST from purchase invoice item price snapshot. */
export function computePurchaseLineAmountFromSnapshot(
  item: PurchaseLineAmountFields
): number {
  const qty = item.quantity ?? 0;
  if (qty < 1) return 0;
  const { carton: ratePerCarton, gstPercent } =
    resolvePurchaseItemSnapshotRates(item);
  const basicAmount = qty * ratePerCarton;
  return basicAmount + basicAmount * (gstPercent / 100);
}

/** Sum of line basic amounts (ex-GST) for one purchase invoice. */
export function computePurchaseInvoiceBasicFromItems(
  items: PurchaseLineAmountFields[]
): number {
  return items.reduce(
    (sum, item) => sum + computePurchaseLineBasicFromSnapshot(item),
    0
  );
}

/** Sum of line amounts with GST for one purchase invoice. */
export function computePurchaseInvoiceAmountFromItems(
  items: PurchaseLineAmountFields[]
): number {
  return items.reduce(
    (sum, item) => sum + computePurchaseLineAmountFromSnapshot(item),
    0
  );
}
