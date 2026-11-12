"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMonthWisePurchaseReportRows = computeMonthWisePurchaseReportRows;
const monthWiseSalesReportAmount_1 = require("./monthWiseSalesReportAmount");
function isDateInRange(date, start, end) {
    return date >= start && date < end;
}
function sumAchievedInRange(invoices, start, end) {
    return invoices
        .filter((inv) => {
        if (!inv.invoiceDate)
            return false;
        const d = new Date(inv.invoiceDate);
        return isDateInRange(d, start, end);
    })
        .reduce((sum, inv) => sum + (inv.invoiceAmount ?? 0), 0);
}
function computeMonthWisePurchaseReportRows(financialYear, invoices, manualTargets, timeZone, achievedOverrides) {
    const buckets = (0, monthWiseSalesReportAmount_1.buildFyMonthBuckets)(financialYear, timeZone);
    const priorMarch = (0, monthWiseSalesReportAmount_1.getMarchPriorFyBucket)(financialYear, timeZone);
    const achievedByMonth = buckets.map((bucket, i) => achievedOverrides?.months[i] ?? sumAchievedInRange(invoices, bucket.start, bucket.end));
    const priorMarchAchieved = achievedOverrides?.priorMarch ??
        sumAchievedInRange(invoices, priorMarch.start, priorMarch.end);
    const quarterTarget = [0, 0, 0, 0];
    const quarterAchieved = [0, 0, 0, 0];
    for (let q = 0; q < 4; q++) {
        const start = q * 3;
        for (let j = start; j < start + 3; j++) {
            quarterTarget[q] += manualTargets[j] ?? 0;
            quarterAchieved[q] += achievedByMonth[j];
        }
    }
    return buckets.map((bucket, monthIndex) => {
        const achieved = achievedByMonth[monthIndex];
        const target = manualTargets[monthIndex] ?? null;
        const quarterIndex = Math.floor(monthIndex / 3);
        const qWiseTarget = quarterTarget[quarterIndex];
        const qWiseAchieved = quarterAchieved[quarterIndex];
        const achievePercent = target !== null && target > 0 ? (achieved / target) * 100 : null;
        const quarterAchievePercent = qWiseTarget > 0 ? (qWiseAchieved / qWiseTarget) * 100 : null;
        const previousAchieved = monthIndex === 0 ? priorMarchAchieved : achievedByMonth[monthIndex - 1];
        const compareFromPreviousMonth = previousAchieved === 0 ? null : ((achieved - previousAchieved) / previousAchieved) * 100;
        return {
            monthIndex: bucket.monthIndex,
            monthLabel: bucket.monthLabel,
            achieved,
            qWiseTarget,
            qWiseAchieved,
            achievePercent,
            quarterAchievePercent,
            compareFromPreviousMonth,
        };
    });
}
//# sourceMappingURL=monthWisePurchaseReportAmount.js.map