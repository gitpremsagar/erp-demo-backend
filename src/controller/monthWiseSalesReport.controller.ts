import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  buildFyMonthBuckets,
  computeMonthWiseSalesReportRows,
  getMarchPriorFyBucket,
  RETURN_CREDIT_ORDER_SELECT,
} from "../lib/monthWiseSalesReportAmount";
import {
  computeOrderGrossSaleForReport,
  findReportOrders,
  getCompletedOrderFilter,
  getZonedDateParts,
  REPORT_ORDER_SELECT,
} from "../lib/orderSaleAmount";
import {
  buildFinancialYearWindow,
  earliestFinancialYear,
  fyFromDate,
  getFinancialYearEnd,
  shiftFinancialYear,
} from "../lib/financialYearWindow";
import {
  HISTORICAL_FIRST_FY,
  HISTORICAL_SALES_BY_FY,
  historicalMonthValues,
  historicalPriorMarch,
} from "../data/historicalMonthWiseReports";

function historicalTallyOverrides(financialYear: string) {
  return {
    months: historicalMonthValues(HISTORICAL_SALES_BY_FY, financialYear, "tally"),
    priorMarch: historicalPriorMarch(HISTORICAL_SALES_BY_FY, financialYear, "tally"),
  };
}

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function resolveSafeTimeZoneLocal(timeZone: string | undefined): string {
  if (!timeZone) return "Asia/Kolkata";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "Asia/Kolkata";
  }
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
  return (startYear + 1) % 100 === endTwoDigits;
}

function parseReportQuery(req: Request): { timeZone: string; financialYear: string } {
  const requestTimeZone = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
  const timeZone = resolveSafeTimeZoneLocal(requestTimeZone);
  const now = new Date();
  const nowParts = getZonedDateParts(now, timeZone);
  const queryFinancialYear =
    typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
  const financialYear = isValidFinancialYear(queryFinancialYear)
    ? queryFinancialYear
    : getFinancialYearFromZonedParts(nowParts);
  return { timeZone, financialYear };
}

const salesReturnInclude = {
  SalesReturnItem: {
    select: { productId: true, quantity: true },
  },
  order: { select: RETURN_CREDIT_ORDER_SELECT },
} as const;

const creditNoteInclude = {
  CreditNoteItem: {
    select: { productId: true, quantity: true },
  },
  order: { select: RETURN_CREDIT_ORDER_SELECT },
} as const;

const MONTH_SALE_DETAIL_ORDER_SELECT = {
  id: true,
  ...REPORT_ORDER_SELECT,
  Customer: {
    select: {
      CustomerDetail: {
        select: { dbName: true, dbCategory: true },
        take: 1,
      },
    },
  },
} as const;

export const getMonthWiseSalesReport = async (req: Request, res: Response) => {
  try {
    const { timeZone, financialYear: endFinancialYear } = parseReportQuery(req);
    const completedOrderFilter = await getCompletedOrderFilter();

    const [firstOrder, firstPersisted] = await Promise.all([
      prisma.order.findFirst({
        where: completedOrderFilter,
        orderBy: { orderDate: "asc" },
        select: { orderDate: true },
      }),
      prisma.monthWiseSalesReport.findFirst({
        orderBy: { financialYear: "asc" },
        select: { financialYear: true },
      }),
    ]);

    const earliestFy = earliestFinancialYear([
      firstOrder?.orderDate ? fyFromDate(new Date(firstOrder.orderDate), timeZone) : null,
      firstPersisted?.financialYear ?? null,
      HISTORICAL_FIRST_FY,
    ]);
    const windowYears = buildFinancialYearWindow(endFinancialYear, earliestFy);
    const priorFy = shiftFinancialYear(windowYears[0], -1);
    const queryStart = getMarchPriorFyBucket(priorFy, timeZone).start;
    const queryEnd = getFinancialYearEnd(endFinancialYear, timeZone);

    const [orders, salesReturns, creditNotes, persistedRows] = await Promise.all([
      findReportOrders({
        ...completedOrderFilter,
        orderDate: { gte: queryStart, lt: queryEnd },
      }),
      prisma.salesReturn.findMany({
        where: { returnDate: { gte: queryStart, lt: queryEnd } },
        include: salesReturnInclude,
      }),
      prisma.creditNote.findMany({
        where: { noteDate: { gte: queryStart, lt: queryEnd } },
        include: creditNoteInclude,
      }),
      prisma.monthWiseSalesReport.findMany({
        where: { financialYear: { in: windowYears } },
      }),
    ]);

    const priorFyTally = computeMonthWiseSalesReportRows(
      priorFy,
      orders,
      salesReturns,
      creditNotes,
      Array(12).fill(null),
      timeZone,
      historicalTallyOverrides(priorFy)
    ).reduce((sum, r) => sum + r.tallyAchieved, 0);

    let previousYearTally = priorFyTally;
    const years = windowYears.map((financialYear) => {
      const persistedByIndex = new Map(
        persistedRows
          .filter((r) => r.financialYear === financialYear)
          .map((r) => [r.monthIndex, r])
      );
      const manualTargets = Array.from(
        { length: 12 },
        (_, i) => persistedByIndex.get(i)?.primaryTarget ?? null
      );

      const tallyOverrides = historicalTallyOverrides(financialYear);
      const historicalDms = historicalMonthValues(HISTORICAL_SALES_BY_FY, financialYear, "dms");

      const computedRows = computeMonthWiseSalesReportRows(
        financialYear,
        orders,
        salesReturns,
        creditNotes,
        manualTargets,
        timeZone,
        tallyOverrides
      );

      const rows = computedRows.map((computed) => {
        const persisted = persistedByIndex.get(computed.monthIndex);
        return {
          monthIndex: computed.monthIndex,
          monthLabel: computed.monthLabel,
          primaryTarget: persisted?.primaryTarget ?? null,
          tallyAchieved: computed.tallyAchieved,
          isHistorical: tallyOverrides.months[computed.monthIndex] !== null,
          dmsAchieved: persisted?.dmsAchieved ?? historicalDms[computed.monthIndex],
          achievePercent: computed.achievePercent,
          qWiseTarget: computed.qWiseTarget,
          qWiseAchieved: computed.qWiseAchieved,
          quarterAchievePercent: computed.quarterAchievePercent,
          compareFromPreviousMonth: computed.compareFromPreviousMonth,
          remark: persisted?.remark ?? null,
        };
      });

      const primaryTarget = rows.reduce((sum, r) => sum + (r.primaryTarget ?? 0), 0);
      const tallyAchieved = rows.reduce((sum, r) => sum + r.tallyAchieved, 0);
      const dmsAchieved = rows.reduce((sum, r) => sum + (r.dmsAchieved ?? 0), 0);
      const achievePercent = primaryTarget > 0 ? (tallyAchieved / primaryTarget) * 100 : null;
      const compareFromPreviousYear =
        previousYearTally === 0
          ? null
          : ((tallyAchieved - previousYearTally) / previousYearTally) * 100;
      previousYearTally = tallyAchieved;

      return {
        financialYear,
        rows,
        totals: {
          primaryTarget,
          tallyAchieved,
          dmsAchieved,
          achievePercent,
          compareFromPreviousYear,
        },
      };
    });

    res.json({ endFinancialYear, years });
  } catch (error) {
    console.error("Month-wise sales report error:", error);
    res.status(500).json({ message: "Failed to load month-wise sales report" });
  }
};

