"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAREHOUSE_EMPLOYEE_TYPES = exports.ATTENDANCE_GRACE_MINUTES = exports.DEFAULT_HALF_DAY_MINUTES = exports.DEFAULT_WORKING_MINUTES_PER_DAY = void 0;
exports.parseAttendanceDateParam = parseAttendanceDateParam;
exports.formatIstDateString = formatIstDateString;
exports.addDaysToIstDateString = addDaysToIstDateString;
exports.getTodayIstDateString = getTodayIstDateString;
exports.getIstWeekday = getIstWeekday;
exports.isSundayIst = isSundayIst;
exports.isSameIstCalendarDay = isSameIstCalendarDay;
exports.diffMinutes = diffMinutes;
exports.calculateAttendanceFromPunch = calculateAttendanceFromPunch;
exports.resolveDisplayStatus = resolveDisplayStatus;
exports.getHolidaySource = getHolidaySource;
exports.isHolidayDate = isHolidayDate;
exports.formatMinutesAsDuration = formatMinutesAsDuration;
exports.getIstWeekdayName = getIstWeekdayName;
exports.getIstMonthDateRange = getIstMonthDateRange;
exports.payrollMonthKey = payrollMonthKey;
exports.isPayrollMonthOnOrBefore = isPayrollMonthOnOrBefore;
exports.computeAdvanceDue = computeAdvanceDue;
exports.computeAdvanceDeductionCap = computeAdvanceDeductionCap;
exports.buildAdvanceLedger = buildAdvanceLedger;
exports.roundPayrollMoney = roundPayrollMoney;
exports.isDailyPayCategory = isDailyPayCategory;
exports.isStaffCategory = isStaffCategory;
exports.countStaffWorkedHolidayDays = countStaffWorkedHolidayDays;
exports.computeOtHourlyRate = computeOtHourlyRate;
exports.buildMonthlyPayrollSummary = buildMonthlyPayrollSummary;
const client_1 = require("@prisma/client");
exports.DEFAULT_WORKING_MINUTES_PER_DAY = 480;
exports.DEFAULT_HALF_DAY_MINUTES = 240;
exports.ATTENDANCE_GRACE_MINUTES = 15;
exports.WAREHOUSE_EMPLOYEE_TYPES = [
    client_1.UserType.EMPLOYEE,
    client_1.UserType.ACCOUNTANT,
    client_1.UserType.DRIVER,
    client_1.UserType.WAREHOUSE_MANAGER,
    client_1.UserType.ORDER_MANAGER,
    client_1.UserType.PURCHASING_MANAGER,
    client_1.UserType.GUARD,
];
const IST = "Asia/Kolkata";
function parseAttendanceDateParam(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
        return null;
    const d = new Date(`${dateStr}T00:00:00.000+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatIstDateString(date) {
    return date.toLocaleDateString("en-CA", { timeZone: IST });
}
function addDaysToIstDateString(dateStr, days) {
    const d = new Date(`${dateStr}T12:00:00.000+05:30`);
    d.setDate(d.getDate() + days);
    return formatIstDateString(d);
}
function getTodayIstDateString() {
    return formatIstDateString(new Date());
}
function getIstWeekday(date) {
    const day = date.toLocaleDateString("en-US", { timeZone: IST, weekday: "short" });
    const map = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    return map[day] ?? 0;
}
function isSundayIst(date) {
    return getIstWeekday(date) === 0;
}
function isSameIstCalendarDay(a, b) {
    return formatIstDateString(a) === formatIstDateString(b);
}
function diffMinutes(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 60000);
}
function calculateAttendanceFromPunch(punchIn, punchOut, workingMinutes, halfDayMinutes, isHoliday = false) {
    const workedMinutes = diffMinutes(punchIn, punchOut);
    if (isHoliday) {
        // Any work on a holiday counts as present; all worked minutes are overtime.
        return { status: client_1.AttendanceStatus.PRESENT, extraMinutes: workedMinutes };
    }
    if (workedMinutes < halfDayMinutes) {
        return { status: client_1.AttendanceStatus.ABSENT, extraMinutes: 0 };
    }
    if (workedMinutes >= workingMinutes - exports.ATTENDANCE_GRACE_MINUTES) {
        const extraMinutes = workedMinutes > workingMinutes + exports.ATTENDANCE_GRACE_MINUTES
            ? workedMinutes - workingMinutes
            : 0;
        return { status: client_1.AttendanceStatus.PRESENT, extraMinutes };
    }
    // Minutes past the half-day threshold are paid as OT (same rate as post–full-day OT).
    return {
        status: client_1.AttendanceStatus.HALF_DAY,
        extraMinutes: Math.max(0, workedMinutes - halfDayMinutes),
    };
}
function resolveDisplayStatus(isHoliday, record, dateStr) {
    if (isHoliday)
        return client_1.AttendanceStatus.HOLIDAY;
    const shouldInferAbsent = dateStr != null && dateStr < getTodayIstDateString();
    const noPunchData = !record || (record.punchIn == null && record.punchOut == null);
    if (noPunchData) {
        return shouldInferAbsent
            ? client_1.AttendanceStatus.ABSENT
            : client_1.AttendanceStatus.NOT_MARKED;
    }
    return record.status;
}
function getHolidaySource(date, hasDeclaredHoliday) {
    if (isSundayIst(date))
        return "SUNDAY";
    if (hasDeclaredHoliday)
        return "DECLARED";
    return null;
}
function isHolidayDate(date, department, declaredHoliday) {
    if (department === client_1.Department.WAREHOUSE) {
        return isSundayIst(date) || declaredHoliday !== null;
    }
    return declaredHoliday !== null;
}
function formatMinutesAsDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0)
        return `${m}m`;
    if (m === 0)
        return `${h}h`;
    return `${h}h ${m}m`;
}
const WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
function getIstWeekdayName(date) {
    const idx = getIstWeekday(date);
    return WEEKDAY_NAMES[idx] ?? "";
}
function getIstMonthDateRange(year, month) {
    const monthPadded = String(month).padStart(2, "0");
    const yearMonth = `${year}-${monthPadded}`;
    const from = new Date(`${yearMonth}-01T00:00:00.000+05:30`);
    const days = [];
    let cursor = new Date(from);
    for (;;) {
        const dateStr = formatIstDateString(cursor);
        if (!dateStr.startsWith(yearMonth))
            break;
        days.push(dateStr);
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    const to = parseAttendanceDateParam(days[days.length - 1]);
    return { from, to, days };
}
function payrollMonthKey(year, month) {
    return year * 12 + month;
}
function isPayrollMonthOnOrBefore(year, month, viewedYear, viewedMonth) {
    return payrollMonthKey(year, month) <= payrollMonthKey(viewedYear, viewedMonth);
}
function computeAdvanceDue(grants, deductions, viewedYear, viewedMonth, thisMonthDeduction) {
    let grantTotal = 0;
    for (const grant of grants) {
        if (isPayrollMonthOnOrBefore(grant.year, grant.month, viewedYear, viewedMonth)) {
            grantTotal += grant.amount;
        }
    }
    let deductionTotal = 0;
    for (const deduction of deductions) {
        if (deduction.year === viewedYear && deduction.month === viewedMonth) {
            continue;
        }
        if (isPayrollMonthOnOrBefore(deduction.year, deduction.month, viewedYear, viewedMonth)) {
            deductionTotal += deduction.amount;
        }
    }
    return roundPayrollMoney(grantTotal - deductionTotal - thisMonthDeduction);
}
function computeAdvanceDeductionCap(grants, deductions, viewedYear, viewedMonth) {
    return Math.max(0, computeAdvanceDue(grants, deductions, viewedYear, viewedMonth, 0));
}
function buildAdvanceLedger(grants, deductions, viewedYear, viewedMonth, thisMonthDeduction) {
    const entries = [];
    for (const grant of grants) {
        if (!isPayrollMonthOnOrBefore(grant.year, grant.month, viewedYear, viewedMonth)) {
            continue;
        }
        entries.push({
            id: grant.id,
            type: "GRANT",
            year: grant.year,
            month: grant.month,
            amount: grant.amount,
            note: grant.note ?? null,
        });
    }
    for (const deduction of deductions) {
        if (!isPayrollMonthOnOrBefore(deduction.year, deduction.month, viewedYear, viewedMonth)) {
            continue;
        }
        if (deduction.year === viewedYear && deduction.month === viewedMonth) {
            continue;
        }
        if (deduction.amount <= 0)
            continue;
        entries.push({
            type: "DEDUCTION",
            year: deduction.year,
            month: deduction.month,
            amount: deduction.amount,
        });
    }
    if (thisMonthDeduction > 0) {
        entries.push({
            type: "DEDUCTION",
            year: viewedYear,
            month: viewedMonth,
            amount: thisMonthDeduction,
        });
    }
    entries.sort((a, b) => {
        const monthDiff = payrollMonthKey(a.year, a.month) - payrollMonthKey(b.year, b.month);
        if (monthDiff !== 0)
            return monthDiff;
        if (a.type === b.type)
            return 0;
        return a.type === "GRANT" ? -1 : 1;
    });
    return entries;
}
function roundPayrollMoney(value) {
    return Math.round(value * 100) / 100;
}
function isDailyPayCategory(category) {
    return category === "LABOR" || category === "WB_LABOR";
}
function isStaffCategory(category) {
    return category === "STAFF";
}
function cellHasCompletePunches(cell) {
    const punchIn = cell.record?.punchIn ?? null;
    const punchOut = cell.record?.punchOut ?? null;
    return punchIn != null && punchOut != null;
}
function countStaffWorkedHolidayDays(cells, days) {
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const day = days[i];
        if (!cell || !day)
            continue;
        if (day.holidaySource !== "SUNDAY" && day.holidaySource !== "DECLARED") {
            continue;
        }
        if (cellHasCompletePunches(cell))
            count += 1;
    }
    return count;
}
function computeOtHourlyRate(dailySalary, workingMinutesPerDay) {
    if (dailySalary == null || workingMinutesPerDay <= 0)
        return null;
    const workingHours = workingMinutesPerDay / 60;
    if (workingHours <= 0)
        return null;
    return roundPayrollMoney(dailySalary / workingHours);
}
function buildMonthlyPayrollSummary(cells, days, summary, profile, daysInMonth, editable) {
    const workingDays = summary.present + summary.halfDay * 0.5;
    const totalOtHours = roundPayrollMoney(summary.totalExtraMinutes / 60);
    let holidays = 0;
    let sundays = 0;
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const day = days[i];
        if (!cell || !day)
            continue;
        if (cell.displayStatus !== client_1.AttendanceStatus.HOLIDAY)
            continue;
        if (day.holidaySource === "DECLARED")
            holidays += 1;
        else if (day.holidaySource === "SUNDAY")
            sundays += 1;
    }
    const absents = summary.absent;
    const total = daysInMonth;
    let salary = profile.salaryAmount;
    let amount = null;
    let otPay = 0;
    if (isDailyPayCategory(profile.warehouseCategory)) {
        const dailyRate = profile.salaryAmount;
        salary = dailyRate;
        if (dailyRate != null) {
            amount = roundPayrollMoney(dailyRate * workingDays);
        }
        const computedOtRate = computeOtHourlyRate(dailyRate, profile.workingMinutesPerDay);
        if (computedOtRate != null && summary.totalExtraMinutes > 0) {
            otPay = roundPayrollMoney(totalOtHours * computedOtRate);
        }
    }
    else if (isStaffCategory(profile.warehouseCategory)) {
        const monthlyRate = profile.salaryAmount;
        salary = monthlyRate;
        if (monthlyRate != null) {
            const dailyRate = monthlyRate / 30;
            const workedHolidayDays = countStaffWorkedHolidayDays(cells, days);
            amount = roundPayrollMoney(monthlyRate + workedHolidayDays * dailyRate - absents * dailyRate);
        }
    }
    else {
        const monthlyRate = profile.salaryAmount;
        salary = monthlyRate;
        if (monthlyRate != null) {
            amount = roundPayrollMoney(monthlyRate - absents * (monthlyRate / 30));
        }
    }
    const baseAmount = amount ?? 0;
    const payable = amount != null || otPay > 0
        ? roundPayrollMoney(baseAmount + otPay - editable.deductionAdvance - editable.deductionOther)
        : null;
    return {
        workingDays,
        totalOtHours,
        holidays,
        sundays,
        absents,
        total,
        salary,
        amount,
        payable,
        ...editable,
    };
}
//# sourceMappingURL=attendanceCalc.js.map