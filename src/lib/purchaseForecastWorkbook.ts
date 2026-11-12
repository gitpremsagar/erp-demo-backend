import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCompletedOrderFilter } from "./orderSaleAmount";
import {
  istMonthBounds,
  istMonthDayNumbers,
  istMonthShortLabel,
  isIstYearMonth,
  shiftIstYearMonth,
  toIstYmd,
} from "./schemeDates";
import {
  actualStockFromDailyRow,
  buildDailyStockReportRows,
} from "./dailyStockReport";

const ACTIVE_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  OR: [
    { isDiscontinued: false },
    { isDiscontinued: null },
    { isDiscontinued: { isSet: false } },
  ],
};

export type PurchaseForecastWorkbookRow = {
  productId: string;
  name: string;
  mrp: number;
  productCode: string;
  categoryName: string;
  subCategoryName: string;
  productGroupName: string;
  cartonsPerPallet: number | null;
  costPricePerCarton: number | null;
  positionSerialNumber: number | null;
  previousYearSale: number;
  previousMonthsSales: number[];
  suggestQty: number;
  actualStock: number;
  forecastQuantity: number | null;
  forecastPallets: number | null;
  actualPurchaseByDay: Record<string, number>;
  actualPurchaseTotal: number;
  balanceForecast: number | null;
};

export type PurchaseForecastWorkbook = {
  yearMonth: string;
  monthLabel: string;
  previousYearMonth: string;
  previousMonths: { yearMonth: string; label: string }[];
  actualPurchase: { yearMonth: string; days: number[]; labels: string[] };
  totals: { car: number; valueBasic: number };
  rows: PurchaseForecastWorkbookRow[];
};

function addQty(map: Map<string, number>, key: string, qty: number): void {
  if (!qty) return;
  map.set(key, (map.get(key) ?? 0) + qty);
}

function addQtyByMonth(
  map: Map<string, Map<string, number>>,
  key: string,
  yearMonth: string,
  qty: number
): void {
  if (!qty) return;
  let byMonth = map.get(key);
  if (!byMonth) {
    byMonth = new Map();
    map.set(key, byMonth);
  }
  byMonth.set(yearMonth, (byMonth.get(yearMonth) ?? 0) + qty);
}

function groupKeyFor(
  productId: string,
  groupIdByProduct: Map<string, string | null>
): string {
  return groupIdByProduct.get(productId) || productId;
}

function istYearMonthOf(date: Date): string {
  return toIstYmd(date).slice(0, 7);
}

export function cartonsToPallets(
  cartons: number | null,
  cartonsPerPallet: number | null
): number | null {
  if (cartons === null || cartons === undefined) return null;
  if (!cartonsPerPallet || cartonsPerPallet <= 0) return null;
  const pallets = cartons / cartonsPerPallet;
  return Number.isInteger(pallets) ? pallets : Math.round(pallets * 100) / 100;
}

export function palletsToCartons(
  pallets: number,
  cartonsPerPallet: number
): number {
  return pallets * cartonsPerPallet;
}

function suggestQtyFromPreviousMonths(sales: number[]): number {
  const lastThree = sales.slice(1, 4);
  const avg =
    lastThree.reduce((sum, n) => sum + n, 0) / Math.max(lastThree.length, 1);
  return Math.round(avg);
}

async function salesLinesForRange(
  rangeStart: Date,
  rangeEnd: Date,
  completedFilter: Awaited<ReturnType<typeof getCompletedOrderFilter>>
): Promise<{ productId: string; quantity: number; yearMonth: string }[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      Order: {
        ...completedFilter,
        orderDate: { gte: rangeStart, lte: rangeEnd },
      },
    },
    select: {
      productId: true,
      quantity: true,
      Order: { select: { orderDate: true } },
    },
  });

  const lines: { productId: string; quantity: number; yearMonth: string }[] =
    [];
  for (const item of items) {
    const orderDate = item.Order?.orderDate;
    if (!orderDate) continue;
    lines.push({
      productId: item.productId,
      quantity: item.quantity ?? 0,
      yearMonth: istYearMonthOf(orderDate),
    });
  }
  return lines;
}

async function purchaseQtyByProductByDay(
  yearMonth: string
): Promise<Map<string, Map<number, number>>> {
  const { monthStart, monthEnd } = istMonthBounds(yearMonth);
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { invoiceDate: { gte: monthStart, lte: monthEnd } },
    select: {
      invoiceDate: true,
      PurchaseInvoiceItem: {
        select: { productId: true, quantity: true },
      },
    },
  });

  const byProduct = new Map<string, Map<number, number>>();
  for (const inv of invoices) {
    if (!inv.invoiceDate) continue;
    const ymd = toIstYmd(inv.invoiceDate);
    if (!ymd.startsWith(yearMonth)) continue;
    const day = Number(ymd.slice(8, 10));
    if (!Number.isFinite(day) || day < 1) continue;
    for (const item of inv.PurchaseInvoiceItem) {
      const qty = item.quantity ?? 0;
      if (!qty) continue;
      let byDay = byProduct.get(item.productId);
      if (!byDay) {
        byDay = new Map();
        byProduct.set(item.productId, byDay);
      }
      byDay.set(day, (byDay.get(day) ?? 0) + qty);
    }
  }
  return byProduct;
}

