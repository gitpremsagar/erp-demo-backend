"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fyStartYear = fyStartYear;
exports.formatFinancialYear = formatFinancialYear;
exports.shiftFinancialYear = shiftFinancialYear;
exports.fyFromDate = fyFromDate;
exports.getFinancialYearStart = getFinancialYearStart;
exports.getFinancialYearEnd = getFinancialYearEnd;
exports.buildFinancialYearWindow = buildFinancialYearWindow;
exports.earliestFinancialYear = earliestFinancialYear;
const orderSaleAmount_1 = require("./orderSaleAmount");
function fyStartYear(fy) {
    return parseInt(fy.split("-")[0], 10);
}
function formatFinancialYear(startYear) {
    return `${startYear}-${String(startYear + 1).slice(2)}`;
}
function shiftFinancialYear(fy, delta) {
    return formatFinancialYear(fyStartYear(fy) + delta);
}
function fyFromDate(date, timeZone) {
    const parts = (0, orderSaleAmount_1.getZonedDateParts)(date, timeZone);
    return formatFinancialYear(parts.month >= 4 ? parts.year : parts.year - 1);
}
function getFinancialYearStart(fy, timeZone) {
    return (0, orderSaleAmount_1.zonedDateTimeToUtcDate)(timeZone, fyStartYear(fy), 3, 1, 0, 0, 0, 0);
}
function getFinancialYearEnd(fy, timeZone) {
    return (0, orderSaleAmount_1.zonedDateTimeToUtcDate)(timeZone, fyStartYear(fy) + 1, 3, 1, 0, 0, 0, 0);
}
/** Oldest first; starts at the later of (endFy - maxYears + 1) and earliestFy. */
function buildFinancialYearWindow(endFy, earliestFy, maxYears = 10) {
    const endStart = fyStartYear(endFy);
    let firstStart = endStart - (maxYears - 1);
    if (earliestFy) {
        firstStart = Math.max(firstStart, Math.min(fyStartYear(earliestFy), endStart));
    }
    else {
        firstStart = endStart;
    }
    const years = [];
    for (let y = firstStart; y <= endStart; y++) {
        years.push(formatFinancialYear(y));
    }
    return years;
}
function earliestFinancialYear(candidates) {
    const valid = candidates.filter((fy) => Boolean(fy));
    if (valid.length === 0)
        return null;
    return valid.reduce((min, fy) => (fyStartYear(fy) < fyStartYear(min) ? fy : min));
}
//# sourceMappingURL=financialYearWindow.js.map