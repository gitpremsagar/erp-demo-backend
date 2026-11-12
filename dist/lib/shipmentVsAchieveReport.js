"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isShipmentVsAchieveLiveFy = exports.RETURN_CREDIT_ORDER_SELECT = exports.REPORT_ORDER_SELECT = void 0;
exports.buildHardcodedShipmentVsAchieveReport = buildHardcodedShipmentVsAchieveReport;
exports.assembleLiveShipmentVsAchieveReport = assembleLiveShipmentVsAchieveReport;
const monthWiseSalesReportAmount_1 = require("./monthWiseSalesReportAmount");
Object.defineProperty(exports, "RETURN_CREDIT_ORDER_SELECT", { enumerable: true, get: function () { return monthWiseSalesReportAmount_1.RETURN_CREDIT_ORDER_SELECT; } });
const orderSaleAmount_1 = require("./orderSaleAmount");
Object.defineProperty(exports, "REPORT_ORDER_SELECT", { enumerable: true, get: function () { return orderSaleAmount_1.REPORT_ORDER_SELECT; } });
const purchaseItemPriceSnapshot_1 = require("./purchaseItemPriceSnapshot");
const shipmentVsAchieveHardcoded_1 = require("../data/shipmentVsAchieveHardcoded");
Object.defineProperty(exports, "isShipmentVsAchieveLiveFy", { enumerable: true, get: function () { return shipmentVsAchieveHardcoded_1.isShipmentVsAchieveLiveFy; } });
function pct(numerator, denominator) {
    if (denominator === 0)
        return null;
    return (numerator / denominator) * 100;
}
function mom(current, previous) {
    if (previous === null || previous === 0)
        return null;
    return ((current - previous) / previous) * 100;
}
function sumNullable(values) {
    return values.reduce((s, v) => s + (v ?? 0), 0);
}
function maxIndex(values) {
    let bestIdx = null;
    let bestVal = -Infinity;
    values.forEach((v, i) => {
        if (v === null || v === undefined)
            return;
        if (v > bestVal) {
            bestVal = v;
            bestIdx = i;
        }
    });
    return bestIdx;
}
function buildHighlight(rows) {
    return {
        maxAchieveMonthIndex: maxIndex(rows.map((r) => r.achieveBasic)),
        maxSaleMonthIndex: maxIndex(rows.map((r) => r.saleBasic)),
        maxDmsMonthIndex: maxIndex(rows.map((r) => r.dmsBasic)),
    };
}
function emptyManual() {
    return {
        targetBasic: null,
        incentive: null,
        dmsBasic: null,
        carDms: null,
        schemeReceived: null,
        schemeReleased: null,
        incentiveReceived: null,
        incentiveReleased: null,
    };
}
function buildHardcodedShipmentVsAchieveReport(financialYear) {
    const snap = (0, shipmentVsAchieveHardcoded_1.getHardcodedShipmentVsAchieve)(financialYear);
    if (!snap)
        return null;
    return {
        financialYear: snap.financialYear,
        mode: "hardcoded",
        editable: false,
        rows: snap.rows,
        totals: snap.totals,
        highlight: buildHighlight(snap.rows),
    };
}
function getPriorMarchAchieveAndSale(financialYear, livePriorMarchAchieve, livePriorMarchSale) {
    const priorFy = (0, monthWiseSalesReportAmount_1.getPriorFinancialYear)(financialYear);
    const hardcoded = (0, shipmentVsAchieveHardcoded_1.getHardcodedShipmentVsAchieve)(priorFy);
    if (hardcoded) {
        const mar = hardcoded.rows[11];
        return {
            achieve: mar.achieveBasic ?? 0,
            sale: mar.saleBasic ?? 0,
        };
    }
    return { achieve: livePriorMarchAchieve, sale: livePriorMarchSale };
}
function getPriorFyTotalsForYoy(financialYear) {
    const priorFy = (0, monthWiseSalesReportAmount_1.getPriorFinancialYear)(financialYear);
    const hardcoded = (0, shipmentVsAchieveHardcoded_1.getHardcodedShipmentVsAchieve)(priorFy);
    if (hardcoded) {
        return {
            achieveBasic: hardcoded.totals.achieveBasic,
            saleBasic: hardcoded.totals.saleBasic,
        };
    }
    return { achieveBasic: null, saleBasic: null };
}
function computePriorMarchSale(orders, salesReturns, creditNotes, priorMarch) {
    let sales = 0;
    let deductions = 0;
    for (const order of orders) {
        const d = new Date(order.orderDate);
        if (d >= priorMarch.start && d < priorMarch.end) {
            sales += (0, orderSaleAmount_1.computeOrderGrossSaleForReport)(order);
        }
    }
    for (const sr of salesReturns) {
        const d = new Date(sr.returnDate);
        if (d < priorMarch.start || d >= priorMarch.end)
            continue;
        for (const item of sr.SalesReturnItem) {
            deductions += (0, monthWiseSalesReportAmount_1.computeReturnLineGrossAmount)(sr.order, item.productId, item.quantity);
        }
    }
    for (const cn of creditNotes) {
        const d = new Date(cn.noteDate);
        if (d < priorMarch.start || d >= priorMarch.end)
            continue;
        for (const item of cn.CreditNoteItem) {
            deductions += (0, monthWiseSalesReportAmount_1.computeReturnLineGrossAmount)(cn.order, item.productId, item.quantity);
        }
    }
    return sales - deductions;
}
function assembleLiveShipmentVsAchieveReport(args) {
    const { financialYear } = args;
    const timeZone = (0, orderSaleAmount_1.resolveSafeTimeZone)(args.timeZone);
    const buckets = (0, monthWiseSalesReportAmount_1.buildFyMonthBuckets)(financialYear, timeZone);
    const priorMarch = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(financialYear, timeZone);
    const achieveByMonth = new Array(12).fill(0);
    const carByMonth = new Array(12).fill(0);
    let priorMarchAchieveLive = 0;
    for (const inv of args.invoices) {
        if (!inv.invoiceDate)
            continue;
        const d = new Date(inv.invoiceDate);
        const basic = (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceBasicFromItems)(inv.PurchaseInvoiceItem);
        const car = inv.PurchaseInvoiceItem.reduce((s, item) => s + (item.quantity ?? 0), 0);
        const monthIdx = buckets.findIndex((b) => d >= b.start && d < b.end);
        if (monthIdx >= 0) {
            achieveByMonth[monthIdx] += basic;
            carByMonth[monthIdx] += car;
            continue;
        }
        if (d >= priorMarch.start && d < priorMarch.end) {
            priorMarchAchieveLive += basic;
        }
    }
    const saleRows = (0, monthWiseSalesReportAmount_1.computeMonthWiseSalesReportRows)(financialYear, args.orders, args.salesReturns, args.creditNotes, Array(12).fill(null), timeZone);
    const saleByMonth = saleRows.map((r) => r.tallyAchieved);
    const priorMarchSaleLive = computePriorMarchSale(args.orders, args.salesReturns, args.creditNotes, priorMarch);
    const priorFromHardOrLive = getPriorMarchAchieveAndSale(financialYear, priorMarchAchieveLive, priorMarchSaleLive);
    const manualByIndex = new Map(args.manualRows.map((r) => [r.monthIndex, r]));
    const rows = buckets.map((bucket, monthIndex) => {
        const manual = { ...emptyManual(), ...(manualByIndex.get(monthIndex) ?? {}) };
        const q = Math.floor(monthIndex / 3);
        const qStart = q * 3;
        const isQStart = monthIndex === qStart;
        const achieveBasic = achieveByMonth[monthIndex];
        const car = carByMonth[monthIndex];
        const saleBasic = saleByMonth[monthIndex];
        const targetBasic = manual.targetBasic ?? null;
        const prevAchieve = monthIndex === 0 ? priorFromHardOrLive.achieve : achieveByMonth[monthIndex - 1];
        const prevSale = monthIndex === 0 ? priorFromHardOrLive.sale : saleByMonth[monthIndex - 1];
        return {
            monthIndex,
            monthLabel: bucket.monthLabel,
            quarter: isQStart ? `Q${q + 1} ${financialYear}` : null,
            targetBasic,
            achieveBasic,
            qWiseAchieveBasic: null,
            car,
            qWiseCar: null,
            achPercent: targetBasic !== null ? pct(achieveBasic, targetBasic) : null,
            quarterAchPercent: null,
            compareShipMom: mom(achieveBasic, prevAchieve),
            incentive: manual.incentive ?? null,
            saleBasic,
            dmsBasic: manual.dmsBasic ?? null,
            qWiseDmsBasic: null,
            carDms: manual.carDms ?? null,
            qWiseCarDms: null,
            avgSalePerDay: saleBasic / (0, orderSaleAmount_1.getDaysInMonth)(bucket.calendarYear, bucket.calendarMonth),
            compareSaleMom: mom(saleBasic, prevSale),
            schemeReceived: manual.schemeReceived ?? null,
            schemeReleased: manual.schemeReleased ?? null,
            incentiveReceived: manual.incentiveReceived ?? null,
            incentiveReleased: manual.incentiveReleased ?? null,
        };
    });
    for (let q = 0; q < 4; q++) {
        const start = q * 3;
        const qTarget = sumNullable([
            rows[start].targetBasic,
            rows[start + 1].targetBasic,
            rows[start + 2].targetBasic,
        ]);
        const qAchieve = sumNullable([
            rows[start].achieveBasic,
            rows[start + 1].achieveBasic,
            rows[start + 2].achieveBasic,
        ]);
        rows[start].qWiseAchieveBasic = qAchieve;
        rows[start].qWiseCar = sumNullable([
            rows[start].car,
            rows[start + 1].car,
            rows[start + 2].car,
        ]);
        rows[start].qWiseDmsBasic = sumNullable([
            rows[start].dmsBasic,
            rows[start + 1].dmsBasic,
            rows[start + 2].dmsBasic,
        ]);
        rows[start].qWiseCarDms = sumNullable([
            rows[start].carDms,
            rows[start + 1].carDms,
            rows[start + 2].carDms,
        ]);
        rows[start].quarterAchPercent = pct(qAchieve, qTarget);
    }
    const totalTarget = sumNullable(rows.map((r) => r.targetBasic));
    const totalAchieve = sumNullable(rows.map((r) => r.achieveBasic));
    const totalSale = sumNullable(rows.map((r) => r.saleBasic));
    const totalDms = sumNullable(rows.map((r) => r.dmsBasic));
    const totalIncentive = sumNullable(rows.map((r) => r.incentive));
    const totalCar = sumNullable(rows.map((r) => r.car));
    const priorTotals = getPriorFyTotalsForYoy(financialYear);
    // For live years after the first, prior totals may need live computation — caller can pass
    // extended prior FY later; for 2026-27 prior is hardcoded 2025-26.
    let compareShipMom = priorTotals.achieveBasic !== null && priorTotals.achieveBasic !== 0
        ? pct(totalAchieve - priorTotals.achieveBasic, priorTotals.achieveBasic)
        : null;
    let compareSaleMom = priorTotals.saleBasic !== null && priorTotals.saleBasic !== 0
        ? pct(totalSale - priorTotals.saleBasic, priorTotals.saleBasic)
        : null;
    // If prior FY was also live (no hardcoded), YoY left null unless we computed prior totals externally.
    if (priorTotals.achieveBasic === null && (0, shipmentVsAchieveHardcoded_1.isShipmentVsAchieveLiveFy)((0, monthWiseSalesReportAmount_1.getPriorFinancialYear)(financialYear))) {
        compareShipMom = null;
        compareSaleMom = null;
    }
    const totals = {
        targetBasic: totalTarget,
        achieveBasic: totalAchieve,
        achPercent: pct(totalAchieve, totalTarget),
        compareShipMom,
        saleBasic: totalSale,
        dmsBasic: totalDms,
        avgSalePerDay: totalSale / 12,
        compareSaleMom,
        incentive: totalIncentive,
        car: totalCar,
    };
    return {
        financialYear,
        mode: "live",
        editable: (0, shipmentVsAchieveHardcoded_1.isShipmentVsAchieveLiveFy)(financialYear),
        rows,
        totals,
        highlight: buildHighlight(rows),
    };
}
//# sourceMappingURL=shipmentVsAchieveReport.js.map