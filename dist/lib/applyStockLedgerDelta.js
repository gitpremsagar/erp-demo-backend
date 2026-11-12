"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyStockLedgerDelta = applyStockLedgerDelta;
exports.isInsufficientStockError = isInsufficientStockError;
const stockRecordChangeMeta_1 = require("./stockRecordChangeMeta");
/**
 * Atomically apply a stock quantity delta and append a StockRecord.
 * Callers must never update stockQuantity without going through this helper
 * (except create-batch + initial ARRIVAL record paths that create both together).
 */
async function applyStockLedgerDelta(params) {
    const { db, stockBatchId, productId, delta, reason, changeDate, createdBy, orderId, salesReturnId, creditNoteId, syncArchive = true, } = params;
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
        throw new Error(`applyStockLedgerDelta: productId mismatch for batch ${stockBatchId}`);
    }
    const newQuantity = batch.stockQuantity + delta;
    if (newQuantity < 0) {
        throw new Error(`applyStockLedgerDelta: insufficient stock on batch ${stockBatchId} (have ${batch.stockQuantity}, delta ${delta})`);
    }
    const changeMeta = (0, stockRecordChangeMeta_1.buildStockRecordChangeFields)({
        changeInStock: delta,
        changeDate,
    });
    const archiveData = {};
    if (syncArchive) {
        if (newQuantity === 0 && !batch.isArchived) {
            archiveData.isArchived = true;
        }
        else if (newQuantity > 0 && batch.isArchived) {
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
function isInsufficientStockError(error) {
    let current = error;
    for (let depth = 0; depth < 4 && current != null; depth++) {
        if (!(current instanceof Error))
            return false;
        if (current.message.includes("insufficient stock"))
            return true;
        current = current.cause;
    }
    return false;
}
//# sourceMappingURL=applyStockLedgerDelta.js.map