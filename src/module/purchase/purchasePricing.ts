type PricingCheckItem = {
  mrp?: number | null;
  costPricePerPacket?: number | null;
  costPricePerCarton?: number | null;
};

type PricingCheckInvoice = {
  PurchaseInvoiceItem: PricingCheckItem[];
};

export function isPurchaseLinePricingComplete(item: PricingCheckItem): boolean {
  const mrp = item.mrp ?? 0;
  const packetRate = item.costPricePerPacket ?? 0;
  const cartonRate = item.costPricePerCarton ?? 0;
  return mrp > 0 && packetRate > 0 && cartonRate > 0;
}

export function isPurchasePricingComplete(
  invoices: PricingCheckInvoice[]
): boolean {
  const lines = invoices.flatMap((inv) => inv.PurchaseInvoiceItem);
  if (lines.length === 0) return false;
  return lines.every(isPurchaseLinePricingComplete);
}

export function attachPricingComplete<T extends { PurchaseInvoice: PricingCheckInvoice[] }>(
  purchase: T
): T & { pricingComplete: boolean } {
  return {
    ...purchase,
    pricingComplete: isPurchasePricingComplete(purchase.PurchaseInvoice),
  };
}
