import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveOrderItemSnapshotRates } from "../lib/orderItemPriceSnapshot";
import { computePurchaseInvoiceBasicFromItems } from "../lib/purchaseItemPriceSnapshot";

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const mapped = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour),
    minute: Number(mapped.minute),
    second: Number(mapped.second),
  };
}

function resolveSafeTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedDateParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtcDate(
  timeZone: string,
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
): Date {
  let utcMillis = Date.UTC(year, monthIndex, day, hour, minute, second, millisecond);
  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utcMillis), timeZone);
    utcMillis = Date.UTC(year, monthIndex, day, hour, minute, second, millisecond) - offset;
  }
  return new Date(utcMillis);
}

function getFinancialYearFromZonedParts(parts: ZonedDateParts): string {
  if (parts.month >= 4) return `${parts.year}-${String(parts.year + 1).slice(2)}`;
  return `${parts.year - 1}-${String(parts.year).slice(2)}`;
}

function isValidFinancialYear(fy: string | undefined): fy is string {
  if (!fy) return false;
  const match = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!match) return false;
  const startYear = Number(match[1]);
  const endTwoDigits = Number(match[2]);
  return ((startYear + 1) % 100) === endTwoDigits;
}

function getFinancialYearRange(fy: string, timeZone: string): { start: Date; end: Date } {
  const startYear = parseInt(fy.split("-")[0], 10);
  const start = zonedDateTimeToUtcDate(timeZone, startYear, 3, 1, 0, 0, 0, 0);
  const end = zonedDateTimeToUtcDate(timeZone, startYear + 1, 3, 1, 0, 0, 0, 0);
  return { start, end };
}

function getQuarterRange(fy: string, quarter: number, timeZone: string): { start: Date; end: Date } {
  const startYear = parseInt(fy.split("-")[0], 10);
  const quarterStartMonths = [3, 6, 9, 0];
  const startMonth = quarterStartMonths[quarter - 1];
  const startYearForQuarter = quarter === 4 ? startYear + 1 : startYear;
  const start = zonedDateTimeToUtcDate(timeZone, startYearForQuarter, startMonth, 1, 0, 0, 0, 0);
  const nextQuarterStartMonth = quarter === 4 ? 3 : startMonth + 3;
  const nextQuarterStartYear = quarter === 4 ? startYear + 1 : startYearForQuarter;
  const end = zonedDateTimeToUtcDate(timeZone, nextQuarterStartYear, nextQuarterStartMonth, 1, 0, 0, 0, 0);
  return { start, end };
}

const DASHBOARD_ORDER_SELECT = {
  totalPrice: true,
  orderDate: true,
  customerId: true,
  cashDiscountPercent: true,
  ledgerBalance: true,
  OrderItem: {
    select: {
      quantity: true,
      schemeDiscountPercent: true,
      itemDiscountPercent: true,
      pricingTier: true,
      gstPercentage: true,
      packetsPerCarton: true,
      costPricePerCarton: true,
      costPricePerPacket: true,
      sellingPricePerCartonForDb: true,
      sellingPricePerPacketForDb: true,
      sellingPricePerCartonForRss: true,
      sellingPricePerPacketForRss: true,
    },
  },
} satisfies Prisma.OrderSelect;

