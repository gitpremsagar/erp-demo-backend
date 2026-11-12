import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { istDayEnd, istDayStart, toIstYmd } from "../lib/schemeDates";
import {
  fetchLiveBatchSumByProduct,
  isIstYmd,
  pickOpeningByProduct,
  rebuildRecentOpeningStockSnapshots,
  reconcileTodayOpeningClosing,
  replaceOpeningStockSnapshotForIstDay,
} from "../lib/openingStockSnapshot";
import {
  EMPTY_DAILY_STOCK_STATUS_FIELDS,
  REMARKS_MAX_LENGTH,
  dailyStockStatusDayBounds,
  fetchDailyStockStatusByProduct,
  mapDailyStockStatusFields,
  parseDailyStockStatusBody,
  upsertDailyStockStatus,
  type DailyStockStatusFields,
  type DailyStockStatusPatch,
} from "../lib/dailyStockStatus";
import { buildDailyStockReportRows } from "../lib/dailyStockReport";

/** @deprecated Prefer DailyStockStatusFields — kept for import compatibility. */
export type ProductCurrentStock = DailyStockStatusFields;

const OPENING_STOCK_NOT_RECORDED_MESSAGE =
  "Opening stock has not been recorded for this date. Record opening stock before bulk update.";

/** Start/end of an IST calendar day for a YYYY-MM-DD string. */
function getDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = istDayStart(dateStr);
  const dayEnd = istDayEnd(dateStr);
  return { dayStart, dayEnd };
}

async function countOpeningStockForDate(dayStart: Date, dayEnd: Date): Promise<number> {
  return prisma.openingStock.count({
    where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
  });
}

type BulkTemplateRow = {
  productId: string;
  productName: string;
  productCode: string;
  mrp: number | null;
  openingStock: number;
  inwardQuantity: number;
  outwardQuantity: number;
  closingStock: number;
} & DailyStockStatusFields;

async function buildBulkTemplateRows(dateStr: string): Promise<BulkTemplateRow[]> {
  const { dayStart, dayEnd } = getDayBounds(dateStr);

  const [openingRows, dailyByProduct] = await Promise.all([
    prisma.openingStock.findMany({
      where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
      select: {
        productId: true,
        quantity: true,
        snapshotDate: true,
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            mrp: true,
          },
        },
      },
    }),
    fetchDailyStockStatusByProduct(dateStr),
  ]);

  const openingQtyByProduct = pickOpeningByProduct(openingRows, dayStart);
  const openingByProduct = new Map<
    string,
    {
      quantity: number;
      product: {
        id: string;
        name: string;
        productCode: string;
        mrp: number | null;
      };
    }
  >();
  for (const r of openingRows) {
    if (openingByProduct.has(r.productId)) continue;
    openingByProduct.set(r.productId, {
      quantity: openingQtyByProduct.get(r.productId) ?? r.quantity,
      product: r.Product,
    });
  }

  const productIds = [...openingByProduct.keys()];
  if (productIds.length === 0) {
    return [];
  }

  const isToday = dateStr === toIstYmd(new Date());
  const [inwardAgg, outwardAgg, liveByProduct] = await Promise.all([
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        changeType: "INCREASE",
        changeDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { changeInStock: true },
    }),
    prisma.stockRecord.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        changeType: "DECREASE",
        changeDate: { gte: dayStart, lte: dayEnd },
      },
      _sum: { changeInStock: true },
    }),
    isToday ? fetchLiveBatchSumByProduct() : Promise.resolve(null),
  ]);

  const inwardByProduct = new Map(
    inwardAgg.map((r) => [r.productId, r._sum.changeInStock ?? 0])
  );
  const outwardByProduct = new Map(
    outwardAgg.map((r) => [r.productId, Math.abs(r._sum.changeInStock ?? 0)])
  );

  const rows: BulkTemplateRow[] = [];
  for (const [productId, entry] of openingByProduct) {
    const inward = inwardByProduct.get(productId) ?? 0;
    const outward = outwardByProduct.get(productId) ?? 0;
    let opening = entry.quantity;
    let closing = opening + inward - outward;
    if (liveByProduct) {
      const reconciled = reconcileTodayOpeningClosing({
        opening,
        inward,
        outward,
        liveBatchSum: liveByProduct.get(productId) ?? 0,
      });
      opening = reconciled.opening;
      closing = reconciled.closing;
    }
    const current =
      dailyByProduct.get(productId) ?? { ...EMPTY_DAILY_STOCK_STATUS_FIELDS };
    rows.push({
      productId,
      productName: entry.product.name,
      productCode: entry.product.productCode,
      mrp: entry.product.mrp,
      openingStock: opening,
      inwardQuantity: inward,
      outwardQuantity: outward,
      closingStock: closing,
      ...current,
    });
  }

  rows.sort((a, b) => a.productCode.localeCompare(b.productCode));
  return rows;
}

function parseOptionalNonNegativeInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  return undefined;
}

type BulkUpdateInputRow = {
  productCode?: string;
  productName?: string;
  allocation?: number;
  dip?: number;
  pendingQuantity?: number;
  arsQuantity?: number;
  manualOrderQuantity?: number;
  requirement?: number;
  tallyQuantity?: number;
  tallyRemark?: string | null;
  remarks?: string | null;
  dmsQuantity?: number;
  dmsRemark?: string | null;
};

type ProductLookup = { id: string; productCode: string; name: string };

function buildProductLookupMaps(products: ProductLookup[]) {
  const productByCode = new Map<string, ProductLookup>();
  const productByName = new Map<string, ProductLookup | "ambiguous">();

  for (const p of products) {
    productByCode.set(p.productCode.trim().toLowerCase(), p);
    productByCode.set(p.productCode.trim(), p);

    const nameKey = p.name.trim().toLowerCase();
    const existing = productByName.get(nameKey);
    if (existing === "ambiguous" || (existing && existing.id !== p.id)) {
      productByName.set(nameKey, "ambiguous");
    } else {
      productByName.set(nameKey, p);
    }
  }

  return { productByCode, productByName };
}

function resolveProductForBulkRow(
  row: BulkUpdateInputRow,
  productByCode: Map<string, ProductLookup>,
  productByName: Map<string, ProductLookup | "ambiguous">
): { product: ProductLookup | null; reason?: string } {
  const productCode = (row.productCode ?? "").trim();
  const productName = (row.productName ?? "").trim();

  if (!productCode && !productName) {
    return { product: null, reason: "Product code or product name is required" };
  }

  if (productCode) {
    const byCode =
      productByCode.get(productCode) ?? productByCode.get(productCode.toLowerCase());
    if (byCode) return { product: byCode };
    if (!productName) {
      return { product: null, reason: "Unknown product code" };
    }
  }

  if (productName) {
    const byName = productByName.get(productName.toLowerCase());
    if (byName === "ambiguous") {
      return { product: null, reason: "Multiple products match this name; use product code" };
    }
    if (byName) return { product: byName };
    return {
      product: null,
      reason: productCode ? "Unknown product code and product name" : "Unknown product name",
    };
  }

  return { product: null, reason: "Unknown product code" };
}

/**
 * Internal: record opening stock. Used by HTTP handler and by local cron.
 * Rebuilds true start-of-day openings for the last OPENING_STOCK_RECALC_DAYS IST days.
 */
export async function recordOpeningStockForDate(
  snapshotDate: Date = new Date()
): Promise<{ productCount: number; dates: string[] }> {
  return rebuildRecentOpeningStockSnapshots(snapshotDate);
}

/**
 * Record opening stock (default: last N IST days through today).
 * Optional query/body `date=YYYY-MM-DD` rebuilds that single IST day.
 */
