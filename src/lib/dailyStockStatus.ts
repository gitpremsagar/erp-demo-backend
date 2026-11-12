import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { istDayEnd, istDayStart } from "./schemeDates";

export const DAILY_STOCK_STATUS_NUMBER_FIELDS = [
  "allocation",
  "dip",
  "pendingQuantity",
  "arsQuantity",
  "manualOrderQuantity",
  "requirement",
  "tallyQuantity",
  "dmsQuantity",
] as const;

export const DAILY_STOCK_STATUS_TEXT_FIELDS = [
  "tallyRemark",
  "dmsRemark",
] as const;

export type DailyStockStatusNumberField =
  (typeof DAILY_STOCK_STATUS_NUMBER_FIELDS)[number];
export type DailyStockStatusTextField =
  (typeof DAILY_STOCK_STATUS_TEXT_FIELDS)[number];

export const REMARKS_MAX_LENGTH = 500;

export type DailyStockStatusFields = {
  allocation: number | null;
  dip: number | null;
  pendingQuantity: number | null;
  arsQuantity: number | null;
  manualOrderQuantity: number | null;
  requirement: number | null;
  tallyQuantity: number | null;
  tallyRemark: string | null;
  dmsQuantity: number | null;
  dmsRemark: string | null;
};

export const EMPTY_DAILY_STOCK_STATUS_FIELDS: DailyStockStatusFields = {
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

export const DAILY_STOCK_STATUS_FIELD_SELECT = {
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
} as const;

export function toNullableInt(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

export function toNullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function mapDailyStockStatusFields(
  row: Partial<DailyStockStatusFields> | null | undefined
): DailyStockStatusFields {
  if (!row) return { ...EMPTY_DAILY_STOCK_STATUS_FIELDS };
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

export function dailyStockStatusDayBounds(dateStr: string): {
  dayStart: Date;
  dayEnd: Date;
  snapshotDate: Date;
} {
  const dayStart = istDayStart(dateStr);
  return {
    dayStart,
    dayEnd: istDayEnd(dateStr),
    snapshotDate: dayStart,
  };
}

export type ParseResult<T> =
  | { ok: true; value: T | undefined }
  | { ok: false; message: string };

/** Accepts number, null (clear), or undefined (omit). Rejects non-integer negatives. */
export function parseOptionalNonNegInt(
  value: unknown,
  fieldName: string
): ParseResult<number | null> {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    return {
      ok: false,
      message: `${fieldName} must be a non-negative integer or null`,
    };
  }
  return { ok: true, value: n };
}

export function parseOptionalRemark(value: unknown): ParseResult<string | null> {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, message: "Remark must be a string or null" };
  }
  const trimmed = value.trim();
  if (trimmed.length > REMARKS_MAX_LENGTH) {
    return {
      ok: false,
      message: `Remark must be at most ${REMARKS_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed === "" ? null : trimmed };
}

export type DailyStockStatusPatch = {
  allocation?: number | null;
  dip?: number | null;
  pendingQuantity?: number | null;
  arsQuantity?: number | null;
  manualOrderQuantity?: number | null;
  requirement?: number | null;
  tallyQuantity?: number | null;
  tallyRemark?: string | null;
  dmsQuantity?: number | null;
  dmsRemark?: string | null;
};

export function parseDailyStockStatusBody(
  body: Record<string, unknown>
): { ok: true; patch: DailyStockStatusPatch } | { ok: false; message: string } {
  const tallyQty = parseOptionalNonNegInt(body.tallyQuantity, "tallyQuantity");
  if (!tallyQty.ok) return tallyQty;
  const dmsQty = parseOptionalNonNegInt(body.dmsQuantity, "dmsQuantity");
  if (!dmsQty.ok) return dmsQty;
  const allocation = parseOptionalNonNegInt(body.allocation, "allocation");
  if (!allocation.ok) return allocation;
  const dip = parseOptionalNonNegInt(body.dip, "dip");
  if (!dip.ok) return dip;
  const pendingQuantity = parseOptionalNonNegInt(
    body.pendingQuantity,
    "pendingQuantity"
  );
  if (!pendingQuantity.ok) return pendingQuantity;
  const arsQuantity = parseOptionalNonNegInt(body.arsQuantity, "arsQuantity");
  if (!arsQuantity.ok) return arsQuantity;
  const manualOrderQuantity = parseOptionalNonNegInt(
    body.manualOrderQuantity,
    "manualOrderQuantity"
  );
  if (!manualOrderQuantity.ok) return manualOrderQuantity;
  const requirement = parseOptionalNonNegInt(body.requirement, "requirement");
  if (!requirement.ok) return requirement;
  const tallyRemark = parseOptionalRemark(body.tallyRemark);
  if (!tallyRemark.ok) return tallyRemark;
  const dmsRemark = parseOptionalRemark(body.dmsRemark);
  if (!dmsRemark.ok) return dmsRemark;

  const patch: DailyStockStatusPatch = {};
  if (tallyQty.value !== undefined) patch.tallyQuantity = tallyQty.value;
  if (dmsQty.value !== undefined) patch.dmsQuantity = dmsQty.value;
  if (allocation.value !== undefined) patch.allocation = allocation.value;
  if (dip.value !== undefined) patch.dip = dip.value;
  if (pendingQuantity.value !== undefined) {
    patch.pendingQuantity = pendingQuantity.value;
  }
  if (arsQuantity.value !== undefined) patch.arsQuantity = arsQuantity.value;
  if (manualOrderQuantity.value !== undefined) {
    patch.manualOrderQuantity = manualOrderQuantity.value;
  }
  if (requirement.value !== undefined) patch.requirement = requirement.value;
  if (tallyRemark.value !== undefined) patch.tallyRemark = tallyRemark.value;
  if (dmsRemark.value !== undefined) patch.dmsRemark = dmsRemark.value;

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      message:
        "Provide at least one of tallyQuantity, tallyRemark, dmsQuantity, dmsRemark, allocation, dip, pendingQuantity, arsQuantity, manualOrderQuantity, requirement",
    };
  }

  return { ok: true, patch };
}

function buildUpsertData(patch: DailyStockStatusPatch, now: Date) {
  const data: Prisma.DailyStockStatusUpdateInput = { ...patch };
  if (patch.tallyQuantity !== undefined) {
    data.tallyQtyUpdatedAt = now;
  }
  if (patch.dmsQuantity !== undefined) {
    data.dmsQtyUpdatedAt = now;
  }
  return data;
}

export async function upsertDailyStockStatus(args: {
  dateStr: string;
  productId: string;
  patch: DailyStockStatusPatch;
}) {
  const { snapshotDate } = dailyStockStatusDayBounds(args.dateStr);
  const now = new Date();
  const data = buildUpsertData(args.patch, now);

  return prisma.dailyStockStatus.upsert({
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
      ...DAILY_STOCK_STATUS_FIELD_SELECT,
    },
  });
}

export async function fetchDailyStockStatusByProduct(
  dateStr: string
): Promise<Map<string, DailyStockStatusFields>> {
  const { dayStart, dayEnd } = dailyStockStatusDayBounds(dateStr);
  const rows = await prisma.dailyStockStatus.findMany({
    where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
    select: {
      productId: true,
      snapshotDate: true,
      ...DAILY_STOCK_STATUS_FIELD_SELECT,
    },
  });

  // Prefer canonical midnight; otherwise earliest (mirrors opening stock pick).
  const byProduct = new Map<
    string,
    { snapshotDate: Date; fields: DailyStockStatusFields }
  >();
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
    if (
      !existingIsCanonical &&
      row.snapshotDate.getTime() < existing.snapshotDate.getTime()
    ) {
      byProduct.set(row.productId, { snapshotDate: row.snapshotDate, fields });
    }
  }

  const result = new Map<string, DailyStockStatusFields>();
  for (const [productId, entry] of byProduct) {
    result.set(productId, entry.fields);
  }
  return result;
}