export async function loadPurchaseForecastWorkbook(
  yearMonth: string
): Promise<PurchaseForecastWorkbook> {
  if (!isIstYearMonth(yearMonth)) {
    throw new Error("yearMonth must be YYYY-MM");
  }

  const previousMonths = [4, 3, 2, 1].map((delta) => {
    const key = shiftIstYearMonth(yearMonth, -delta);
    return { yearMonth: key, label: istMonthShortLabel(key) };
  });
  const previousYearMonth = shiftIstYearMonth(yearMonth, -12);
  const purchaseMonth = yearMonth;
  const purchaseDays = istMonthDayNumbers(purchaseMonth);

  const salesWindowStart = istMonthBounds(previousMonths[0].yearMonth)
    .monthStart;
  const salesWindowEnd = istMonthBounds(previousMonths[3].yearMonth).monthEnd;
  const prevYearBounds = istMonthBounds(previousYearMonth);
  const todayYmd = toIstYmd(new Date());

  const completedFilter = await getCompletedOrderFilter();

  const [
    products,
    productGroupIds,
    forecasts,
    salesRecent,
    salesPrevYear,
    purchaseByProduct,
    stockReport,
  ] = await Promise.all([
    prisma.product.findMany({
      where: ACTIVE_PRODUCT_WHERE,
      select: {
        id: true,
        name: true,
        mrp: true,
        productCode: true,
        productGroupId: true,
        cartonsPerPallet: true,
        costPricePerCarton: true,
        positionSerialNumber: true,
        Category: { select: { name: true, position: true } },
        SubCategory: { select: { name: true } },
        ProductGroup: { select: { name: true } },
      },
      orderBy: [{ positionSerialNumber: "asc" }, { productCode: "asc" }],
    }),
    prisma.product.findMany({
      select: { id: true, productGroupId: true },
    }),
    prisma.productMonthlyPurchaseForecast.findMany({
      where: { yearMonth },
      select: { productId: true, forecastQuantity: true },
    }),
    salesLinesForRange(salesWindowStart, salesWindowEnd, completedFilter),
    salesLinesForRange(
      prevYearBounds.monthStart,
      prevYearBounds.monthEnd,
      completedFilter
    ),
    purchaseQtyByProductByDay(purchaseMonth),
    buildDailyStockReportRows(todayYmd),
  ]);

  const forecastByProduct = new Map(
    forecasts.map((f) => [f.productId, f.forecastQuantity ?? null])
  );

  const groupIdByProduct = new Map(
    productGroupIds.map((p) => [p.id, p.productGroupId ?? null])
  );

  const recentSalesByGroup = new Map<string, Map<string, number>>();
  for (const line of salesRecent) {
    addQtyByMonth(
      recentSalesByGroup,
      groupKeyFor(line.productId, groupIdByProduct),
      line.yearMonth,
      line.quantity
    );
  }

  const prevYearSaleByGroup = new Map<string, number>();
  for (const line of salesPrevYear) {
    addQty(
      prevYearSaleByGroup,
      groupKeyFor(line.productId, groupIdByProduct),
      line.quantity
    );
  }

  const actualStockByProduct = new Map<string, number>();
  for (const row of stockReport.rows) {
    actualStockByProduct.set(row.productId, actualStockFromDailyRow(row));
  }

  const rows: PurchaseForecastWorkbookRow[] = products.map((p) => {
    const groupKey = p.productGroupId || p.id;
    const previousMonthsSales = previousMonths.map(
      (m) => recentSalesByGroup.get(groupKey)?.get(m.yearMonth) ?? 0
    );
    const forecastQuantity = forecastByProduct.get(p.id) ?? null;
    const byDay = purchaseByProduct.get(p.id);
    const actualPurchaseByDay: Record<string, number> = {};
    let actualPurchaseTotal = 0;
    if (byDay) {
      for (const [day, qty] of byDay) {
        actualPurchaseByDay[String(day)] = qty;
        actualPurchaseTotal += qty;
      }
    }
    return {
      productId: p.id,
      name: p.name,
      mrp: p.mrp,
      productCode: p.productCode,
      categoryName: p.Category?.name ?? "",
      subCategoryName: p.SubCategory?.name ?? "",
      productGroupName: p.ProductGroup?.name ?? "",
      cartonsPerPallet: p.cartonsPerPallet ?? null,
      costPricePerCarton: p.costPricePerCarton ?? null,
      positionSerialNumber: p.positionSerialNumber ?? null,
      previousYearSale: prevYearSaleByGroup.get(groupKey) ?? 0,
      previousMonthsSales,
      suggestQty: suggestQtyFromPreviousMonths(previousMonthsSales),
      actualStock: actualStockByProduct.get(p.id) ?? 0,
      forecastQuantity,
      forecastPallets: cartonsToPallets(
        forecastQuantity,
        p.cartonsPerPallet ?? null
      ),
      actualPurchaseByDay,
      actualPurchaseTotal,
      balanceForecast:
        forecastQuantity === null ? null : forecastQuantity - actualPurchaseTotal,
    };
  });

  let car = 0;
  let valueBasic = 0;
  for (const row of rows) {
    const qty = row.forecastQuantity ?? 0;
    car += qty;
    valueBasic += qty * (row.costPricePerCarton ?? 0);
  }

  return {
    yearMonth,
    monthLabel: istMonthShortLabel(yearMonth),
    previousYearMonth,
    previousMonths,
    actualPurchase: {
      yearMonth: purchaseMonth,
      days: purchaseDays,
      labels: purchaseDays.map((d) => String(d).padStart(2, "0")),
    },
    totals: { car, valueBasic },
    rows,
  };
}
