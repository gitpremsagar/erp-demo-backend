"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertShipmentVsAchieveMonth = exports.getShipmentVsAchieveReport = void 0;
const prisma_1 = require("../lib/prisma");
const monthWiseSalesReportAmount_1 = require("../lib/monthWiseSalesReportAmount");
const orderSaleAmount_1 = require("../lib/orderSaleAmount");
const shipmentVsAchieveReport_1 = require("../lib/shipmentVsAchieveReport");
const shipmentVsAchieveHardcoded_1 = require("../data/shipmentVsAchieveHardcoded");
function resolveSafeTimeZoneLocal(timeZone) {
    if (!timeZone)
        return "Asia/Kolkata";
    try {
        Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return timeZone;
    }
    catch {
        return "Asia/Kolkata";
    }
}
function getFinancialYearFromZonedParts(parts) {
    if (parts.month >= 4)
        return `${parts.year}-${String(parts.year + 1).slice(2)}`;
    return `${parts.year - 1}-${String(parts.year).slice(2)}`;
}
function isValidFinancialYear(fy) {
    if (!fy)
        return false;
    const match = /^(\d{4})-(\d{2})$/.exec(fy);
    if (!match)
        return false;
    const startYear = Number(match[1]);
    const endTwoDigits = Number(match[2]);
    return (startYear + 1) % 100 === endTwoDigits;
}
function getFinancialYearRange(fy, timeZone) {
    const startYear = parseInt(fy.split("-")[0], 10);
    const start = (0, orderSaleAmount_1.zonedDateTimeToUtcDate)(timeZone, startYear, 3, 1, 0, 0, 0, 0);
    const end = (0, orderSaleAmount_1.zonedDateTimeToUtcDate)(timeZone, startYear + 1, 3, 1, 0, 0, 0, 0);
    return { start, end };
}
function parseReportQuery(req) {
    const requestTimeZone = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
    const timeZone = resolveSafeTimeZoneLocal(requestTimeZone);
    const now = new Date();
    const nowParts = (0, orderSaleAmount_1.getZonedDateParts)(now, timeZone);
    const queryFinancialYear = typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
    const financialYear = isValidFinancialYear(queryFinancialYear)
        ? queryFinancialYear
        : getFinancialYearFromZonedParts(nowParts);
    return { timeZone, financialYear };
}
const salesReturnInclude = {
    SalesReturnItem: {
        select: { productId: true, quantity: true },
    },
    order: { select: shipmentVsAchieveReport_1.RETURN_CREDIT_ORDER_SELECT },
};
const creditNoteInclude = {
    CreditNoteItem: {
        select: { productId: true, quantity: true },
    },
    order: { select: shipmentVsAchieveReport_1.RETURN_CREDIT_ORDER_SELECT },
};
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
};
async function buildLiveReport(financialYear, timeZone) {
    const fyRange = getFinancialYearRange(financialYear, timeZone);
    const priorMarch = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(financialYear, timeZone);
    const queryStart = priorMarch.start;
    const queryEnd = fyRange.end;
    const completedOrderFilter = await (0, orderSaleAmount_1.getCompletedOrderFilter)();
    const [orders, salesReturns, creditNotes, invoices, manualRows] = await Promise.all([
        prisma_1.prisma.order.findMany({
            where: {
                ...completedOrderFilter,
                orderDate: { gte: queryStart, lt: queryEnd },
            },
            select: shipmentVsAchieveReport_1.REPORT_ORDER_SELECT,
        }),
        prisma_1.prisma.salesReturn.findMany({
            where: { returnDate: { gte: queryStart, lt: queryEnd } },
            include: salesReturnInclude,
        }),
        prisma_1.prisma.creditNote.findMany({
            where: { noteDate: { gte: queryStart, lt: queryEnd } },
            include: creditNoteInclude,
        }),
        prisma_1.prisma.purchaseInvoice.findMany({
            where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
            select: PURCHASE_INVOICE_SELECT,
        }),
        prisma_1.prisma.shipmentVsAchieveMonth.findMany({
            where: { financialYear },
        }),
    ]);
    let report = (0, shipmentVsAchieveReport_1.assembleLiveShipmentVsAchieveReport)({
        financialYear,
        timeZone,
        invoices,
        orders,
        salesReturns,
        creditNotes,
        manualRows,
    });
    // When prior FY is also live (e.g. 2027-28), compute prior totals for YoY
    const priorFy = (0, monthWiseSalesReportAmount_1.getPriorFinancialYear)(financialYear);
    if ((0, shipmentVsAchieveReport_1.isShipmentVsAchieveLiveFy)(priorFy) && !(0, shipmentVsAchieveHardcoded_1.getHardcodedShipmentVsAchieve)(priorFy)) {
        const priorReport = await buildLiveReport(priorFy, timeZone);
        const totalAchieve = report.totals.achieveBasic ?? 0;
        const totalSale = report.totals.saleBasic ?? 0;
        const priorAchieve = priorReport.totals.achieveBasic;
        const priorSale = priorReport.totals.saleBasic;
        report = {
            ...report,
            totals: {
                ...report.totals,
                compareShipMom: priorAchieve && priorAchieve !== 0
                    ? ((totalAchieve - priorAchieve) / priorAchieve) * 100
                    : null,
                compareSaleMom: priorSale && priorSale !== 0 ? ((totalSale - priorSale) / priorSale) * 100 : null,
            },
        };
    }
    return report;
}
const getShipmentVsAchieveReport = async (req, res) => {
    try {
        const { timeZone, financialYear } = parseReportQuery(req);
        if (!(0, shipmentVsAchieveReport_1.isShipmentVsAchieveLiveFy)(financialYear)) {
            const hardcoded = (0, shipmentVsAchieveReport_1.buildHardcodedShipmentVsAchieveReport)(financialYear);
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
    }
    catch (error) {
        console.error("Dashboard shipment-vs-achieve error:", error);
        res.status(500).json({ message: "Failed to load shipment vs achieve" });
    }
};
exports.getShipmentVsAchieveReport = getShipmentVsAchieveReport;
const MANUAL_FIELDS = [
    "targetBasic",
    "incentive",
    "dmsBasic",
    "carDms",
    "schemeReceived",
    "schemeReleased",
    "incentiveReceived",
    "incentiveReleased",
];
const upsertShipmentVsAchieveMonth = async (req, res) => {
    try {
        const { financialYear, monthIndex, targetBasic, incentive, dmsBasic, carDms, schemeReceived, schemeReleased, incentiveReceived, incentiveReleased, } = req.body ?? {};
        if (!isValidFinancialYear(financialYear)) {
            return res.status(400).json({ message: "Valid financialYear is required" });
        }
        if (!(0, shipmentVsAchieveReport_1.isShipmentVsAchieveLiveFy)(financialYear)) {
            return res.status(400).json({
                message: "Manual edits are only allowed for FY 2026-27 onward",
            });
        }
        if (typeof monthIndex !== "number" ||
            !Number.isInteger(monthIndex) ||
            monthIndex < 0 ||
            monthIndex > 11) {
            return res.status(400).json({ message: "monthIndex must be an integer 0–11" });
        }
        const data = {};
        const incoming = {
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
            if (!(key in req.body) || incoming[key] === undefined)
                continue;
            const value = incoming[key];
            if (value === null || value === "") {
                data[key] = null;
                continue;
            }
            if (key === "schemeReceived" ||
                key === "schemeReleased" ||
                key === "incentiveReceived" ||
                key === "incentiveReleased") {
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
        const row = await prisma_1.prisma.shipmentVsAchieveMonth.upsert({
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
    }
    catch (error) {
        console.error("Error upserting shipment vs achieve month:", error);
        res.status(500).json({ message: "Failed to save shipment vs achieve month" });
    }
};
exports.upsertShipmentVsAchieveMonth = upsertShipmentVsAchieveMonth;
//# sourceMappingURL=shipmentVsAchieveReport.controller.js.map