"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TALLY_INVOICE_ID_PATTERN = exports.TALLY_INVOICE_PREFIX = exports.TALLY_INVOICE_TIME_ZONE = void 0;
exports.getShortFinancialYear = getShortFinancialYear;
exports.formatTallyInvoiceId = formatTallyInvoiceId;
exports.normalizeTallyInvoiceId = normalizeTallyInvoiceId;
exports.ensureCounterAtLeast = ensureCounterAtLeast;
exports.assertTallyInvoiceIdAvailable = assertTallyInvoiceIdAvailable;
exports.resolveTallyInvoiceId = resolveTallyInvoiceId;
exports.allocateTallyInvoiceId = allocateTallyInvoiceId;
exports.resolveManualTallyInvoiceIdUpdate = resolveManualTallyInvoiceIdUpdate;
exports.TALLY_INVOICE_TIME_ZONE = "Asia/Kolkata";
exports.TALLY_INVOICE_PREFIX = "SGT";
/** Matches SGT/26-27/1 (case-insensitive on prefix). */
exports.TALLY_INVOICE_ID_PATTERN = /^SGT\/(\d{2})-(\d{2})\/(\d+)$/i;
function getZonedDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
    return { year: get("year"), month: get("month"), day: get("day") };
}
/** Short Indian FY label from a date, e.g. "26-27" (1 Apr → 31 Mar). */
function getShortFinancialYear(date, timeZone = exports.TALLY_INVOICE_TIME_ZONE) {
    const parts = getZonedDateParts(date, timeZone);
    if (parts.month >= 4) {
        const start = parts.year % 100;
        const end = (parts.year + 1) % 100;
        return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
    }
    const start = (parts.year - 1) % 100;
    const end = parts.year % 100;
    return `${String(start).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
}
function formatTallyInvoiceId(financialYear, n) {
    return `${exports.TALLY_INVOICE_PREFIX}/${financialYear}/${n}`;
}
/**
 * Normalize and parse a manual Tally invoice ID.
 * Returns null if empty/whitespace; throws Error with message if invalid format.
 */
function normalizeTallyInvoiceId(raw) {
    if (raw === undefined || raw === null)
        return null;
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const match = exports.TALLY_INVOICE_ID_PATTERN.exec(trimmed);
    if (!match) {
        throw new Error("Invalid Tally invoice ID format. Expected SGT/YY-YY/N (e.g. SGT/26-27/1).");
    }
    const startYy = Number(match[1]);
    const endYy = Number(match[2]);
    if ((startYy + 1) % 100 !== endYy) {
        throw new Error("Invalid Tally invoice ID financial year. End year must be start year + 1.");
    }
    const number = Number(match[3]);
    if (!Number.isInteger(number) || number < 1) {
        throw new Error("Tally invoice ID sequence number must be a positive integer.");
    }
    const financialYear = `${match[1]}-${match[2]}`;
    return {
        financialYear,
        number,
        normalized: formatTallyInvoiceId(financialYear, number),
    };
}
async function ensureCounterAtLeast(tx, financialYear, usedNumber) {
    const minNext = usedNumber + 1;
    const existing = await tx.tallyInvoiceCounter.findUnique({
        where: { financialYear },
    });
    if (!existing) {
        await tx.tallyInvoiceCounter.create({
            data: { financialYear, nextNumber: minNext },
        });
        return;
    }
    if (existing.nextNumber < minNext) {
        await tx.tallyInvoiceCounter.update({
            where: { financialYear },
            data: { nextNumber: minNext },
        });
    }
}
async function assertTallyInvoiceIdAvailable(tx, tallyInvoiceId, excludeOrderId) {
    const conflict = await tx.order.findFirst({
        where: {
            tallyInvoiceId,
            ...(excludeOrderId ? { NOT: { id: excludeOrderId } } : {}),
        },
        select: { id: true },
    });
    if (conflict) {
        throw new Error(`Tally invoice ID ${tallyInvoiceId} is already used by another order.`);
    }
}
/**
 * Resolve the ID to store: use manual value (and bump counter) or allocate next.
 */
async function resolveTallyInvoiceId(tx, orderDate, manualRaw, excludeOrderId) {
    const parsed = normalizeTallyInvoiceId(manualRaw ?? null);
    if (parsed) {
        await assertTallyInvoiceIdAvailable(tx, parsed.normalized, excludeOrderId);
        await ensureCounterAtLeast(tx, parsed.financialYear, parsed.number);
        return parsed.normalized;
    }
    return allocateTallyInvoiceId(tx, orderDate);
}
/** Allocate the next Tally invoice ID for the FY of `orderDate`. */
async function allocateTallyInvoiceId(tx, orderDate) {
    const financialYear = getShortFinancialYear(orderDate);
    const existing = await tx.tallyInvoiceCounter.findUnique({
        where: { financialYear },
    });
    let nextNumber;
    if (!existing) {
        await tx.tallyInvoiceCounter.create({
            data: { financialYear, nextNumber: 2 },
        });
        nextNumber = 1;
    }
    else {
        nextNumber = existing.nextNumber;
        await tx.tallyInvoiceCounter.update({
            where: { financialYear },
            data: { nextNumber: nextNumber + 1 },
        });
    }
    const id = formatTallyInvoiceId(financialYear, nextNumber);
    await assertTallyInvoiceIdAvailable(tx, id);
    return id;
}
/**
 * Apply a manual tallyInvoiceId update on an existing order (may clear with empty string → no-op for clear;
 * pass null/undefined to leave unchanged; empty string clears only if you want — plan says editable, so
 * empty means clear only when explicitly allowed).
 *
 * Returns the value to set on the order, or undefined if the field was not provided.
 */
async function resolveManualTallyInvoiceIdUpdate(tx, raw, excludeOrderId) {
    if (raw === undefined)
        return undefined;
    if (raw === null || raw.trim() === "") {
        return null;
    }
    const parsed = normalizeTallyInvoiceId(raw);
    if (!parsed)
        return null;
    await assertTallyInvoiceIdAvailable(tx, parsed.normalized, excludeOrderId);
    await ensureCounterAtLeast(tx, parsed.financialYear, parsed.number);
    return parsed.normalized;
}
//# sourceMappingURL=tallyInvoiceId.js.map