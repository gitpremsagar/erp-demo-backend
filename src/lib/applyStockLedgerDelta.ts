import type { Prisma, StockRecordEntryReason } from "@prisma/client";
import { prisma } from "./prisma";
import { buildStockRecordChangeFields } from "./stockRecordChangeMeta";

export type StockLedgerDb = Prisma.TransactionClient | typeof prisma;

export type ApplyStockLedgerDeltaParams = {
  db: StockLedgerDb;
  stockBatchId: string;
  productId: string;
  /** Signed delta: positive increases stock, negative decreases. */
  delta: number;
  reason: StockRecordEntryReason;
  changeDate: Date;
  createdBy: string;
  orderId?: string | null;
  salesReturnId?: string | null;
  creditNoteId?: string | null;
  /** When true (default), archive batch if resulting qty is 0; unarchive when qty becomes > 0. */
  syncArchive?: boolean;
};

/**
 * Atomically apply a stock quantity delta and append a StockRecord.
 * Callers must never update stockQuantity without going through this helper
 * (except create-batch + initial ARRIVAL record paths that create both together).
 */
export async function applyStockLedgerDelta(
  params: ApplyStockLedgerDeltaParams
): Promise<{ newQuantity: number }> {
  const {
    db,
    stockBatchId,
    productId,
    delta,
    reason,
    changeDate,
    createdBy,
    orderId,
    salesReturnId,
    creditNoteId,
    syncArchive = true,
  } = params;

  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error("applyStockLedgerDelta: delta must be a non-zero number");
  }

  const batch = await db.stockBatch.findUnique({
    where: { id: stockBatchId },
    select: { id: true, productId: true, stockQuantity: true, isArchived: true },
  });
  if (!batch) {
    throw new Error(`applyStockLedgerDelta: stock batch not found: ${stockBatchId}`);
  }
  if (batch.productId !== productId) {
    throw new Error(
      `applyStockLedgerDelta: productId mismatch for batch ${stockBatchId}`
    );
  }

  const newQuantity = batch.stockQuantity + delta;
  if (newQuantity < 0) {
    throw new Error(
      `applyStockLedgerDelta: insufficient stock on batch ${stockBatchId} (have ${batch.stockQuantity}, delta ${delta})`
    );
  }

  const changeMeta = buildStockRecordChangeFields({
    changeInStock: delta,
    changeDate,
  });

  const archiveData: { isArchived?: boolean } = {};
  if (syncArchive) {
    if (newQuantity === 0 && !batch.isArchived) {
      archiveData.isArchived = true;
    } else if (newQuantity > 0 && batch.isArchived) {
      archiveData.isArchived = false;
    }
  }

  await db.stockBatch.update({
    where: { id: stockBatchId },
    data: {
      stockQuantity: newQuantity,
      ...archiveData,
    },
  });

  await db.stockRecord.create({
    data: {
      productId,
      stockBatchId,
      changeInStock: delta,
      createdBy,
      reason,
      ...(orderId ? { orderId } : {}),
      ...(salesReturnId ? { salesReturnId } : {}),
      ...(creditNoteId ? { creditNoteId } : {}),
      ...changeMeta,
    },
  });

  return { newQuantity };
}

export function isInsufficientStockError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current != null; depth++) {
    if (!(current instanceof Error)) return false;
    if (current.message.includes("insufficient stock")) return true;
    current = (current as Error & { cause?: unknown }).cause;
  }
  return false;
}
