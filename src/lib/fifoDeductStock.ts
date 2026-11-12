import type { StockRecordEntryReason } from "@prisma/client";
import { applyStockLedgerDelta, type StockLedgerDb } from "./applyStockLedgerDelta";
import { defaultChangeDateIst } from "./stockRecordChangeMeta";

export type FifoDeductStockParams = {
  db: StockLedgerDb;
  productId: string;
  quantity: number;
  createdBy: string;
  reason?: StockRecordEntryReason;
  salesReturnId?: string | null;
  creditNoteId?: string | null;
  /** Deduct these batches first (current on-hand), then FIFO the rest. */
  preferBatchIds?: string[];
};

/**
 * Deduct `quantity` of a product from on-hand batches (stockQuantity > 0),
 * oldest arrivalDate first — same walk as order create.
 * Preferred batches are consumed before other FIFO batches.
 * Throws if total on-hand is less than `quantity` (message includes "insufficient stock").
 */
export async function fifoDeductStock(params: FifoDeductStockParams): Promise<void> {
  const {
    db,
    productId,
    quantity,
    createdBy,
    reason = "CORRECTION_BY_ADMIN",
    salesReturnId,
    creditNoteId,
    preferBatchIds = [],
  } = params;

  if (!Number.isFinite(quantity) || quantity <= 0) return;

  const batches = await db.stockBatch.findMany({
    where: {
      productId,
      stockQuantity: { gt: 0 },
    },
    orderBy: { arrivalDate: "asc" },
    select: { id: true, stockQuantity: true },
  });

  const totalOnHand = batches.reduce((sum, b) => sum + b.stockQuantity, 0);
  if (totalOnHand < quantity) {
    throw new Error(
      `fifoDeductStock: insufficient stock for product ${productId} (have ${totalOnHand}, need ${quantity})`
    );
  }

  const preferSet = new Set(preferBatchIds);
  const preferred = batches.filter((b) => preferSet.has(b.id));
  const others = batches.filter((b) => !preferSet.has(b.id));
  const ordered = [...preferred, ...others];

  const changeDate = defaultChangeDateIst();
  let remaining = quantity;
  for (const batch of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(batch.stockQuantity, remaining);
    if (take <= 0) continue;
    await applyStockLedgerDelta({
      db,
      stockBatchId: batch.id,
      productId,
      delta: -take,
      reason,
      changeDate,
      createdBy,
      salesReturnId,
      creditNoteId,
    });
    remaining -= take;
  }
}
