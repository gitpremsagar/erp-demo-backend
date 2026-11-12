"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_STOCK_STATUS_FIELD_SELECT = exports.EMPTY_DAILY_STOCK_STATUS_FIELDS = exports.REMARKS_MAX_LENGTH = exports.DAILY_STOCK_STATUS_TEXT_FIELDS = exports.DAILY_STOCK_STATUS_NUMBER_FIELDS = void 0;
exports.toNullableInt = toNullableInt;
exports.toNullableString = toNullableString;
exports.mapDailyStockStatusFields = mapDailyStockStatusFields;
exports.dailyStockStatusDayBounds = dailyStockStatusDayBounds;
exports.parseOptionalNonNegInt = parseOptionalNonNegInt;
exports.parseOptionalRemark = parseOptionalRemark;
exports.parseDailyStockStatusBody = parseDailyStockStatusBody;
exports.upsertDailyStockStatus = upsertDailyStockStatus;
exports.fetchDailyStockStatusByProduct = fetchDailyStockStatusByProduct;
const prisma_1 = require("./prisma");
const schemeDates_1 = require("./schemeDates");
exports.DAILY_STOCK_STATUS_NUMBER_FIELDS = [
    "allocation",
    "dip",
    "pendingQuantity",
    "arsQuantity",
    "manualOrderQuantity",
    "requirement",
    "tallyQuantity",
    "dmsQuantity",
];
exports.DAILY_STOCK_STATUS_TEXT_FIELDS = [
    "tallyRemark",
    "dmsRemark",
];
exports.REMARKS_MAX_LENGTH = 500;
exports.EMPTY_DAILY_STOCK_STATUS_FIELDS = {
    allocation: null,
    dip: null,
    pendingQuantity: null,
    arsQuantity: null,
    manualOrderQuantity: null,
    requirement: null,
    tallyQuantity: null,
    tallyRemark: null,
    dmsQuantity: null,
    dmsRemark: null,
};
exports.DAILY_STOCK_STATUS_FIELD_SELECT = {
    allocation: true,
    dip: true,
    pendingQuantity: true,
    arsQuantity: true,
    manualOrderQuantity: true,
    requirement: true,
    tallyQuantity: true,
    tallyRemark: true,
    dmsQuantity: true,
    dmsRemark: true,
    tallyQtyUpdatedAt: true,
    dmsQtyUpdatedAt: true,
};
function toNullableInt(value) {
    return value === null || value === undefined ? null : value;
}
function toNullableString(value) {
    if (value === null || value === undefined)
        return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}
