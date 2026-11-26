"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeText = normalizeText;
exports.normalizeCode = normalizeCode;
exports.levenshtein = levenshtein;
exports.similarity = similarity;
exports.isObjectId = isObjectId;
exports.toPositiveInt = toPositiveInt;
exports.safeJsonParse = safeJsonParse;
exports.truncateText = truncateText;
exports.truncateCell = truncateCell;
exports.formatInr = formatInr;
exports.formatNumber = formatNumber;
exports.istDateString = istDateString;
exports.istNowLabel = istNowLabel;
exports.parseDateOnly = parseDateOnly;
exports.istDayStart = istDayStart;
exports.istDayEnd = istDayEnd;
exports.resolveDateRange = resolveDateRange;
exports.pickString = pickString;
exports.pickStringArray = pickStringArray;
exports.summaryJson = summaryJson;
const IST_TIME_ZONE = "Asia/Kolkata";
function normalizeText(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeCode(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
function levenshtein(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    const previous = new Array(b.length + 1);
    const current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1)
        previous[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
        }
        for (let j = 0; j <= b.length; j += 1)
            previous[j] = current[j];
    }
    return previous[b.length];
}
function similarity(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);
    if (!left || !right)
        return 0;
    if (left === right)
        return 1;
    const maxLength = Math.max(left.length, right.length);
    if (maxLength === 0)
        return 0;
    return 1 - levenshtein(left, right) / maxLength;
}
function isObjectId(value) {
    return typeof value === "string" && /^[a-f\d]{24}$/i.test(value.trim());
}
function toPositiveInt(value, fallback, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return Math.min(Math.floor(parsed), max);
}
function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function truncateText(value, max = 6000) {
    if (value.length <= max)
        return value;
    return `${value.slice(0, max)}\n...[truncated]`;
}
function truncateCell(value, max = 150) {
    if (value === null || value === undefined)
        return null;
    const text = String(value).replace(/\s+/g, " ").trim();
    if (!text)
        return null;
    return text.length > max ? text.slice(0, max) : text;
}
function formatInr(value) {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        }).format(value);
    }
    catch {
        return `₹${value.toFixed(2)}`;
    }
}
function formatNumber(value) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}
function istDateString(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}
function istNowLabel(date = new Date()) {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: IST_TIME_ZONE,
        dateStyle: "full",
        timeStyle: "short",
    }).format(date);
}
/** Defensive date-only parser: accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY and Date objects. */
function parseDateOnly(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return istDateString(value);
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        // Excel serial date (1900 date system). 25569 days between 1899-12-30 and 1970-01-01.
        if (value > 20000 && value < 80000) {
            const millis = Math.round((value - 25569) * 86400 * 1000);
            return istDateString(new Date(millis));
        }
        return null;
    }
    const text = String(value ?? "").trim();
    if (!text)
        return null;
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso)
        return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dmy) {
        const day = dmy[1].padStart(2, "0");
        const month = dmy[2].padStart(2, "0");
        let year = dmy[3];
        if (year.length === 2)
            year = `20${year}`;
        return `${year}-${month}-${day}`;
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime()))
        return istDateString(parsed);
    return null;
}
function istDayStart(dateOnly) {
    return new Date(`${dateOnly}T00:00:00.000+05:30`);
}
function istDayEnd(dateOnly) {
    return new Date(`${dateOnly}T23:59:59.999+05:30`);
}
function resolveDateRange(fromValue, toValue, defaultDays, maxDays) {
    const today = istDateString();
    const to = parseDateOnly(toValue) ?? today;
    const fallbackFrom = new Date(istDayStart(to).getTime() - (defaultDays - 1) * 86400 * 1000);
    const from = parseDateOnly(fromValue) ?? istDateString(fallbackFrom);
    const rawFrom = istDayStart(from);
    const rawTo = istDayEnd(to);
    const maxMillis = maxDays * 86400 * 1000;
    if (rawTo.getTime() - rawFrom.getTime() > maxMillis) {
        const cappedFrom = new Date(rawTo.getTime() - maxMillis);
        return { from: istDateString(cappedFrom), to, fromDate: cappedFrom, toDate: rawTo };
    }
    return { from, to, fromDate: rawFrom, toDate: rawTo };
}
function pickString(value, maxLength = 200) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    return trimmed.slice(0, maxLength);
}
function pickStringArray(value, maxItems = 10) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => pickString(entry, 80))
        .filter((entry) => Boolean(entry))
        .slice(0, maxItems);
}
function summaryJson(value, max = 400) {
    try {
        return truncateText(JSON.stringify(value), max);
    }
    catch {
        return "[unserializable]";
    }
}
//# sourceMappingURL=ai.utils.js.map