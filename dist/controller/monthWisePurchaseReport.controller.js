"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMonthWisePurchaseReport = exports.getMonthWisePurchaseReport = void 0;
const prisma_1 = require("../lib/prisma");
const monthWisePurchaseReportAmount_1 = require("../lib/monthWisePurchaseReportAmount");
const monthWiseSalesReportAmount_1 = require("../lib/monthWiseSalesReportAmount");
const orderSaleAmount_1 = require("../lib/orderSaleAmount");
const financialYearWindow_1 = require("../lib/financialYearWindow");
const historicalMonthWiseReports_1 = require("../data/historicalMonthWiseReports");
function historicalAchievedOverrides(financialYear) {
    return {
        months: (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
        priorMarch: (0, historicalMonthWiseReports_1.historicalPriorMarch)(historicalMonthWiseReports_1.HISTORICAL_PURCHASE_BY_FY, financialYear, "achieved"),
    };
}
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
const getMonthWisePurchaseReport = async (req, res) => {
    try {
        const { timeZone, financialYear: endFinancialYear } = parseReportQuery(req);
        const [firstInvoice, firstPersisted] = await Promise.all([
            prisma_1.prisma.purchaseInvoice.findFirst({
                where: { invoiceDate: { not: null } },
                orderBy: { invoiceDate: "asc" },
                select: { invoiceDate: true },
            }),
            prisma_1.prisma.monthWisePurchaseReport.findFirst({
                orderBy: { financialYear: "asc" },
                select: { financialYear: true },
            }),
        ]);
        const earliestFy = (0, financialYearWindow_1.earliestFinancialYear)([
            firstInvoice?.invoiceDate ? (0, financialYearWindow_1.fyFromDate)(new Date(firstInvoice.invoiceDate), timeZone) : null,
            firstPersisted?.financialYear ?? null,
            historicalMonthWiseReports_1.HISTORICAL_FIRST_FY,
        ]);
        const windowYears = (0, financialYearWindow_1.buildFinancialYearWindow)(endFinancialYear, earliestFy);
        const priorFy = (0, financialYearWindow_1.shiftFinancialYear)(windowYears[0], -1);
        const queryStart = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(priorFy, timeZone).start;
        const queryEnd = (0, financialYearWindow_1.getFinancialYearEnd)(endFinancialYear, timeZone);
        const [invoices, persistedRows] = await Promise.all([
            prisma_1.prisma.purchaseInvoice.findMany({
                where: { invoiceDate: { gte: queryStart, lt: queryEnd } },
                select: { invoiceAmount: true, invoiceDate: true },
            }),
            prisma_1.prisma.monthWisePurchaseReport.findMany({
                where: { financialYear: { in: windowYears } },
            }),
        ]);
        let previousYearAchieved = (0, monthWisePurchaseReportAmount_1.computeMonthWisePurchaseReportRows)(priorFy, invoices, Array(12).fill(null), timeZone, historicalAchievedOverrides(priorFy)).reduce((sum, r) => sum + r.achieved, 0);
        const years = windowYears.map((financialYear) => {
            const persistedByIndex = new Map(persistedRows
                .filter((r) => r.financialYear === financialYear)
                .map((r) => [r.monthIndex, r]));
            const historicalTargets = (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_PURCHASE_BY_FY, financialYear, "target");
            const manualTargets = Array.from({ length: 12 }, (_, monthIndex) => persistedByIndex.get(monthIndex)?.target ?? historicalTargets[monthIndex]);
            const computedRows = (0, monthWisePurchaseReportAmount_1.computeMonthWisePurchaseReportRows)(financialYear, invoices, manualTargets, timeZone, historicalAchievedOverrides(financialYear));
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
            const compareFromPreviousYear = previousYearAchieved === 0
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
    }
    catch (error) {
        console.error("Month-wise purchase report error:", error);
        res.status(500).json({ message: "Failed to load month-wise purchase report" });
    }
};
exports.getMonthWisePurchaseReport = getMonthWisePurchaseReport;
const upsertMonthWisePurchaseReport = async (req, res) => {
    try {
        const { financialYear, monthIndex, target, remark } = req.body;
        if (!financialYear || monthIndex === undefined || monthIndex === null) {
            return res.status(400).json({ message: "financialYear and monthIndex are required" });
        }
        if (!isValidFinancialYear(financialYear)) {
            return res.status(400).json({ message: "Invalid financialYear format" });
        }
        if (monthIndex < 0 || monthIndex > 11 || !Number.isInteger(monthIndex)) {
            return res.status(400).json({ message: "monthIndex must be an integer from 0 to 11" });
        }
        const updateData = {};
        if (target !== undefined)
            updateData.target = target;
        if (remark !== undefined)
            updateData.remark = remark;
        const entry = await prisma_1.prisma.monthWisePurchaseReport.upsert({
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
    }
    catch (error) {
        console.error("Upsert month-wise purchase report error:", error);
        res.status(500).json({ message: "Failed to save month-wise purchase report entry" });
    }
};
exports.upsertMonthWisePurchaseReport = upsertMonthWisePurchaseReport;
//# sourceMappingURL=monthWisePurchaseReport.controller.js.map