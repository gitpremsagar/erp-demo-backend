"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeTypeFromDelta = changeTypeFromDelta;
exports.defaultChangeDateIst = defaultChangeDateIst;
exports.toChangeDateIst = toChangeDateIst;
exports.buildStockRecordChangeFields = buildStockRecordChangeFields;
const indiaTime_1 = require("./indiaTime");
function changeTypeFromDelta(changeInStock) {
    if (changeInStock > 0)
        return "INCREASE";
    if (changeInStock < 0)
        return "DECREASE";
    throw new Error("changeInStock must be non-zero");
}
/** Current moment with explicit Asia/Kolkata wall clock (see `nowInIndia`). */
function defaultChangeDateIst() {
    return (0, indiaTime_1.nowInIndia)();
}
/**
 * Re-anchor a Date to the same calendar instant expressed in IST (+05:30),
 * avoiding ambiguous local-server interpretation.
 */
function toChangeDateIst(date) {
    const f = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = Object.fromEntries(f.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
    const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+05:30`;
    return new Date(iso);
}
function buildStockRecordChangeFields(params) {
    return {
        changeType: changeTypeFromDelta(params.changeInStock),
        changeDate: toChangeDateIst(params.changeDate),
    };
}
//# sourceMappingURL=stockRecordChangeMeta.js.map