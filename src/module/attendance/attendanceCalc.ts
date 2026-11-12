import {
  AttendanceStatus,
  Department,
  UserType,
} from "@prisma/client";

export const DEFAULT_WORKING_MINUTES_PER_DAY = 480;
export const DEFAULT_HALF_DAY_MINUTES = 240;
export const ATTENDANCE_GRACE_MINUTES = 15;

export const WAREHOUSE_EMPLOYEE_TYPES: UserType[] = [
  UserType.EMPLOYEE,
  UserType.ACCOUNTANT,
  UserType.DRIVER,
  UserType.WAREHOUSE_MANAGER,
  UserType.ORDER_MANAGER,
  UserType.PURCHASING_MANAGER,
  UserType.GUARD,
];

const IST = "Asia/Kolkata";

export function parseAttendanceDateParam(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatIstDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}

export function addDaysToIstDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00.000+05:30`);
  d.setDate(d.getDate() + days);
  return formatIstDateString(d);
}

export function getTodayIstDateString(): string {
  return formatIstDateString(new Date());
}

export function getIstWeekday(date: Date): number {
  const day = date.toLocaleDateString("en-US", { timeZone: IST, weekday: "short" });
  const map: Record<string, number> = {
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

export function isSundayIst(date: Date): boolean {
  return getIstWeekday(date) === 0;
}

export function isSameIstCalendarDay(a: Date, b: Date): boolean {
  return formatIstDateString(a) === formatIstDateString(b);
}

export function diffMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export function calculateAttendanceFromPunch(
  punchIn: Date,
  punchOut: Date,
  workingMinutes: number,
  halfDayMinutes: number,
  isHoliday = false
): { status: AttendanceStatus; extraMinutes: number } {
  const workedMinutes = diffMinutes(punchIn, punchOut);

  if (isHoliday) {
    // Any work on a holiday counts as present; all worked minutes are overtime.
    return { status: AttendanceStatus.PRESENT, extraMinutes: workedMinutes };
  }

  if (workedMinutes < halfDayMinutes) {
    return { status: AttendanceStatus.ABSENT, extraMinutes: 0 };
  }

  if (workedMinutes >= workingMinutes - ATTENDANCE_GRACE_MINUTES) {
    const extraMinutes =
      workedMinutes > workingMinutes + ATTENDANCE_GRACE_MINUTES
        ? workedMinutes - workingMinutes
        : 0;
    return { status: AttendanceStatus.PRESENT, extraMinutes };
  }

  // Minutes past the half-day threshold are paid as OT (same rate as post–full-day OT).
  return {
    status: AttendanceStatus.HALF_DAY,
    extraMinutes: Math.max(0, workedMinutes - halfDayMinutes),
  };
}

export function resolveDisplayStatus(
  isHoliday: boolean,
  record: {
    status: AttendanceStatus;
    punchIn?: Date | string | null;
    punchOut?: Date | string | null;
  } | null,
  dateStr?: string
): AttendanceStatus {
  if (isHoliday) return AttendanceStatus.HOLIDAY;

  const shouldInferAbsent =
    dateStr != null && dateStr < getTodayIstDateString();

  const noPunchData =
    !record || (record.punchIn == null && record.punchOut == null);

  if (noPunchData) {
    return shouldInferAbsent
      ? AttendanceStatus.ABSENT
      : AttendanceStatus.NOT_MARKED;
  }

  return record.status;
}

export type HolidaySource = "SUNDAY" | "DECLARED" | null;

export function getHolidaySource(
  date: Date,
  hasDeclaredHoliday: boolean
): HolidaySource {
  if (isSundayIst(date)) return "SUNDAY";
  if (hasDeclaredHoliday) return "DECLARED";
  return null;
}

export function isHolidayDate(
  date: Date,
  department: Department,
  declaredHoliday: { id: string } | null
): boolean {
  if (department === Department.WAREHOUSE) {
    return isSundayIst(date) || declaredHoliday !== null;
  }
  return declaredHoliday !== null;
}

export function formatMinutesAsDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
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

export function getIstWeekdayName(date: Date): string {
  const idx = getIstWeekday(date);
  return WEEKDAY_NAMES[idx] ?? "";
}

export function getIstMonthDateRange(
  year: number,
  month: number
): { from: Date; to: Date; days: string[] } {
  const monthPadded = String(month).padStart(2, "0");
  const yearMonth = `${year}-${monthPadded}`;
  const from = new Date(`${yearMonth}-01T00:00:00.000+05:30`);

  const days: string[] = [];
  let cursor = new Date(from);
  for (;;) {
    const dateStr = formatIstDateString(cursor);
    if (!dateStr.startsWith(yearMonth)) break;
    days.push(dateStr);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  const to = parseAttendanceDateParam(days[days.length - 1])!;
  return { from, to, days };
}

export type MonthlyPayrollEditableFields = {
  deductionAdvance: number;
  deductionOther: number;
};

export type MonthlyPayrollSummary = MonthlyPayrollEditableFields & {
  workingDays: number;
  totalOtHours: number;
  holidays: number;
  sundays: number;
  absents: number;
  total: number;
  salary: number | null;
  amount: number | null;
  payable: number | null;
  totalAdvanceDue: number;
};

export type AdvanceGrant = {
  id?: string;
  year: number;
  month: number;
  amount: number;
  note?: string | null;
};

export type AdvanceDeduction = {
  year: number;
  month: number;
  amount: number;
};

export type AdvanceLedgerEntry = {
  id?: string;
  type: "GRANT" | "DEDUCTION";
  year: number;
  month: number;
  amount: number;
  note?: string | null;
};

export function payrollMonthKey(year: number, month: number): number {
  return year * 12 + month;
}

export function isPayrollMonthOnOrBefore(
  year: number,
  month: number,
  viewedYear: number,
  viewedMonth: number
): boolean {
  return payrollMonthKey(year, month) <= payrollMonthKey(viewedYear, viewedMonth);
}

export function computeAdvanceDue(
  grants: AdvanceGrant[],
  deductions: AdvanceDeduction[],
  viewedYear: number,
  viewedMonth: number,
  thisMonthDeduction: number
): number {
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
    if (
      isPayrollMonthOnOrBefore(
        deduction.year,
        deduction.month,
        viewedYear,
        viewedMonth
      )
    ) {
      deductionTotal += deduction.amount;
    }
  }

  return roundPayrollMoney(grantTotal - deductionTotal - thisMonthDeduction);
}

export function computeAdvanceDeductionCap(
  grants: AdvanceGrant[],
  deductions: AdvanceDeduction[],
  viewedYear: number,
  viewedMonth: number
): number {
  return Math.max(0, computeAdvanceDue(grants, deductions, viewedYear, viewedMonth, 0));
}

export function buildAdvanceLedger(
  grants: AdvanceGrant[],
  deductions: AdvanceDeduction[],
  viewedYear: number,
  viewedMonth: number,
  thisMonthDeduction: number
): AdvanceLedgerEntry[] {
  const entries: AdvanceLedgerEntry[] = [];

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
    if (deduction.amount <= 0) continue;
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
    if (monthDiff !== 0) return monthDiff;
    if (a.type === b.type) return 0;
    return a.type === "GRANT" ? -1 : 1;
  });

  return entries;
}

export type PayrollDayMeta = {
  holidaySource: HolidaySource;
};

export type PayrollAttendanceCell = {
  displayStatus: AttendanceStatus;
  record?: {
    punchIn?: Date | string | null;
    punchOut?: Date | string | null;
  } | null;
};

export type PayrollAttendanceSummary = {
  present: number;
  halfDay: number;
  absent: number;
  totalExtraMinutes: number;
};

export type PayrollProfileInput = {
  salaryType: "MONTHLY" | "DAILY" | null;
  salaryAmount: number | null;
  otEligible: boolean;
  otHourlyRate: number | null;
  warehouseCategory: "STAFF" | "DRIVER" | "LABOR" | "WB_LABOR" | null;
  workingMinutesPerDay: number;
};

export function roundPayrollMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isDailyPayCategory(
  category: PayrollProfileInput["warehouseCategory"]
): boolean {
  return category === "LABOR" || category === "WB_LABOR";
}

export function isStaffCategory(
  category: PayrollProfileInput["warehouseCategory"]
): boolean {
  return category === "STAFF";
}

function cellHasCompletePunches(cell: PayrollAttendanceCell): boolean {
  const punchIn = cell.record?.punchIn ?? null;
  const punchOut = cell.record?.punchOut ?? null;
  return punchIn != null && punchOut != null;
}

export function countStaffWorkedHolidayDays(
  cells: PayrollAttendanceCell[],
  days: PayrollDayMeta[]
): number {
  let count = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const day = days[i];
    if (!cell || !day) continue;
    if (day.holidaySource !== "SUNDAY" && day.holidaySource !== "DECLARED") {
      continue;
    }
    if (cellHasCompletePunches(cell)) count += 1;
  }
  return count;
}

export function computeOtHourlyRate(
  dailySalary: number | null,
  workingMinutesPerDay: number
): number | null {
  if (dailySalary == null || workingMinutesPerDay <= 0) return null;
  const workingHours = workingMinutesPerDay / 60;
  if (workingHours <= 0) return null;
  return roundPayrollMoney(dailySalary / workingHours);
}

export function buildMonthlyPayrollSummary(
  cells: PayrollAttendanceCell[],
  days: PayrollDayMeta[],
  summary: PayrollAttendanceSummary,
  profile: PayrollProfileInput,
  daysInMonth: number,
  editable: MonthlyPayrollEditableFields & { totalAdvanceDue: number }
): MonthlyPayrollSummary {
  const workingDays = summary.present + summary.halfDay * 0.5;
  const totalOtHours = roundPayrollMoney(summary.totalExtraMinutes / 60);

  let holidays = 0;
  let sundays = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const day = days[i];
    if (!cell || !day) continue;
    if (cell.displayStatus !== AttendanceStatus.HOLIDAY) continue;
    if (day.holidaySource === "DECLARED") holidays += 1;
    else if (day.holidaySource === "SUNDAY") sundays += 1;
  }

  const absents = summary.absent;
  const total = daysInMonth;

  let salary: number | null = profile.salaryAmount;
  let amount: number | null = null;
  let otPay = 0;

  if (isDailyPayCategory(profile.warehouseCategory)) {
    const dailyRate = profile.salaryAmount;
    salary = dailyRate;
    if (dailyRate != null) {
      amount = roundPayrollMoney(dailyRate * workingDays);
    }
    const computedOtRate = computeOtHourlyRate(
      dailyRate,
      profile.workingMinutesPerDay
    );
    if (computedOtRate != null && summary.totalExtraMinutes > 0) {
      otPay = roundPayrollMoney(totalOtHours * computedOtRate);
    }
  } else if (isStaffCategory(profile.warehouseCategory)) {
    const monthlyRate = profile.salaryAmount;
    salary = monthlyRate;
    if (monthlyRate != null) {
      const dailyRate = monthlyRate / 30;
      const workedHolidayDays = countStaffWorkedHolidayDays(cells, days);
      amount = roundPayrollMoney(
        monthlyRate + workedHolidayDays * dailyRate - absents * dailyRate
      );
    }
  } else {
    const monthlyRate = profile.salaryAmount;
    salary = monthlyRate;
    if (monthlyRate != null) {
      amount = roundPayrollMoney(monthlyRate - absents * (monthlyRate / 30));
    }
  }

  const baseAmount = amount ?? 0;
  const payable =
    amount != null || otPay > 0
      ? roundPayrollMoney(
          baseAmount + otPay - editable.deductionAdvance - editable.deductionOther
        )
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
