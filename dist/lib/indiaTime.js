"use strict";
/** Indian Standard Time (Asia/Kolkata). No DST — offset is always +05:30. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowInIndia = nowInIndia;
/**
 * Current moment as a `Date`, anchored explicitly to `Asia/Kolkata` wall clock
 * (ISO string with +05:30). Same UTC instant as `new Date()`; not dependent on
 * the server's local timezone setting.
 */
function nowInIndia() {
    const d = new Date();
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
    const parts = Object.fromEntries(f.formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
    const ms = d.getMilliseconds().toString().padStart(3, "0");
    const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${ms}+05:30`;
    return new Date(iso);
}
//# sourceMappingURL=indiaTime.js.map