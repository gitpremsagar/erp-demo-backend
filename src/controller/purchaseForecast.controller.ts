import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { isIstYmd } from "../lib/openingStockSnapshot";
import {
  istMonthBounds,
  istMonthShortLabel,
  isIstYearMonth,
  toIstYearMonthFromYmd,
} from "../lib/schemeDates";
import { loadPurchaseForecastWorkbook } from "../lib/purchaseForecastWorkbook";

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

async function billedQuantityByProductForMonth(
  monthStart: Date,
  monthEnd: Date
): Promise<Map<string, number>> {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      invoiceDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      PurchaseInvoiceItem: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });

  const billed = new Map<string, number>();
  for (const inv of invoices) {
    for (const item of inv.PurchaseInvoiceItem) {
      const qty = item.quantity ?? 0;
      billed.set(item.productId, (billed.get(item.productId) ?? 0) + qty);
    }
  }
  return billed;
}

function parseForecastQuantity(
  raw: unknown
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return {
      ok: false,
      message: "forecastQuantity must be a non-negative integer or null",
    };
  }
  return { ok: true, value: n };
}

/**
 * GET /api/purchase-forecast/monthly?date=YYYY-MM-DD
 */
export const getMonthlyPurchaseForecast = async (req: Request, res: Response) => {
  try {
    const dateStr = (req.query.date as string)?.trim();
    if (!dateStr) {
      return res
        .status(400)
        .json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
    }
    if (!isIstYmd(dateStr)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }

    const yearMonth = toIstYearMonthFromYmd(dateStr);
    const { monthStart, monthEnd } = istMonthBounds(yearMonth);

    const [products, forecasts, billedByProduct] = await Promise.all([
      prisma.product.findMany({
        select: { id: true },
        orderBy: { productCode: "asc" },
      }),
      prisma.productMonthlyPurchaseForecast.findMany({
        where: { yearMonth },
        select: { productId: true, forecastQuantity: true },
      }),
      billedQuantityByProductForMonth(monthStart, monthEnd),
    ]);

    const forecastByProduct = new Map(
      forecasts.map((f) => [f.productId, f.forecastQuantity ?? null])
    );

    const rows = products.map((p) => {
      const forecastQuantity = forecastByProduct.get(p.id) ?? null;
      const billedQuantity = billedByProduct.get(p.id) ?? 0;
      const dueQuantity =
        forecastQuantity === null || forecastQuantity === undefined
          ? null
          : forecastQuantity - billedQuantity;
      return {
        productId: p.id,
        forecastQuantity,
        billedQuantity,
        dueQuantity,
      };
    });

    res.json({
      date: dateStr,
      yearMonth,
      monthLabel: istMonthShortLabel(yearMonth),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      rows,
    });
  } catch (error) {
    console.error("Error fetching monthly purchase forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/purchase-forecast/monthly
 * Body: { date: YYYY-MM-DD, productId, forecastQuantity: number | null }
 */
export const upsertMonthlyPurchaseForecast = async (
  req: Request,
  res: Response
) => {
  try {
    const dateStr = (req.body?.date as string)?.trim();
    const productId = (req.body?.productId as string)?.trim();
    const parsed = parseForecastQuantity(req.body?.forecastQuantity);

    if (!dateStr) {
      return res
        .status(400)
        .json({ message: "Body field 'date' (YYYY-MM-DD) is required" });
    }
    if (!isIstYmd(dateStr)) {
      return res.status(400).json({ message: "date must be YYYY-MM-DD" });
    }
    if (!productId || !OBJECT_ID_RE.test(productId)) {
      return res.status(400).json({ message: "Valid productId is required" });
    }
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }
    const forecastQuantity = parsed.value;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const yearMonth = toIstYearMonthFromYmd(dateStr);
    const { monthStart, monthEnd } = istMonthBounds(yearMonth);

    const row = await prisma.productMonthlyPurchaseForecast.upsert({
      where: {
        productId_yearMonth: { productId, yearMonth },
      },
      create: {
        productId,
        yearMonth,
        forecastQuantity,
      },
      update: { forecastQuantity },
      select: {
        productId: true,
        yearMonth: true,
        forecastQuantity: true,
      },
    });

    const billedByProduct = await billedQuantityByProductForMonth(
      monthStart,
      monthEnd
    );
    const billedQuantity = billedByProduct.get(productId) ?? 0;
    const dueQuantity =
      row.forecastQuantity === null || row.forecastQuantity === undefined
        ? null
        : row.forecastQuantity - billedQuantity;

    res.json({
      date: dateStr,
      yearMonth,
      monthLabel: istMonthShortLabel(yearMonth),
      productId: row.productId,
      forecastQuantity: row.forecastQuantity ?? null,
      billedQuantity,
      dueQuantity,
    });
  } catch (error) {
    console.error("Error upserting monthly purchase forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/purchase-forecast/workbook?yearMonth=YYYY-MM
 * Also accepts date=YYYY-MM-DD and derives the IST month.
 */
export const getPurchaseForecastWorkbook = async (
  req: Request,
  res: Response
) => {
  try {
    const yearMonthRaw = (req.query.yearMonth as string)?.trim();
    const dateRaw = (req.query.date as string)?.trim();

    let yearMonth = yearMonthRaw;
    if (!yearMonth && dateRaw) {
      if (!isIstYmd(dateRaw)) {
        return res.status(400).json({ message: "date must be YYYY-MM-DD" });
      }
      yearMonth = toIstYearMonthFromYmd(dateRaw);
    }
    if (!yearMonth) {
      return res.status(400).json({
        message:
          "Query parameter 'yearMonth' (YYYY-MM) or 'date' (YYYY-MM-DD) is required",
      });
    }
    if (!isIstYearMonth(yearMonth)) {
      return res.status(400).json({ message: "yearMonth must be YYYY-MM" });
    }

    const workbook = await loadPurchaseForecastWorkbook(yearMonth);
    res.json(workbook);
  } catch (error) {
    console.error("Error fetching purchase forecast workbook:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