export const getMonthWiseSalesDetail = async (req: Request, res: Response) => {
  try {
    const requestTimeZone = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
    const timeZone = resolveSafeTimeZoneLocal(requestTimeZone);
    const financialYear =
      typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
    const monthIndexRaw = req.query.monthIndex;

    if (!financialYear || !isValidFinancialYear(financialYear)) {
      return res.status(400).json({ message: "Valid financialYear is required" });
    }

    const monthIndex =
      typeof monthIndexRaw === "string" ? parseInt(monthIndexRaw, 10) : Number(monthIndexRaw);
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return res.status(400).json({ message: "monthIndex must be an integer from 0 to 11" });
    }

    const buckets = buildFyMonthBuckets(financialYear, timeZone);
    const bucket = buckets[monthIndex];
    const completedOrderFilter = await getCompletedOrderFilter();

    const orders = await prisma.order.findMany({
      where: {
        ...completedOrderFilter,
        orderDate: { gte: bucket.start, lt: bucket.end },
      },
      select: MONTH_SALE_DETAIL_ORDER_SELECT,
      orderBy: { orderDate: "desc" },
    });

    const orderRows = orders.map((o) => ({
      orderId: o.id,
      orderDate: new Date(o.orderDate).toISOString(),
      partyName: o.Customer?.CustomerDetail?.[0]?.dbName ?? "—",
      orderValueBasic: computeOrderGrossSaleForReport(o),
    }));

    const totalSale = orderRows.reduce((sum, row) => sum + row.orderValueBasic, 0);

    res.json({
      financialYear,
      monthIndex,
      monthLabel: bucket.monthLabel,
      totalSale,
      orderCount: orderRows.length,
      orders: orderRows,
    });
  } catch (error) {
    console.error("Month-wise sales detail error:", error);
    res.status(500).json({ message: "Failed to load month-wise sales detail" });
  }
};

export const upsertMonthWiseSalesReport = async (req: Request, res: Response) => {
  try {
    const { financialYear, monthIndex, primaryTarget, dmsAchieved, remark } = req.body as {
      financialYear?: string;
      monthIndex?: number;
      primaryTarget?: number | null;
      dmsAchieved?: number | null;
      remark?: string | null;
    };

    if (!financialYear || monthIndex === undefined || monthIndex === null) {
      return res.status(400).json({ message: "financialYear and monthIndex are required" });
    }
    if (!isValidFinancialYear(financialYear)) {
      return res.status(400).json({ message: "Invalid financialYear format" });
    }
    if (monthIndex < 0 || monthIndex > 11 || !Number.isInteger(monthIndex)) {
      return res.status(400).json({ message: "monthIndex must be an integer from 0 to 11" });
    }

    const updateData: {
      primaryTarget?: number | null;
      dmsAchieved?: number | null;
      remark?: string | null;
    } = {};
    if (primaryTarget !== undefined) updateData.primaryTarget = primaryTarget;
    if (dmsAchieved !== undefined) updateData.dmsAchieved = dmsAchieved;
    if (remark !== undefined) updateData.remark = remark;

    const entry = await prisma.monthWiseSalesReport.upsert({
      where: {
        financialYear_monthIndex: { financialYear, monthIndex },
      },
      update: updateData,
      create: {
        financialYear,
        monthIndex,
        primaryTarget: primaryTarget ?? null,
        dmsAchieved: dmsAchieved ?? null,
        remark: remark ?? null,
      },
    });

    res.json({ entry });
  } catch (error) {
    console.error("Upsert month-wise sales report error:", error);
    res.status(500).json({ message: "Failed to save month-wise sales report entry" });
  }
};
