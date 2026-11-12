"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMonthWiseSalesReport = exports.getMonthWiseSalesDetail = exports.getMonthWiseSalesReport = void 0;
const prisma_1 = require("../lib/prisma");
const monthWiseSalesReportAmount_1 = require("../lib/monthWiseSalesReportAmount");
const orderSaleAmount_1 = require("../lib/orderSaleAmount");
const financialYearWindow_1 = require("../lib/financialYearWindow");
const historicalMonthWiseReports_1 = require("../data/historicalMonthWiseReports");
function historicalTallyOverrides(financialYear) {
    return {
        months: (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_SALES_BY_FY, financialYear, "tally"),
        priorMarch: (0, historicalMonthWiseReports_1.historicalPriorMarch)(historicalMonthWiseReports_1.HISTORICAL_SALES_BY_FY, financialYear, "tally"),
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
const salesReturnInclude = {
    SalesReturnItem: {
        select: { productId: true, quantity: true },
    },
    order: { select: monthWiseSalesReportAmount_1.RETURN_CREDIT_ORDER_SELECT },
};
const creditNoteInclude = {
    CreditNoteItem: {
        select: { productId: true, quantity: true },
    },
    order: { select: monthWiseSalesReportAmount_1.RETURN_CREDIT_ORDER_SELECT },
};
const MONTH_SALE_DETAIL_ORDER_SELECT = {
    id: true,
    ...orderSaleAmount_1.REPORT_ORDER_SELECT,
    Customer: {
        select: {
            CustomerDetail: {
                select: { dbName: true, dbCategory: true },
                take: 1,
            },
        },
    },
};
const getMonthWiseSalesReport = async (req, res) => {
    try {
        const { timeZone, financialYear: endFinancialYear } = parseReportQuery(req);
        const completedOrderFilter = await (0, orderSaleAmount_1.getCompletedOrderFilter)();
        const [firstOrder, firstPersisted] = await Promise.all([
            prisma_1.prisma.order.findFirst({
                where: completedOrderFilter,
                orderBy: { orderDate: "asc" },
                select: { orderDate: true },
            }),
            prisma_1.prisma.monthWiseSalesReport.findFirst({
                orderBy: { financialYear: "asc" },
                select: { financialYear: true },
            }),
        ]);
        const earliestFy = (0, financialYearWindow_1.earliestFinancialYear)([
            firstOrder?.orderDate ? (0, financialYearWindow_1.fyFromDate)(new Date(firstOrder.orderDate), timeZone) : null,
            firstPersisted?.financialYear ?? null,
            historicalMonthWiseReports_1.HISTORICAL_FIRST_FY,
        ]);
        const windowYears = (0, financialYearWindow_1.buildFinancialYearWindow)(endFinancialYear, earliestFy);
        const priorFy = (0, financialYearWindow_1.shiftFinancialYear)(windowYears[0], -1);
        const queryStart = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(priorFy, timeZone).start;
        const queryEnd = (0, financialYearWindow_1.getFinancialYearEnd)(endFinancialYear, timeZone);
        const [orders, salesReturns, creditNotes, persistedRows] = await Promise.all([
            (0, orderSaleAmount_1.findReportOrders)({
                ...completedOrderFilter,
                orderDate: { gte: queryStart, lt: queryEnd },
            }),
            prisma_1.prisma.salesReturn.findMany({
                where: { returnDate: { gte: queryStart, lt: queryEnd } },
                include: salesReturnInclude,
            }),
            prisma_1.prisma.creditNote.findMany({
                where: { noteDate: { gte: queryStart, lt: queryEnd } },
                include: creditNoteInclude,
            }),
            prisma_1.prisma.monthWiseSalesReport.findMany({
                where: { financialYear: { in: windowYears } },
            }),
        ]);
        const priorFyTally = (0, monthWiseSalesReportAmount_1.computeMonthWiseSalesReportRows)(priorFy, orders, salesReturns, creditNotes, Array(12).fill(null), timeZone, historicalTallyOverrides(priorFy)).reduce((sum, r) => sum + r.tallyAchieved, 0);
        let previousYearTally = priorFyTally;
        const years = windowYears.map((financialYear) => {
            const persistedByIndex = new Map(persistedRows
                .filter((r) => r.financialYear === financialYear)
                .map((r) => [r.monthIndex, r]));
            const manualTargets = Array.from({ length: 12 }, (_, i) => persistedByIndex.get(i)?.primaryTarget ?? null);
            const tallyOverrides = historicalTallyOverrides(financialYear);
            const historicalDms = (0, historicalMonthWiseReports_1.historicalMonthValues)(historicalMonthWiseReports_1.HISTORICAL_SALES_BY_FY, financialYear, "dms");
            const computedRows = (0, monthWiseSalesReportAmount_1.computeMonthWiseSalesReportRows)(financialYear, orders, salesReturns, creditNotes, manualTargets, timeZone, tallyOverrides);
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
            const compareFromPreviousYear = previousYearTally === 0
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
    }
    catch (error) {
        console.error("Month-wise sales report error:", error);
        res.status(500).json({ message: "Failed to load month-wise sales report" });
    }
};
exports.getMonthWiseSalesReport = getMonthWiseSalesReport;
const getMonthWiseSalesDetail = async (req, res) => {
    try {
        const requestTimeZone = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
        const timeZone = resolveSafeTimeZoneLocal(requestTimeZone);
        const financialYear = typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
        const monthIndexRaw = req.query.monthIndex;
        if (!financialYear || !isValidFinancialYear(financialYear)) {
            return res.status(400).json({ message: "Valid financialYear is required" });
        }
        const monthIndex = typeof monthIndexRaw === "string" ? parseInt(monthIndexRaw, 10) : Number(monthIndexRaw);
        if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
            return res.status(400).json({ message: "monthIndex must be an integer from 0 to 11" });
        }
        const buckets = (0, monthWiseSalesReportAmount_1.buildFyMonthBuckets)(financialYear, timeZone);
        const bucket = buckets[monthIndex];
        const completedOrderFilter = await (0, orderSaleAmount_1.getCompletedOrderFilter)();
        const orders = await prisma_1.prisma.order.findMany({
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
            orderValueBasic: (0, orderSaleAmount_1.computeOrderGrossSaleForReport)(o),
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
    }
    catch (error) {
        console.error("Month-wise sales detail error:", error);
        res.status(500).json({ message: "Failed to load month-wise sales detail" });
    }
};
exports.getMonthWiseSalesDetail = getMonthWiseSalesDetail;
const upsertMonthWiseSalesReport = async (req, res) => {
    try {
        const { financialYear, monthIndex, primaryTarget, dmsAchieved, remark } = req.body;
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
        if (primaryTarget !== undefined)
            updateData.primaryTarget = primaryTarget;
        if (dmsAchieved !== undefined)
            updateData.dmsAchieved = dmsAchieved;
        if (remark !== undefined)
            updateData.remark = remark;
        const entry = await prisma_1.prisma.monthWiseSalesReport.upsert({
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
    }
    catch (error) {
        console.error("Upsert month-wise sales report error:", error);
        res.status(500).json({ message: "Failed to save month-wise sales report entry" });
    }
};
exports.upsertMonthWiseSalesReport = upsertMonthWiseSalesReport;
//# sourceMappingURL=monthWiseSalesReport.controller.js.map