export const recordCurrentStockWithDate = async (req: Request, res: Response) => {
  try {
    const raw = ((req.query.date as string) || req.body?.date)?.trim();
    if (raw) {
      if (!isIstYmd(raw)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      const { productCount } = await replaceOpeningStockSnapshotForIstDay(raw);
      return res.json({
        message: "Opening stock recorded successfully",
        date: raw,
        dates: [raw],
        productCount,
      });
    }

    const { dates, productCount } = await rebuildRecentOpeningStockSnapshots();
    return res.json({
      message: "Opening stock recorded successfully",
      date: dates[dates.length - 1],
      dates,
      productCount,
    });
  } catch (error) {
    console.error("Error recording opening stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/opening-stock/report?date=YYYY-MM-DD
 * Returns for the selected date, per product: openingStock, inwardQuantity, outwardQuantity, closingStock, onPassageQuantity.
 * closingStock = openingStock + inwardQuantity - outwardQuantity.
 * onPassageQuantity = current qty on active purchases not yet added to stock (not date-scoped).
 */
export const getDailyStockReport = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string)?.trim();
    if (!dateStr) {
      return res.status(400).json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
    }
    const { date, dayStart, dayEnd, rows } = await buildDailyStockReportRows(dateStr);
    res.json({
      date,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      rows,
    });
  } catch (error) {
    console.error("Error fetching daily stock report:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * GET /api/opening-stock/bulk-update-template?date=YYYY-MM-DD
 */
export const getBulkUpdateTemplate = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string)?.trim();
    if (!dateStr) {
      return res.status(400).json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
    }

    const { dayStart, dayEnd } = getDayBounds(dateStr);
    const count = await countOpeningStockForDate(dayStart, dayEnd);
    if (count === 0) {
      return res.status(400).json({ message: OPENING_STOCK_NOT_RECORDED_MESSAGE });
    }

    const rows = await buildBulkTemplateRows(dateStr);
    res.json({
      date: dateStr,
      openingStockRecorded: true,
      rows,
    });
  } catch (error) {
    console.error("Error fetching bulk update template:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/opening-stock/bulk-update-fields
 */
export const bulkUpdateOpeningStockFields = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.body?.date as string)?.trim();
    const inputRows = req.body?.rows as BulkUpdateInputRow[] | undefined;

    if (!dateStr) {
      return res.status(400).json({ message: "Body field 'date' (YYYY-MM-DD) is required" });
    }
    if (!Array.isArray(inputRows) || inputRows.length === 0) {
      return res.status(400).json({ message: "Body field 'rows' must be a non-empty array" });
    }

    const { dayStart, dayEnd } = getDayBounds(dateStr);
    const count = await countOpeningStockForDate(dayStart, dayEnd);
    if (count === 0) {
      return res.status(400).json({ message: OPENING_STOCK_NOT_RECORDED_MESSAGE });
    }

    const openingRows = await prisma.openingStock.findMany({
      where: { snapshotDate: { gte: dayStart, lte: dayEnd } },
      select: { productId: true },
    });
    const openingProductIds = new Set(openingRows.map((r) => r.productId));

    const errors: {
      row: number;
      productCode?: string;
      productName?: string;
      reason: string;
    }[] = [];

    const uniqueCodes = [
      ...new Set(
        inputRows.map((r) => (r.productCode ?? "").trim()).filter(Boolean)
      ),
    ];
    const uniqueNames = [
      ...new Set(
        inputRows.map((r) => (r.productName ?? "").trim()).filter(Boolean)
      ),
    ];

    if (uniqueCodes.length === 0 && uniqueNames.length === 0) {
      return res.status(400).json({
        message: "Bulk update validation failed",
        errors: inputRows.map((_, index) => ({
          row: index + 1,
          reason: "Product code or product name is required",
        })),
      });
    }

    const productWhere =
      uniqueCodes.length && uniqueNames.length
        ? {
            OR: [
              { productCode: { in: uniqueCodes } },
              { name: { in: uniqueNames } },
            ],
          }
        : uniqueCodes.length
          ? { productCode: { in: uniqueCodes } }
          : { name: { in: uniqueNames } };

    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, productCode: true, name: true },
    });
    const { productByCode, productByName } = buildProductLookupMaps(products);

    type BulkPatch = DailyStockStatusPatch;
    type ValidatedUpdate = {
      productId: string;
      productCode: string;
      patch: BulkPatch;
    };
    const validated: ValidatedUpdate[] = [];

    const parseRemarkField = (
      value: unknown,
      label: string
    ): { ok: true; value: string | null } | { ok: false; reason: string } => {
      if (value !== null && typeof value !== "string") {
        return { ok: false, reason: `${label} must be a string` };
      }
      const trimmed = value === null ? "" : value.trim();
      if (trimmed.length > REMARKS_MAX_LENGTH) {
        return {
          ok: false,
          reason: `${label} must be at most ${REMARKS_MAX_LENGTH} characters`,
        };
      }
      return { ok: true, value: trimmed === "" ? null : trimmed };
    };

    inputRows.forEach((row, index) => {
      const rowNum = index + 1;
      const productCode = (row.productCode ?? "").trim();
      const productName = (row.productName ?? "").trim();

      const { product, reason } = resolveProductForBulkRow(row, productByCode, productByName);
      if (!product) {
        errors.push({
          row: rowNum,
          ...(productCode ? { productCode } : {}),
          ...(productName ? { productName } : {}),
          reason: reason ?? "Product not found",
        });
        return;
      }
      if (!openingProductIds.has(product.id)) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "No opening stock record for this product on the selected date",
        });
        return;
      }

      const patch: BulkPatch = {};
      const allocation = parseOptionalNonNegativeInt(row.allocation);
      const dip = parseOptionalNonNegativeInt(row.dip);
      const pendingQuantity = parseOptionalNonNegativeInt(row.pendingQuantity);
      const arsQuantity = parseOptionalNonNegativeInt(row.arsQuantity);
      const manualOrderQuantity = parseOptionalNonNegativeInt(row.manualOrderQuantity);
      const requirement = parseOptionalNonNegativeInt(row.requirement);
      const tallyQuantity = parseOptionalNonNegativeInt(row.tallyQuantity);
      const dmsQuantity = parseOptionalNonNegativeInt(row.dmsQuantity);

      if (row.allocation !== undefined && allocation === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "Allocation must be a non-negative integer",
        });
        return;
      }
      if (row.dip !== undefined && dip === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "DIP must be a non-negative integer",
        });
        return;
      }
      if (row.pendingQuantity !== undefined && pendingQuantity === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "Pending Qty must be a non-negative integer",
        });
        return;
      }
      if (row.arsQuantity !== undefined && arsQuantity === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "ARS must be a non-negative integer",
        });
        return;
      }
      if (row.manualOrderQuantity !== undefined && manualOrderQuantity === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "Manual Order must be a non-negative integer",
        });
        return;
      }
      if (row.requirement !== undefined && requirement === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "Requirement must be a non-negative integer",
        });
        return;
      }
      if (row.tallyQuantity !== undefined && tallyQuantity === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "Tally Quantity must be a non-negative integer",
        });
        return;
      }
      if (row.dmsQuantity !== undefined && dmsQuantity === undefined) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason: "DMS Quantity must be a non-negative integer",
        });
        return;
      }

      const tallyRemarkSource =
        row.tallyRemark !== undefined ? row.tallyRemark : row.remarks;
      if (tallyRemarkSource !== undefined) {
        const parsed = parseRemarkField(tallyRemarkSource, "Tally Remark");
        if (!parsed.ok) {
          errors.push({
            row: rowNum,
            productCode: product.productCode,
            productName: product.name,
            reason: parsed.reason,
          });
          return;
        }
        patch.tallyRemark = parsed.value;
      }
      if (row.dmsRemark !== undefined) {
        const parsed = parseRemarkField(row.dmsRemark, "DMS Remark");
        if (!parsed.ok) {
          errors.push({
            row: rowNum,
            productCode: product.productCode,
            productName: product.name,
            reason: parsed.reason,
          });
          return;
        }
        patch.dmsRemark = parsed.value;
      }

      if (allocation !== undefined) patch.allocation = allocation;
      if (dip !== undefined) patch.dip = dip;
      if (pendingQuantity !== undefined) patch.pendingQuantity = pendingQuantity;
      if (arsQuantity !== undefined) patch.arsQuantity = arsQuantity;
      if (manualOrderQuantity !== undefined) {
        patch.manualOrderQuantity = manualOrderQuantity;
      }
      if (requirement !== undefined) patch.requirement = requirement;
      if (tallyQuantity !== undefined) patch.tallyQuantity = tallyQuantity;
      if (dmsQuantity !== undefined) patch.dmsQuantity = dmsQuantity;

      if (Object.keys(patch).length === 0) {
        errors.push({
          row: rowNum,
          productCode: product.productCode,
          productName: product.name,
          reason:
            "At least one of Allocation, DIP, Pending Qty, ARS, Manual Order, Requirement, Tally Quantity, Tally Remark, DMS Quantity, or DMS Remark must be provided",
        });
        return;
      }

      validated.push({ productId: product.id, productCode: product.productCode, patch });
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Bulk update validation failed",
        errors,
      });
    }

    const { snapshotDate } = dailyStockStatusDayBounds(dateStr);
    const now = new Date();
    await prisma.$transaction(
      validated.map((item) =>
        prisma.dailyStockStatus.upsert({
          where: {
            snapshotDate_productId: {
              snapshotDate,
              productId: item.productId,
            },
          },
          create: {
            snapshotDate,
            productId: item.productId,
            ...item.patch,
            ...(item.patch.tallyQuantity !== undefined
              ? { tallyQtyUpdatedAt: now }
              : {}),
            ...(item.patch.dmsQuantity !== undefined
              ? { dmsQtyUpdatedAt: now }
              : {}),
          },
          update: {
            ...item.patch,
            ...(item.patch.tallyQuantity !== undefined
              ? { tallyQtyUpdatedAt: now }
              : {}),
            ...(item.patch.dmsQuantity !== undefined
              ? { dmsQtyUpdatedAt: now }
              : {}),
          },
        })
      )
    );

    res.json({
      date: dateStr,
      updatedProductCount: validated.length,
    });
  } catch (error) {
    console.error("Error bulk updating opening stock fields:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/opening-stock/daily-fields
 * Body: { date: YYYY-MM-DD, productId, ...partial daily extras }
 * Creates or updates DailyStockStatus for that IST day.
 */
export const upsertDailyStockFields = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.body?.date as string)?.trim();
    const productId = (req.body?.productId as string)?.trim();

    if (!dateStr) {
      return res.status(400).json({ message: "Body field 'date' (YYYY-MM-DD) is required" });
    }
    if (!isIstYmd(dateStr)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }
    if (!productId || !OBJECT_ID_RE.test(productId)) {
      return res.status(400).json({ message: "Valid productId is required" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, productCode: true },
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const parsed = parseDailyStockStatusBody(req.body ?? {});
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }

    const row = await upsertDailyStockStatus({
      dateStr,
      productId,
      patch: parsed.patch,
    });

    res.json({
      date: dateStr,
      productId: row.productId,
      ...mapDailyStockStatusFields(row),
      tallyQtyUpdatedAt: row.tallyQtyUpdatedAt?.toISOString() ?? null,
      dmsQtyUpdatedAt: row.dmsQtyUpdatedAt?.toISOString() ?? null,
      product: {
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        ...mapDailyStockStatusFields(row),
        tallyQtyUpdatedAt: row.tallyQtyUpdatedAt,
        dmsQtyUpdatedAt: row.dmsQtyUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error upserting daily stock fields:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

function mapMovementRow(r: {
  id: string;
  changeType: "INCREASE" | "DECREASE" | null;
  changeInStock: number;
  reason: string;
  createdAt: Date;
  changeDate: Date | null;
  User: { name: string | null };
  StockBatch: { id: string; arrivalDate: Date; purchaseId: string | null };
  Order: {
    id: string;
    customeOrderId: string;
    orderDate: Date;
    Customer: { CustomerDetail: { dbName: string }[] };
  } | null;
}) {
  const when = r.changeDate ?? r.createdAt;
  const orderDbName = r.Order?.Customer?.CustomerDetail?.[0]?.dbName ?? null;
  return {
    id: r.id,
    changeType: r.changeType,
    changeInStock: r.changeInStock,
    reason: r.reason,
    changeDate: when.toISOString(),
    userName: r.User.name ?? "",
    stockBatchId: r.StockBatch.id,
    batchArrivalDate: r.StockBatch.arrivalDate.toISOString(),
    purchaseId: r.StockBatch.purchaseId ?? null,
    orderId: r.Order?.id ?? null,
    orderCustomId: r.Order?.customeOrderId ?? null,
    orderDbName,
    orderDate: r.Order?.orderDate?.toISOString() ?? null,
  };
}

/**
 * GET /api/opening-stock/report/movements?date=YYYY-MM-DD&productId=...
 * Line-level stock records for one product on that calendar day (filtered by changeDate for both inward and outward).
 */
export const getDailyStockMovements = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string)?.trim();
    const productId = (req.query.productId as string)?.trim();
    if (!dateStr) {
      return res.status(400).json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
    }
    if (!productId) {
      return res.status(400).json({ message: "Query parameter 'productId' is required" });
    }
    if (!OBJECT_ID_RE.test(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, productCode: true },
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const { dayStart, dayEnd } = getDayBounds(dateStr);

    const [inwardRecords, outwardRecords] = await Promise.all([
      prisma.stockRecord.findMany({
        where: {
          productId,
          changeDate: { gte: dayStart, lte: dayEnd },
          changeType: "INCREASE",
        },
        include: {
          User: { select: { name: true } },
          StockBatch: { select: { id: true, arrivalDate: true, purchaseId: true } },
          Order: {
            select: {
              id: true,
              customeOrderId: true,
              orderDate: true,
              Customer: { select: { CustomerDetail: { select: { dbName: true } } } },
            },
          },
        },
        orderBy: { changeDate: "asc" },
      }),
      prisma.stockRecord.findMany({
        where: {
          productId,
          changeDate: { gte: dayStart, lte: dayEnd },
          changeType: "DECREASE",
        },
        include: {
          User: { select: { name: true } },
          StockBatch: { select: { id: true, arrivalDate: true, purchaseId: true } },
          Order: {
            select: {
              id: true,
              customeOrderId: true,
              orderDate: true,
              Customer: { select: { CustomerDetail: { select: { dbName: true } } } },
            },
          },
        },
        orderBy: { changeDate: "asc" },
      }),
    ]);

    res.json({
      date: dateStr,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      inward: inwardRecords.map(mapMovementRow),
      outward: outwardRecords.map(mapMovementRow),
    });
  } catch (error) {
    console.error("Error fetching daily stock movements:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
