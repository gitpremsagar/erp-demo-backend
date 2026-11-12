import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { computeMonthWisePurchaseReportRows } from "../lib/monthWisePurchaseReportAmount";
import { getMarchPriorFyBucket } from "../lib/monthWiseSalesReportAmount";
import { getZonedDateParts } from "../lib/orderSaleAmount";
import {
  buildFinancialYearWindow,
  earliestFinancialYear,
  fyFromDate,
  getFinancialYearEnd,
  shiftFinancialYear,
} from "../lib/financialYearWindow";
import {
  HISTORICAL_FIRST_FY,
  HISTORICAL_PURCHASE_BY_FY,
  historicalMonthValues,
  historicalPriorMarch,
} from "../data/historicalMonthWiseReports";

function historicalAchievedOverrides(financialYear: string) {
  return {
    months: historicalMonthValues(HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
    priorMarch: historicalPriorMarch(HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
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

export const getMonthWisePurchaseReport = async (req: Request, res: Response) => {
  try {
    const { timeZone, financialYear: endFinancialYear } = parseReportQuery(req);

    const [firstInvoice, firstPersisted] = await Promise.all([
      prisma.purchaseInvoice.findFirst({
        where: { invoiceDate: { not: null } },
        orderBy: { invoiceDate: "asc" },
        select: { invoiceDate: true },
      }),
      prisma.monthWisePurchaseReport.findFirst({
        orderBy: { financialYear: "asc" },
        select: { financialYear: true },
      }),
    ]);

    const earliestFy = earliestFinancialYear([
      firstInvoice?.invoiceDate ? fyFromDate(new Date(firstInvoice.invoiceDate), timeZone) : null,
      firstPersisted?.financialYear ?? null,
      HISTORICAL_FIRST_FY,
    ]);
    const windowYears = buildFinancialYearWindow(endFinancialYear, earliestFy);
    const priorFy = shiftFinancialYear(windowYears[0], -1);
    const queryStart = getMarchPriorFyBucket(priorFy, timeZone).start;
    const queryEnd = getFinancialYearEnd(endFinancialYear, timeZone);

    const [invoices, persistedRows] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
        select: { invoiceAmount: true, invoiceDate: true },
      }),
      prisma.monthWisePurchaseReport.findMany({
        where: { financialYear: { in: windowYears } },
      }),
    ]);

    let previousYearAchieved = computeMonthWisePurchaseReportRows(
      priorFy,
      invoices,
      Array(12).fill(null),
      timeZone,
      historicalAchievedOverrides(priorFy)
    ).reduce((sum, r) => sum + r.achieved, 0);

    const years = windowYears.map((financialYear) => {
      const persistedByIndex = new Map(
        persistedRows
          .filter((r) => r.financialYear === financialYear)
          .map((r) => [r.monthIndex, r])
      );
      const historicalTargets = historicalMonthValues(
        HISTORICAL_PURCHASE_BY_FY,
        financialYear,
        "target"
      );
      const manualTargets = Array.from(
        { length: 12 },
        (_, monthIndex) =>
          persistedByIndex.get(monthIndex)?.target ?? historicalTargets[monthIndex]
      );

      const computedRows = computeMonthWisePurchaseReportRows(
        financialYear,
        invoices,
        manualTargets,
        timeZone,
        historicalAchievedOverrides(financialYear)
      );

      const rows = computedRows.map((computed) => {
        const persisted = persistedByIndex.get(computed.monthIndex);
        return {
          monthIndex: computed.monthIndex,
          monthLabel: computed.monthLabel,
          target: manualTargets[computed.monthIndex],
          achieved: computed.achieved,
          qWiseTarget: computed.qWiseTarget,
          qWiseAchieved: computed.qWiseAchieved,
          achievePercent: computed.achievePercent,
          quarterAchievePercent: computed.quarterAchievePercent,
          compareFromPreviousMonth: computed.compareFromPreviousMonth,
          remark: persisted?.remark ?? null,
        };
      });

      const target = rows.reduce((sum, r) => sum + (r.target ?? 0), 0);
      const achieved = rows.reduce((sum, r) => sum + r.achieved, 0);
      const achievePercent = target > 0 ? (achieved / target) * 100 : null;
      const compareFromPreviousYear =
        previousYearAchieved === 0
          ? null
          : ((achieved - previousYearAchieved) / previousYearAchieved) * 100;
      previousYearAchieved = achieved;

      return {
        financialYear,
        rows,
        totals: {
          target,
          achieved,
          balance: achieved - target,
          achievePercent,
          compareFromPreviousYear,
        },
      };
    });

    res.json({ endFinancialYear, years });
  } catch (error) {
    console.error("Month-wise purchase report error:", error);
    res.status(500).json({ message: "Failed to load month-wise purchase report" });
  }
};

export const upsertMonthWisePurchaseReport = async (req: Request, res: Response) => {
  try {
    const { financialYear, monthIndex, target, remark } = req.body as {
      financialYear?: string;
      monthIndex?: number;
      target?: number | null;
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
      target?: number | null;
      remark?: string | null;
    } = {};
    if (target !== undefined) updateData.target = target;
    if (remark !== undefined) updateData.remark = remark;

    const entry = await prisma.monthWisePurchaseReport.upsert({
      where: {
        financialYear_monthIndex: { financialYear, monthIndex },
      },
      update: updateData,
      create: {
        financialYear,
        monthIndex,
        target: target ?? null,
        remark: remark ?? null,
      },
    });

    res.json({ entry });
  } catch (error) {
    console.error("Upsert month-wise purchase report error:", error);
    res.status(500).json({ message: "Failed to save month-wise purchase report entry" });
  }
};