const TILL_DATE_SALE_ORDER_SELECT = {
  ...DASHBOARD_ORDER_SELECT,
  id: true,
  Customer: {
    select: {
      CustomerDetail: {
        select: { dbName: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.OrderSelect;

type DashboardOrderRow = Prisma.OrderGetPayload<{ select: typeof DASHBOARD_ORDER_SELECT }>;
type TillDateSaleOrderRow = Prisma.OrderGetPayload<{ select: typeof TILL_DATE_SALE_ORDER_SELECT }>;

function computeOrderSaleFromSnapshots(order: DashboardOrderRow): number {
  if (order.OrderItem.length === 0) {
    return order.totalPrice ?? 0;
  }

  let totalTaxable = 0;
  let totalWithGst = 0;
  let hasAtLeastOneDerivableLine = false;

  for (const item of order.OrderItem) {
    const qty = item.quantity ?? 0;
    const resolved = resolveOrderItemSnapshotRates(item);
    const rate = resolved?.carton ?? 0;
    const gstPercent = resolved?.gstPercent ?? 0;
    const base = qty * rate;
    if (base > 0) hasAtLeastOneDerivableLine = true;
    const schemePercent = item.schemeDiscountPercent ?? 0;
    const schemeAmount = base * (schemePercent / 100);
    const itemDiscountPercent = item.itemDiscountPercent ?? 0;
    const itemDiscountAmount = base * (itemDiscountPercent / 100);
    const taxable = base - schemeAmount - itemDiscountAmount;
    const gstAmount = taxable * (gstPercent / 100);
    totalTaxable += taxable;
    totalWithGst += taxable + gstAmount;
  }

  if (!hasAtLeastOneDerivableLine) {
    return order.totalPrice ?? 0;
  }

  const cashDiscountPercent = order.cashDiscountPercent ?? 0;
  const cashDiscountAmount = totalTaxable * (cashDiscountPercent / 100);
  const chargeableAmount = totalWithGst - cashDiscountAmount;
  const ledgerAdjustment = order.ledgerBalance ?? 0;
  return chargeableAmount + ledgerAdjustment;
}

function computeOrderSaleAfterScheme(order: DashboardOrderRow): number {
  if (order.OrderItem.length === 0) {
    return order.totalPrice ?? 0;
  }

  let totalAfterScheme = 0;
  let hasAtLeastOneDerivableLine = false;

  for (const item of order.OrderItem) {
    const qty = item.quantity ?? 0;
    const resolved = resolveOrderItemSnapshotRates(item);
    const rate = resolved?.carton ?? 0;
    const base = qty * rate;
    if (base > 0) hasAtLeastOneDerivableLine = true;
    const schemePercent = item.schemeDiscountPercent ?? 0;
    const schemeAmount = base * (schemePercent / 100);
    const itemDiscountPercent = item.itemDiscountPercent ?? 0;
    const itemDiscountAmount = base * (itemDiscountPercent / 100);
    totalAfterScheme += base - schemeAmount - itemDiscountAmount;
  }

  if (!hasAtLeastOneDerivableLine) {
    return order.totalPrice ?? 0;
  }

  return totalAfterScheme;
}

async function getCompletedOrderFilter(): Promise<Prisma.OrderWhereInput> {
  const completedOrderStatusType = await prisma.orderStatusType.findFirst({
    where: { name: { in: ["COMPLETE", "COMPLETED"] } },
    select: { id: true },
  });
  return completedOrderStatusType
    ? {
        OR: [{ orderStatusTypeId: completedOrderStatusType.id }, { status: "COMPLETED" as const }],
      }
    : { status: "COMPLETED" as const };
}

/** Parse YYYY-MM-DD into calendar parts, or null if invalid. */
function parseAsOfDateParts(asOfDate: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function parseDashboardQuery(req: Request): {
  timeZone: string;
  now: Date;
  nowParts: ZonedDateParts;
  monthStart: Date;
  currentFY: string;
} {
  const requestTimeZone = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
  const timeZone = resolveSafeTimeZone(requestTimeZone);
  const asOfRaw = typeof req.query.asOfDate === "string" ? req.query.asOfDate : undefined;
  const asOfParts = asOfRaw ? parseAsOfDateParts(asOfRaw) : null;

  let now: Date;
  let nowParts: ZonedDateParts;
  let monthStart: Date;

  if (asOfParts) {
    // 1st of as-of month 00:00 → end of as-of day 23:59:59.999 in client TZ
    monthStart = zonedDateTimeToUtcDate(timeZone, asOfParts.year, asOfParts.month - 1, 1, 0, 0, 0, 0);
    now = zonedDateTimeToUtcDate(
      timeZone,
      asOfParts.year,
      asOfParts.month - 1,
      asOfParts.day,
      23,
      59,
      59,
      999
    );
    nowParts = {
      year: asOfParts.year,
      month: asOfParts.month,
      day: asOfParts.day,
      hour: 23,
      minute: 59,
      second: 59,
    };
  } else {
    const nowRaw = typeof req.query.nowIso === "string" ? new Date(req.query.nowIso) : new Date();
    now = Number.isNaN(nowRaw.getTime()) ? new Date() : nowRaw;
    nowParts = getZonedDateParts(now, timeZone);
    monthStart = zonedDateTimeToUtcDate(timeZone, nowParts.year, nowParts.month - 1, 1, 0, 0, 0, 0);
  }

  const queryFinancialYear = typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
  const currentFY = isValidFinancialYear(queryFinancialYear)
    ? queryFinancialYear
    : getFinancialYearFromZonedParts(nowParts);
  return { timeZone, now, nowParts, monthStart, currentFY };
}

function computeTillDateSale(orders: DashboardOrderRow[], monthStart: Date, now: Date): number {
  return orders
    .filter((o) => {
      const d = new Date(o.orderDate);
      return d >= monthStart && d <= now;
    })
    .reduce((s, o) => s + computeOrderSaleAfterScheme(o), 0);
}

function computeTillDatePurchase(
  invoices: Array<{ invoiceAmount: number | null }>
): number {
  return invoices.reduce((s, inv) => s + (inv.invoiceAmount ?? 0), 0);
}

function computeMonthWiseSales(
  orders: DashboardOrderRow[],
  currentFY: string,
  timeZone: string
): { month: string; value: number }[] {
  const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const fyStartYear = parseInt(currentFY.split("-")[0], 10);
  return monthNames.map((name, i) => {
    const m = (3 + i) % 12;
    const y = m >= 3 ? fyStartYear : fyStartYear + 1;
    const mStart = zonedDateTimeToUtcDate(timeZone, y, m, 1, 0, 0, 0, 0);
    const mEnd = zonedDateTimeToUtcDate(timeZone, y, m + 1, 1, 0, 0, 0, 0);
    const value = orders
      .filter((o) => {
        const d = new Date(o.orderDate);
        return d >= mStart && d < mEnd;
      })
      .reduce((s, o) => s + computeOrderSaleFromSnapshots(o), 0);
    return { month: name, value };
  });
}

function computeMonthWisePurchases(
  invoices: Array<{ invoiceAmount: number | null; invoiceDate: Date | null }>,
  currentFY: string,
  timeZone: string
): { month: string; value: number }[] {
  const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const fyStartYear = parseInt(currentFY.split("-")[0], 10);
  return monthNames.map((name, i) => {
    const m = (3 + i) % 12;
    const y = m >= 3 ? fyStartYear : fyStartYear + 1;
    const mStart = zonedDateTimeToUtcDate(timeZone, y, m, 1, 0, 0, 0, 0);
    const mEnd = zonedDateTimeToUtcDate(timeZone, y, m + 1, 1, 0, 0, 0, 0);
    const value = invoices
      .filter((inv) => {
        if (!inv.invoiceDate) return false;
        const d = new Date(inv.invoiceDate);
        return d >= mStart && d < mEnd;
      })
      .reduce((s, inv) => s + (inv.invoiceAmount ?? 0), 0);
    return { month: name, value };
  });
}

function buildQuarterly(
  orders: DashboardOrderRow[],
  targets: Array<{ quarter: number; targetAmount: number }>,
  fy: string,
  timeZone: string
): { quarter: string; target: number; achieved: number }[] {
  return [1, 2, 3, 4].map((q) => {
    const range = getQuarterRange(fy, q, timeZone);
    const achieved = orders
      .filter((o) => {
        const d = new Date(o.orderDate);
        return d >= range.start && d < range.end;
      })
      .reduce((s, o) => s + computeOrderSaleFromSnapshots(o), 0);
    const target = targets.find((t) => t.quarter === q)?.targetAmount ?? 0;
    return { quarter: `Q${q}`, target, achieved };
  });
}

function buildForecastAndAchievedMaps(
  forecastItemsCurrentMonth: Array<{
    distributorId: string;
    quantity: number;
    Product: { costPricePerCarton: number | null } | null;
  }>,
  forecastItemsCurrentFY: Array<{
    distributorId: string;
    quantity: number;
    Product: { costPricePerCarton: number | null } | null;
  }>,
  allCompletedOrdersCurrentFY: DashboardOrderRow[],
  monthStart: Date,
  now: Date
): {
  forecastMonthByDist: Map<string, number>;
  forecastYearByDist: Map<string, number>;
  achievedMonthByDist: Map<string, number>;
  achievedYearByDist: Map<string, number>;
} {
  const forecastMonthByDist = new Map<string, number>();
  for (const fi of forecastItemsCurrentMonth) {
    const val = fi.quantity * (fi.Product?.costPricePerCarton ?? 0);
    forecastMonthByDist.set(fi.distributorId, (forecastMonthByDist.get(fi.distributorId) ?? 0) + val);
  }

  const forecastYearByDist = new Map<string, number>();
  for (const fi of forecastItemsCurrentFY) {
    const val = fi.quantity * (fi.Product?.costPricePerCarton ?? 0);
    forecastYearByDist.set(fi.distributorId, (forecastYearByDist.get(fi.distributorId) ?? 0) + val);
  }

  const achievedMonthByDist = new Map<string, number>();
  const achievedYearByDist = new Map<string, number>();
  for (const o of allCompletedOrdersCurrentFY) {
    const d = new Date(o.orderDate);
    const val = computeOrderSaleFromSnapshots(o);
    achievedYearByDist.set(o.customerId, (achievedYearByDist.get(o.customerId) ?? 0) + val);
    if (d >= monthStart && d <= now) {
      achievedMonthByDist.set(o.customerId, (achievedMonthByDist.get(o.customerId) ?? 0) + val);
    }
  }

  return { forecastMonthByDist, forecastYearByDist, achievedMonthByDist, achievedYearByDist };
}

export const getDashboardSummary = async (_req: Request, res: Response) => {
  try {
    const { timeZone, now, monthStart, currentFY } = parseDashboardQuery(_req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const prevFYStartYear = parseInt(currentFY.split("-")[0], 10) - 1;
    const lastFY = `${prevFYStartYear}-${String(prevFYStartYear + 1).slice(2)}`;
    const lastFYRange = getFinancialYearRange(lastFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();

    const [
      allCompletedOrdersCurrentFY,
      allCompletedOrdersLastFY,
      allInvoicesCurrentFY,
      currentMonthInvoices,
      currentFYTargets,
      lastFYTargets,
      ssDistributors,
      allDistributors,
      forecastItemsCurrentMonth,
      forecastItemsCurrentFY,
      nearExpiryBatches,
      activeBatches,
      contacts,
      documents,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...completedOrderFilter,
          orderDate: { gte: fyRange.start, lt: fyRange.end },
        },
        select: DASHBOARD_ORDER_SELECT,
      }),
      prisma.order.findMany({
        where: {
          ...completedOrderFilter,
          orderDate: { gte: lastFYRange.start, lt: lastFYRange.end },
        },
        select: DASHBOARD_ORDER_SELECT,
      }),
      prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: fyRange.start, lt: fyRange.end } },
        select: { invoiceAmount: true, invoiceDate: true },
      }),
      prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: monthStart, lte: now } },
        select: { invoiceAmount: true },
      }),
      prisma.shipmentTarget.findMany({
        where: { financialYear: currentFY },
        orderBy: { quarter: "asc" },
      }),
      prisma.shipmentTarget.findMany({
        where: { financialYear: lastFY },
        orderBy: { quarter: "asc" },
      }),
      prisma.customerDetail.findMany({
        where: { dbCategory: "SS" },
        select: { dbUserId: true, dbName: true },
      }),
      prisma.customerDetail.findMany({
        where: { dbCategory: { in: ["DISTRIBUTOR", "SS", "RSS"] } },
        select: { dbUserId: true, dbName: true, dbCategory: true },
      }),
      prisma.forecastItem.findMany({
        where: { forecastDate: { gte: monthStart, lte: now } },
        select: {
          distributorId: true,
          quantity: true,
          Product: { select: { costPricePerCarton: true } },
        },
      }),
      prisma.forecastItem.findMany({
        where: { forecastDate: { gte: fyRange.start, lt: fyRange.end } },
        select: {
          distributorId: true,
          quantity: true,
          Product: { select: { costPricePerCarton: true } },
        },
      }),
      prisma.stockBatch.findMany({
        where: {
          expiryDate: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          stockQuantity: { gt: 0 },
          isArchived: false,
        },
        select: {
          id: true,
          expiryDate: true,
          stockQuantity: true,
          product: { select: { name: true, productCode: true } },
        },
        orderBy: { expiryDate: "asc" },
        take: 20,
      }),
      prisma.stockBatch.findMany({
        where: { isArchived: false },
        select: {
          productId: true,
          stockQuantity: true,
          product: { select: { name: true, productCode: true } },
        },
      }),
      prisma.contact.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.document.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    const currentMonthSales = computeTillDateSale(allCompletedOrdersCurrentFY, monthStart, now);
    const currentMonthPurchases = computeTillDatePurchase(currentMonthInvoices);
    const monthWiseSales = computeMonthWiseSales(allCompletedOrdersCurrentFY, currentFY, timeZone);
    const monthWisePurchases = computeMonthWisePurchases(allInvoicesCurrentFY, currentFY, timeZone);
    const currentFYQuarterly = buildQuarterly(
      allCompletedOrdersCurrentFY,
      currentFYTargets,
      currentFY,
      timeZone
    );
    const lastFYQuarterly = buildQuarterly(
      allCompletedOrdersLastFY,
      lastFYTargets,
      lastFY,
      timeZone
    );

    const { forecastMonthByDist, forecastYearByDist, achievedMonthByDist, achievedYearByDist } =
      buildForecastAndAchievedMaps(
        forecastItemsCurrentMonth,
        forecastItemsCurrentFY,
        allCompletedOrdersCurrentFY,
        monthStart,
        now
      );

    const ssForecastCurrentMonth = ssDistributors.map((dist) => ({
      distributorId: dist.dbUserId,
      distributorName: dist.dbName,
      forecast: forecastMonthByDist.get(dist.dbUserId) ?? 0,
      achieved: achievedMonthByDist.get(dist.dbUserId) ?? 0,
    }));

    const ssForecastYearly = ssDistributors.map((dist) => ({
      distributorId: dist.dbUserId,
      distributorName: dist.dbName,
      forecast: forecastYearByDist.get(dist.dbUserId) ?? 0,
      achieved: achievedYearByDist.get(dist.dbUserId) ?? 0,
    }));

    const dbForecastCurrentMonth = allDistributors
      .map((dist) => {
        const forecast = forecastMonthByDist.get(dist.dbUserId) ?? 0;
        const achieved = achievedMonthByDist.get(dist.dbUserId) ?? 0;
        return {
          distributorId: dist.dbUserId,
          distributorName: dist.dbName,
          category: dist.dbCategory,
          forecast,
          achieved,
        };
      })
      .filter((row) => row.forecast > 0 || row.achieved > 0);

    const productStockMap = new Map<string, { name: string; code: string; qty: number }>();
    for (const sb of activeBatches) {
      const existing = productStockMap.get(sb.productId);
      if (existing) {
        existing.qty += sb.stockQuantity;
      } else {
        productStockMap.set(sb.productId, {
          name: sb.product.name,
          code: sb.product.productCode,
          qty: sb.stockQuantity,
        });
      }
    }
    const actualStock = Array.from(productStockMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ productName: s.name, productCode: s.code, quantity: s.qty }));

    res.json({
      currentMonth: {
        tillDateSale: currentMonthSales,
        tillDatePurchase: currentMonthPurchases,
      },
      monthWiseSales,
      monthWisePurchases,
      currentFinancialYear: {
        year: currentFY,
        quarterly: currentFYQuarterly,
      },
      lastFinancialYear: {
        year: lastFY,
        quarterly: lastFYQuarterly,
      },
      ssForecastVsAchieve: {
        currentMonth: ssForecastCurrentMonth,
        yearly: ssForecastYearly,
      },
      dbForecastVsAchieve: {
        currentMonth: dbForecastCurrentMonth,
      },
      reports: {
        nearExpiryProducts: nearExpiryBatches,
        actualStock,
      },
      contacts,
      documents,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
};

export const getTillDateSale = async (req: Request, res: Response) => {
  try {
    const { now, monthStart } = parseDashboardQuery(req);
    const completedOrderFilter = await getCompletedOrderFilter();
    const orders = await prisma.order.findMany({
      where: {
        ...completedOrderFilter,
        orderDate: { gte: monthStart, lte: now },
      },
      select: TILL_DATE_SALE_ORDER_SELECT,
      orderBy: { orderDate: "desc" },
    });
    const orderRows = orders.map((o: TillDateSaleOrderRow) => ({
      orderId: o.id,
      distributorName: o.Customer?.CustomerDetail?.[0]?.dbName ?? "—",
      orderDate: new Date(o.orderDate).toISOString(),
      taxableAmount: computeOrderSaleAfterScheme(o),
    }));
    const tillDateSale = orderRows.reduce((s, row) => s + row.taxableAmount, 0);
    res.json({
      tillDateSale,
      orderCount: orderRows.length,
      orders: orderRows,
    });
  } catch (error) {
    console.error("Dashboard till-date-sale error:", error);
    res.status(500).json({ message: "Failed to load till date sale" });
  }
};

export const getTillDatePurchase = async (req: Request, res: Response) => {
  try {
    const { now, monthStart } = parseDashboardQuery(req);
    const currentMonthInvoices = await prisma.purchaseInvoice.findMany({
      where: { invoiceDate: { gte: monthStart, lte: now } },
      select: { purchaseId: true },
    });
    const purchaseIds = [...new Set(currentMonthInvoices.map((inv) => inv.purchaseId))];
    const purchases = purchaseIds.length
      ? await prisma.purchase.findMany({
          where: { id: { in: purchaseIds } },
          select: {
            id: true,
            vehicleNumber: true,
            stockAddedAt: true,
            Transporter: { select: { name: true } },
            PurchaseInvoice: {
              select: {
                invoiceID: true,
                invoiceDate: true,
                PurchaseInvoiceItem: {
                  select: {
                    quantity: true,
                    costPricePerCarton: true,
                    costPricePerPacket: true,
                    packetsPerCarton: true,
                    gstPercentage: true,
                  },
                },
              },
              orderBy: { invoiceDate: "desc" },
            },
          },
        })
      : [];

    const vehicleRows = purchases.map((purchase) => {
      const invoiceNumbers = purchase.PurchaseInvoice.map(
        (inv) => inv.invoiceID?.trim() || "—"
      );
      const basicAmount = purchase.PurchaseInvoice.reduce(
        (sum, inv) =>
          sum + computePurchaseInvoiceBasicFromItems(inv.PurchaseInvoiceItem),
        0
      );
      const latestInvoiceDate = purchase.PurchaseInvoice.reduce<Date | null>(
        (latest, inv) => {
          if (!inv.invoiceDate) return latest;
          const d = new Date(inv.invoiceDate);
          if (!latest || d > latest) return d;
          return latest;
        },
        null
      );

      return {
        purchaseId: purchase.id,
        vehicleNumber: purchase.vehicleNumber?.trim() || "—",
        invoiceNumbers,
        transporterName: purchase.Transporter?.name ?? "—",
        stockAddedAt: purchase.stockAddedAt
          ? new Date(purchase.stockAddedAt).toISOString()
          : null,
        basicAmount,
        latestInvoiceDate: latestInvoiceDate?.toISOString() ?? null,
      };
    });

    vehicleRows.sort((a, b) => {
      const aTime = a.latestInvoiceDate ? new Date(a.latestInvoiceDate).getTime() : 0;
      const bTime = b.latestInvoiceDate ? new Date(b.latestInvoiceDate).getTime() : 0;
      return bTime - aTime;
    });

    const vehicles = vehicleRows.map(({ latestInvoiceDate: _latest, ...row }) => row);
    const tillDatePurchase = vehicles.reduce((s, row) => s + row.basicAmount, 0);

    res.json({
      tillDatePurchase,
      vehicleCount: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error("Dashboard till-date-purchase error:", error);
    res.status(500).json({ message: "Failed to load till date purchase" });
  }
};

export const getMonthWiseSales = async (req: Request, res: Response) => {
  try {
    const { timeZone, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();
    const allCompletedOrdersCurrentFY = await prisma.order.findMany({
      where: { ...completedOrderFilter, orderDate: { gte: fyRange.start, lt: fyRange.end } },
      select: DASHBOARD_ORDER_SELECT,
    });
    res.json({ monthWiseSales: computeMonthWiseSales(allCompletedOrdersCurrentFY, currentFY, timeZone) });
  } catch (error) {
    console.error("Dashboard month-wise-sales error:", error);
    res.status(500).json({ message: "Failed to load month wise sales" });
  }
};

export const getMonthWisePurchases = async (req: Request, res: Response) => {
  try {
    const { timeZone, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const allInvoicesCurrentFY = await prisma.purchaseInvoice.findMany({
      where: { invoiceDate: { gte: fyRange.start, lt: fyRange.end } },
      select: { invoiceAmount: true, invoiceDate: true },
    });
    res.json({
      monthWisePurchases: computeMonthWisePurchases(allInvoicesCurrentFY, currentFY, timeZone),
    });
  } catch (error) {
    console.error("Dashboard month-wise-purchases error:", error);
    res.status(500).json({ message: "Failed to load month wise purchases" });
  }
};

export const getShipmentVsAchieve = async (req: Request, res: Response) => {
  try {
    const { timeZone, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const prevFYStartYear = parseInt(currentFY.split("-")[0], 10) - 1;
    const lastFY = `${prevFYStartYear}-${String(prevFYStartYear + 1).slice(2)}`;
    const lastFYRange = getFinancialYearRange(lastFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();
    const [allCompletedOrdersCurrentFY, allCompletedOrdersLastFY, currentFYTargets, lastFYTargets] =
      await Promise.all([
      prisma.order.findMany({
        where: { ...completedOrderFilter, orderDate: { gte: fyRange.start, lt: fyRange.end } },
        select: DASHBOARD_ORDER_SELECT,
      }),
      prisma.order.findMany({
        where: { ...completedOrderFilter, orderDate: { gte: lastFYRange.start, lt: lastFYRange.end } },
        select: DASHBOARD_ORDER_SELECT,
      }),
      prisma.shipmentTarget.findMany({
        where: { financialYear: currentFY },
        orderBy: { quarter: "asc" },
      }),
      prisma.shipmentTarget.findMany({
        where: { financialYear: lastFY },
        orderBy: { quarter: "asc" },
      }),
    ]);
    res.json({
      currentFinancialYear: {
        year: currentFY,
        quarterly: buildQuarterly(allCompletedOrdersCurrentFY, currentFYTargets, currentFY, timeZone),
      },
      lastFinancialYear: {
        year: lastFY,
        quarterly: buildQuarterly(allCompletedOrdersLastFY, lastFYTargets, lastFY, timeZone),
      },
    });
  } catch (error) {
    console.error("Dashboard shipment-vs-achieve error:", error);
    res.status(500).json({ message: "Failed to load shipment vs achieve" });
  }
};

export const getSsForecastCurrent = async (req: Request, res: Response) => {
  try {
    const { timeZone, now, monthStart, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();
    const [allCompletedOrdersCurrentFY, ssDistributors, forecastItemsCurrentMonth, forecastItemsCurrentFY] =
      await Promise.all([
        prisma.order.findMany({
          where: { ...completedOrderFilter, orderDate: { gte: fyRange.start, lt: fyRange.end } },
          select: DASHBOARD_ORDER_SELECT,
        }),
        prisma.customerDetail.findMany({
          where: { dbCategory: "SS" },
          select: { dbUserId: true, dbName: true },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: monthStart, lte: now } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: fyRange.start, lt: fyRange.end } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
      ]);
    const { forecastMonthByDist, achievedMonthByDist } = buildForecastAndAchievedMaps(
      forecastItemsCurrentMonth,
      forecastItemsCurrentFY,
      allCompletedOrdersCurrentFY,
      monthStart,
      now
    );
    const ssForecastCurrentMonth = ssDistributors.map((dist) => ({
      distributorId: dist.dbUserId,
      distributorName: dist.dbName,
      forecast: forecastMonthByDist.get(dist.dbUserId) ?? 0,
      achieved: achievedMonthByDist.get(dist.dbUserId) ?? 0,
    }));
    res.json({ ssForecastCurrentMonth });
  } catch (error) {
    console.error("Dashboard ss-forecast-current error:", error);
    res.status(500).json({ message: "Failed to load SS forecast (current month)" });
  }
};

export const getSsForecastYearly = async (req: Request, res: Response) => {
  try {
    const { timeZone, now, monthStart, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();
    const [allCompletedOrdersCurrentFY, ssDistributors, forecastItemsCurrentMonth, forecastItemsCurrentFY] =
      await Promise.all([
        prisma.order.findMany({
          where: { ...completedOrderFilter, orderDate: { gte: fyRange.start, lt: fyRange.end } },
          select: DASHBOARD_ORDER_SELECT,
        }),
        prisma.customerDetail.findMany({
          where: { dbCategory: "SS" },
          select: { dbUserId: true, dbName: true },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: monthStart, lte: now } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: fyRange.start, lt: fyRange.end } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
      ]);
    const { forecastYearByDist, achievedYearByDist } = buildForecastAndAchievedMaps(
      forecastItemsCurrentMonth,
      forecastItemsCurrentFY,
      allCompletedOrdersCurrentFY,
      monthStart,
      now
    );
    const ssForecastYearly = ssDistributors.map((dist) => ({
      distributorId: dist.dbUserId,
      distributorName: dist.dbName,
      forecast: forecastYearByDist.get(dist.dbUserId) ?? 0,
      achieved: achievedYearByDist.get(dist.dbUserId) ?? 0,
    }));
    res.json({ ssForecastYearly });
  } catch (error) {
    console.error("Dashboard ss-forecast-yearly error:", error);
    res.status(500).json({ message: "Failed to load SS forecast (yearly)" });
  }
};

export const getDbForecastCurrent = async (req: Request, res: Response) => {
  try {
    const { timeZone, now, monthStart, currentFY } = parseDashboardQuery(req);
    const fyRange = getFinancialYearRange(currentFY, timeZone);
    const completedOrderFilter = await getCompletedOrderFilter();
    const [allCompletedOrdersCurrentFY, allDistributors, forecastItemsCurrentMonth, forecastItemsCurrentFY] =
      await Promise.all([
        prisma.order.findMany({
          where: { ...completedOrderFilter, orderDate: { gte: fyRange.start, lt: fyRange.end } },
          select: DASHBOARD_ORDER_SELECT,
        }),
        prisma.customerDetail.findMany({
          where: { dbCategory: { in: ["DISTRIBUTOR", "SS", "RSS"] } },
          select: { dbUserId: true, dbName: true, dbCategory: true },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: monthStart, lte: now } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
        prisma.forecastItem.findMany({
          where: { forecastDate: { gte: fyRange.start, lt: fyRange.end } },
          select: {
            distributorId: true,
            quantity: true,
            Product: { select: { costPricePerCarton: true } },
          },
        }),
      ]);
    const { forecastMonthByDist, achievedMonthByDist } = buildForecastAndAchievedMaps(
      forecastItemsCurrentMonth,
      forecastItemsCurrentFY,
      allCompletedOrdersCurrentFY,
      monthStart,
      now
    );
    const dbForecastCurrentMonth = allDistributors
      .map((dist) => {
        const forecast = forecastMonthByDist.get(dist.dbUserId) ?? 0;
        const achieved = achievedMonthByDist.get(dist.dbUserId) ?? 0;
        return {
          distributorId: dist.dbUserId,
          distributorName: dist.dbName,
          category: dist.dbCategory,
          forecast,
          achieved,
        };
      })
      .filter((row) => row.forecast > 0 || row.achieved > 0);
    res.json({ dbForecastCurrentMonth });
  } catch (error) {
    console.error("Dashboard db-forecast-current error:", error);
    res.status(500).json({ message: "Failed to load DB forecast (current month)" });
  }
};

export const getNearExpiry = async (req: Request, res: Response) => {
  try {
    const { now } = parseDashboardQuery(req);
    const nearExpiryBatches = await prisma.stockBatch.findMany({
      where: {
        expiryDate: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        stockQuantity: { gt: 0 },
        isArchived: false,
      },
      select: {
        id: true,
        expiryDate: true,
        stockQuantity: true,
        product: { select: { name: true, productCode: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 20,
    });
    const nearExpiryProducts = nearExpiryBatches.map((p) => ({
      id: p.id,
      expiryDate: p.expiryDate,
      stockQuantity: p.stockQuantity,
      product: { name: p.product.name, productCode: p.product.productCode },
    }));
    res.json({ nearExpiryProducts });
  } catch (error) {
    console.error("Dashboard near-expiry error:", error);
    res.status(500).json({ message: "Failed to load near expiry products" });
  }
};

export const getActualStock = async (_req: Request, res: Response) => {
  try {
    const activeBatches = await prisma.stockBatch.findMany({
      where: { isArchived: false },
      select: {
        productId: true,
        stockQuantity: true,
        product: { select: { name: true, productCode: true } },
      },
    });
    const productStockMap = new Map<string, { name: string; code: string; qty: number }>();
    for (const sb of activeBatches) {
      const existing = productStockMap.get(sb.productId);
      if (existing) {
        existing.qty += sb.stockQuantity;
      } else {
        productStockMap.set(sb.productId, {
          name: sb.product.name,
          code: sb.product.productCode,
          qty: sb.stockQuantity,
        });
      }
    }
    const actualStock = Array.from(productStockMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ productName: s.name, productCode: s.code, quantity: s.qty }));
    res.json({ actualStock });
  } catch (error) {
    console.error("Dashboard actual-stock error:", error);
    res.status(500).json({ message: "Failed to load actual stock" });
  }
};

export const getContacts = async (_req: Request, res: Response) => {
  try {
    const contacts = await prisma.contact.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ contacts });
  } catch (error) {
    console.error("Dashboard contacts error:", error);
    res.status(500).json({ message: "Failed to load contacts" });
  }
};

export const getDocuments = async (_req: Request, res: Response) => {
  try {
    const documents = await prisma.document.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ documents });
  } catch (error) {
    console.error("Dashboard documents error:", error);
    res.status(500).json({ message: "Failed to load documents" });
  }
};

export const getShipmentTargets = async (req: Request, res: Response) => {
  try {
    const { financialYear } = req.query;
    const where = financialYear ? { financialYear: financialYear as string } : {};
    const targets = await prisma.shipmentTarget.findMany({
      where,
      orderBy: [{ financialYear: "desc" }, { quarter: "asc" }],
    });
    res.json({ targets });
  } catch (error) {
    console.error("Error fetching shipment targets:", error);
    res.status(500).json({ message: "Failed to fetch shipment targets" });
  }
};

export const upsertShipmentTarget = async (req: Request, res: Response) => {
  try {
    const { financialYear, quarter, targetAmount } = req.body;
    if (!financialYear || !quarter || targetAmount === undefined) {
      return res.status(400).json({ message: "financialYear, quarter, and targetAmount are required" });
    }
    const target = await prisma.shipmentTarget.upsert({
      where: { financialYear_quarter: { financialYear, quarter } },
      update: { targetAmount },
      create: { financialYear, quarter, targetAmount },
    });
    res.json({ target });
  } catch (error) {
    console.error("Error upserting shipment target:", error);
    res.status(500).json({ message: "Failed to save shipment target" });
  }
};

export const createContact = async (req: Request, res: Response) => {
  try {
    const { name, phone, email, role } = req.body;
    const contact = await prisma.contact.create({ data: { name, phone, email, role } });
    res.status(201).json({ contact });
  } catch (error) {
    console.error("Error creating contact:", error);
    res.status(500).json({ message: "Failed to create contact" });
  }
};

export const deleteContact = async (req: Request, res: Response) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: "Contact deleted" });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ message: "Failed to delete contact" });
  }
};

export const createDocument = async (req: Request, res: Response) => {
  try {
    const { title, fileUrl, note } = req.body;
    const document = await prisma.document.create({ data: { title, fileUrl, note } });
    res.status(201).json({ document });
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ message: "Failed to create document" });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: "Document deleted" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
};