function mapDailyStockStatusFields(row) {
    if (!row)
        return { ...exports.EMPTY_DAILY_STOCK_STATUS_FIELDS };
    return {
        allocation: toNullableInt(row.allocation),
        dip: toNullableInt(row.dip),
        pendingQuantity: toNullableInt(row.pendingQuantity),
        arsQuantity: toNullableInt(row.arsQuantity),
        manualOrderQuantity: toNullableInt(row.manualOrderQuantity),
        requirement: toNullableInt(row.requirement),
        tallyQuantity: toNullableInt(row.tallyQuantity),
        tallyRemark: toNullableString(row.tallyRemark),
        dmsQuantity: toNullableInt(row.dmsQuantity),
        dmsRemark: toNullableString(row.dmsRemark),
    };
}
function dailyStockStatusDayBounds(dateStr) {
    const dayStart = (0, schemeDates_1.istDayStart)(dateStr);
    return {
        dayStart,
        dayEnd: (0, schemeDates_1.istDayEnd)(dateStr),
        snapshotDate: dayStart,
    };
}
/** Accepts number, null (clear), or undefined (omit). Rejects non-integer negatives. */
function parseOptionalNonNegInt(value, fieldName) {
    if (value === undefined)
        return { ok: true, value: undefined };
    if (value === null || value === "")
        return { ok: true, value: null };
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return {
            ok: false,
            message: `${fieldName} must be a non-negative integer or null`,
        };
    }
    return { ok: true, value: n };
}
function parseOptionalRemark(value) {
    if (value === undefined)
        return { ok: true, value: undefined };
    if (value === null)
        return { ok: true, value: null };
    if (typeof value !== "string") {
        return { ok: false, message: "Remark must be a string or null" };
    }
    const trimmed = value.trim();
    if (trimmed.length > exports.REMARKS_MAX_LENGTH) {
        return {
            ok: false,
            message: `Remark must be at most ${exports.REMARKS_MAX_LENGTH} characters`,
        };
    }
    return { ok: true, value: trimmed === "" ? null : trimmed };
}
function parseDailyStockStatusBody(body) {
    const tallyQty = parseOptionalNonNegInt(body.tallyQuantity, "tallyQuantity");
    if (!tallyQty.ok)
        return tallyQty;
    const dmsQty = parseOptionalNonNegInt(body.dmsQuantity, "dmsQuantity");
    if (!dmsQty.ok)
        return dmsQty;
    const allocation = parseOptionalNonNegInt(body.allocation, "allocation");
    if (!allocation.ok)
        return allocation;
    const dip = parseOptionalNonNegInt(body.dip, "dip");
    if (!dip.ok)
        return dip;
    const pendingQuantity = parseOptionalNonNegInt(body.pendingQuantity, "pendingQuantity");
    if (!pendingQuantity.ok)
        return pendingQuantity;
    const arsQuantity = parseOptionalNonNegInt(body.arsQuantity, "arsQuantity");
    if (!arsQuantity.ok)
        return arsQuantity;
    const manualOrderQuantity = parseOptionalNonNegInt(body.manualOrderQuantity, "manualOrderQuantity");
    if (!manualOrderQuantity.ok)
        return manualOrderQuantity;
    const requirement = parseOptionalNonNegInt(body.requirement, "requirement");
    if (!requirement.ok)
        return requirement;
    const tallyRemark = parseOptionalRemark(body.tallyRemark);
    if (!tallyRemark.ok)
        return tallyRemark;
    const dmsRemark = parseOptionalRemark(body.dmsRemark);
    if (!dmsRemark.ok)
        return dmsRemark;
    const patch = {};
    if (tallyQty.value !== undefined)
        patch.tallyQuantity = tallyQty.value;
    if (dmsQty.value !== undefined)
        patch.dmsQuantity = dmsQty.value;
    if (allocation.value !== undefined)
        patch.allocation = allocation.value;
    if (dip.value !== undefined)
        patch.dip = dip.value;
    if (pendingQuantity.value !== undefined) {
        patch.pendingQuantity = pendingQuantity.value;
    }
    if (arsQuantity.value !== undefined)
        patch.arsQuantity = arsQuantity.value;
    if (manualOrderQuantity.value !== undefined) {
        patch.manualOrderQuantity = manualOrderQuantity.value;
    }
    if (requirement.value !== undefined)
        patch.requirement = requirement.value;
    if (tallyRemark.value !== undefined)
        patch.tallyRemark = tallyRemark.value;
    if (dmsRemark.value !== undefined)
        patch.dmsRemark = dmsRemark.value;
    if (Object.keys(patch).length === 0) {
        return {
            ok: false,
            message: "Provide at least one of tallyQuantity, tallyRemark, dmsQuantity, dmsRemark, allocation, dip, pendingQuantity, arsQuantity, manualOrderQuantity, requirement",
        };
    }
    return { ok: true, patch };
}
function buildUpsertData(patch, now) {
    const data = { ...patch };
    if (patch.tallyQuantity !== undefined) {
        data.tallyQtyUpdatedAt = now;
    }
    if (patch.dmsQuantity !== undefined) {
        data.dmsQtyUpdatedAt = now;
    }
    return data;
}
async function upsertDailyStockStatus(args) {
    const { snapshotDate } = dailyStockStatusDayBounds(args.dateStr);
    const now = new Date();
    const data = buildUpsertData(args.patch, now);
    return prisma_1.prisma.dailyStockStatus.upsert({
        where: {
            snapshotDate_productId: {
                snapshotDate,
                productId: args.productId,
            },
        },
        create: {
            snapshotDate,
            productId: args.productId,
            ...args.patch,
            ...(args.patch.tallyQuantity !== undefined
                ? { tallyQtyUpdatedAt: now }
                : {}),
            ...(args.patch.dmsQuantity !== undefined
                ? { dmsQtyUpdatedAt: now }
                : {}),
        },
        update: data,
        select: {
            productId: true,
            ...exports.DAILY_STOCK_STATUS_FIELD_SELECT,
        },
    });
}
async function fetchDailyStockStatusByProduct(dateStr) {
    const { dayStart, dayEnd } = dailyStockStatusDayBounds(dateStr);
    const rows = await prisma_1.prisma.dailyStockStatus.findMany({
        where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
        select: {
            productId: true,
            snapshotDate: true,
            ...exports.DAILY_STOCK_STATUS_FIELD_SELECT,
        },
    });
    // Prefer canonical midnight; otherwise earliest (mirrors opening stock pick).
    const byProduct = new Map();
    const canonicalMs = dayStart.getTime();
    for (const row of rows) {
        const fields = mapDailyStockStatusFields(row);
        const existing = byProduct.get(row.productId);
        if (!existing) {
            byProduct.set(row.productId, { snapshotDate: row.snapshotDate, fields });
            continue;
        }
        const rowIsCanonical = row.snapshotDate.getTime() === canonicalMs;
        const existingIsCanonical = existing.snapshotDate.getTime() === canonicalMs;
        if (rowIsCanonical && !existingIsCanonical) {
            byProduct.set(row.productId, { snapshotDate: row.snapshotDate, fields });
            continue;
        }
        if (!existingIsCanonical &&
            row.snapshotDate.getTime() < existing.snapshotDate.getTime()) {
            byProduct.set(row.productId, { snapshotDate: row.snapshotDate, fields });
        }
    }
    const result = new Map();
    for (const [productId, entry] of byProduct) {
        result.set(productId, entry.fields);
    }
    return result;
}
//# sourceMappingURL=dailyStockStatus.js.map