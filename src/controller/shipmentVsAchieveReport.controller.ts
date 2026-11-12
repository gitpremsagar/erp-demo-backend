import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  getMarchPriorFyBucket,
  getPriorFinancialYear,
} from "../lib/monthWiseSalesReportAmount";
import {
  getCompletedOrderFilter,
  getZonedDateParts,
  zonedDateTimeToUtcDate,
} from "../lib/orderSaleAmount";
import {
  assembleLiveShipmentVsAchieveReport,
  buildHardcodedShipmentVsAchieveReport,
  isShipmentVsAchieveLiveFy,
  REPORT_ORDER_SELECT,
  RETURN_CREDIT_ORDER_SELECT,
} from "../lib/shipmentVsAchieveReport";
import { getHardcodedShipmentVsAchieve } from "../data/shipmentVsAchieveHardcoded";

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

function getFinancialYearRange(fy: string, timeZone: string): { start: Date; end: Date } {
  const startYear = parseInt(fy.split("-")[0], 10);
  const start = zonedDateTimeToUtcDate(timeZone, startYear, 3, 1, 0, 0, 0, 0);
  const end = zonedDateTimeToUtcDate(timeZone, startYear + 1, 3, 1, 0, 0, 0, 0);
  return { start, end };
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

const PURCHASE_INVOICE_SELECT = {
  invoiceDate: true,
  PurchaseInvoiceItem: {
    select: {
      quantity: true,
      mrp: true,
      gstPercentage: true,
      packetsPerCarton: true,
      costPricePerCarton: true,
      costPricePerPacket: true,
    },
  },
} as const;

async function buildLiveReport(financialYear: string, timeZone: string) {
  const fyRange = getFinancialYearRange(financialYear, timeZone);
  const priorMarch = getMarchPriorFyBucket(financialYear, timeZone);
  const queryStart = priorMarch.start;
  const queryEnd = fyRange.end;

  const completedOrderFilter = await getCompletedOrderFilter();

  const [orders, salesReturns, creditNotes, invoices, manualRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...completedOrderFilter,
        orderDate: { gte: queryStart, lt: queryEnd },
      },
      select: REPORT_ORDER_SELECT,
    }),
    prisma.salesReturn.findMany({
      where: { returnDate: { gte: queryStart, lt: queryEnd } },
      include: salesReturnInclude,
    }),
    prisma.creditNote.findMany({
      where: { noteDate: { gte: queryStart, lt: queryEnd } },
      include: creditNoteInclude,
    }),
    prisma.purchaseInvoice.findMany({
      where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
      select: PURCHASE_INVOICE_SELECT,
    }),
    prisma.shipmentVsAchieveMonth.findMany({
      where: { financialYear },
    }),
  ]);

  let report = assembleLiveShipmentVsAchieveReport({
    financialYear,
    timeZone,
    invoices,
    orders,
    salesReturns,
    creditNotes,
    manualRows,
  });

  // When prior FY is also live (e.g. 2027-28), compute prior totals for YoY
  const priorFy = getPriorFinancialYear(financialYear);
  if (isShipmentVsAchieveLiveFy(priorFy) && !getHardcodedShipmentVsAchieve(priorFy)) {
    const priorReport = await buildLiveReport(priorFy, timeZone);
    const totalAchieve = report.totals.achieveBasic ?? 0;
    const totalSale = report.totals.saleBasic ?? 0;
    const priorAchieve = priorReport.totals.achieveBasic;
    const priorSale = priorReport.totals.saleBasic;
    report = {
      ...report,
      totals: {
        ...report.totals,
        compareShipMom:
          priorAchieve && priorAchieve !== 0
            ? ((totalAchieve - priorAchieve) / priorAchieve) * 100
            : null,
        compareSaleMom:
          priorSale && priorSale !== 0 ? ((totalSale - priorSale) / priorSale) * 100 : null,
      },
    };
  }

  return report;
}

export const getShipmentVsAchieveReport = async (req: Request, res: Response) => {
  try {
    const { timeZone, financialYear } = parseReportQuery(req);

    if (!isShipmentVsAchieveLiveFy(financialYear)) {
      const hardcoded = buildHardcodedShipmentVsAchieveReport(financialYear);
      if (hardcoded) {
        return res.json(hardcoded);
      }
      // Unknown historical FY with no snapshot — return empty live-shaped shell (not editable)
      return res.json({
        financialYear,
        mode: "hardcoded",
        editable: false,
        rows: [],
        totals: {
          targetBasic: null,
          achieveBasic: null,
          achPercent: null,
          compareShipMom: null,
          saleBasic: null,
          dmsBasic: null,
          avgSalePerDay: null,
          compareSaleMom: null,
          incentive: null,
          car: null,
        },
        highlight: {
          maxAchieveMonthIndex: null,
          maxSaleMonthIndex: null,
          maxDmsMonthIndex: null,
        },
      });
    }

    const report = await buildLiveReport(financialYear, timeZone);
    res.json(report);
  } catch (error) {
    console.error("Dashboard shipment-vs-achieve error:", error);
    res.status(500).json({ message: "Failed to load shipment vs achieve" });
  }
};

const MANUAL_FIELDS = [
  "targetBasic",
  "incentive",
  "dmsBasic",
  "carDms",
  "schemeReceived",
  "schemeReleased",
  "incentiveReceived",
  "incentiveReleased",
] as const;

export const upsertShipmentVsAchieveMonth = async (req: Request, res: Response) => {
  try {
    const {
      financialYear,
      monthIndex,
      targetBasic,
      incentive,
      dmsBasic,
      carDms,
      schemeReceived,
      schemeReleased,
      incentiveReceived,
      incentiveReleased,
    } = req.body ?? {};

    if (!isValidFinancialYear(financialYear)) {
      return res.status(400).json({ message: "Valid financialYear is required" });
    }
    if (!isShipmentVsAchieveLiveFy(financialYear)) {
      return res.status(400).json({
        message: "Manual edits are only allowed for FY 2026-27 onward",
      });
    }
    if (
      typeof monthIndex !== "number" ||
      !Number.isInteger(monthIndex) ||
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      return res.status(400).json({ message: "monthIndex must be an integer 0–11" });
    }

    const data: Record<string, number | string | null> = {};
    const incoming: Record<string, unknown> = {
      targetBasic,
      incentive,
      dmsBasic,
      carDms,
      schemeReceived,
      schemeReleased,
      incentiveReceived,
      incentiveReleased,
    };

    for (const key of MANUAL_FIELDS) {
      if (!(key in req.body) || incoming[key] === undefined) continue;
      const value = incoming[key];
      if (value === null || value === "") {
        data[key] = null;
        continue;
      }
      if (
        key === "schemeReceived" ||
        key === "schemeReleased" ||
        key === "incentiveReceived" ||
        key === "incentiveReleased"
      ) {
        data[key] = String(value);
        continue;
      }
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (Number.isNaN(num)) {
        return res.status(400).json({ message: `Invalid number for ${key}` });
      }
      data[key] = num;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const row = await prisma.shipmentVsAchieveMonth.upsert({
      where: {
        financialYear_monthIndex: { financialYear, monthIndex },
      },
      update: data,
      create: {
        financialYear,
        monthIndex,
        ...data,
      },
    });

    res.json({ row });
  } catch (error) {
    console.error("Error upserting shipment vs achieve month:", error);
    res.status(500).json({ message: "Failed to save shipment vs achieve month" });
  }
};
