import assert from "node:assert/strict";
import {
  addDaysToIstDateString,
  buildAdvanceLedger,
  buildMonthlyPayrollSummary,
  calculateAttendanceFromPunch,
  computeAdvanceDeductionCap,
  computeAdvanceDue,
  computeOtHourlyRate,
  countStaffWorkedHolidayDays,
  getTodayIstDateString,
  isDailyPayCategory,
  resolveDisplayStatus,
} from "./attendanceCalc";
import { AttendanceStatus } from "@prisma/client";

let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`not ok ${name}`);
    console.error(err);
  }
}

const emptyEditable = {
  totalAdvanceDue: 0,
  deductionAdvance: 0,
  deductionOther: 0,
};

test("isDailyPayCategory identifies labor categories", () => {
  assert.equal(isDailyPayCategory("LABOR"), true);
  assert.equal(isDailyPayCategory("WB_LABOR"), true);
  assert.equal(isDailyPayCategory("STAFF"), false);
  assert.equal(isDailyPayCategory("DRIVER"), false);
});

test("computeOtHourlyRate = daily salary / working hours", () => {
  assert.equal(computeOtHourlyRate(500, 480), 62.5);
  assert.equal(computeOtHourlyRate(null, 480), null);
});

test("total column equals days in month", () => {
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 10, halfDay: 0, absent: 2, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "STAFF",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.total, 30);
});

test("staff amount = monthly - absents * monthly/30", () => {
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 20, halfDay: 0, absent: 2, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "STAFF",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.salary, 30000);
  assert.equal(payroll.amount, 28000);
  assert.equal(payroll.payable, 28000);
});

test("staff gets extra pay for worked sundays and holidays", () => {
  const cells = [
    {
      displayStatus: AttendanceStatus.HOLIDAY,
      record: {
        punchIn: "2026-09-06T09:00:00.000Z",
        punchOut: "2026-09-06T18:00:00.000Z",
      },
    },
    {
      displayStatus: AttendanceStatus.HOLIDAY,
      record: {
        punchIn: "2026-09-15T09:00:00.000Z",
        punchOut: "2026-09-15T18:00:00.000Z",
      },
    },
    {
      displayStatus: AttendanceStatus.HOLIDAY,
      record: null,
    },
  ];
  const days = [
    { holidaySource: "SUNDAY" as const },
    { holidaySource: "DECLARED" as const },
    { holidaySource: "SUNDAY" as const },
  ];
  assert.equal(countStaffWorkedHolidayDays(cells, days), 2);

  const payroll = buildMonthlyPayrollSummary(
    cells,
    days,
    { present: 20, halfDay: 0, absent: 2, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "STAFF",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.amount, 30000);
  assert.equal(payroll.payable, 30000);
});

test("driver does not get staff holiday work bonus", () => {
  const cells = [
    {
      displayStatus: AttendanceStatus.HOLIDAY,
      record: {
        punchIn: "2026-09-06T09:00:00.000Z",
        punchOut: "2026-09-06T18:00:00.000Z",
      },
    },
  ];
  const days = [{ holidaySource: "SUNDAY" as const }];
  const payroll = buildMonthlyPayrollSummary(
    cells,
    days,
    { present: 20, halfDay: 0, absent: 2, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "DRIVER",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.amount, 28000);
});

test("staff ignores half-day for absent deduction", () => {
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 19, halfDay: 2, absent: 2, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "DRIVER",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.workingDays, 20);
  assert.equal(payroll.amount, 28000);
});

test("labor amount and OT pay", () => {
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 20, halfDay: 0, absent: 0, totalExtraMinutes: 120 },
    {
      salaryType: "DAILY",
      salaryAmount: 500,
      otEligible: true,
      otHourlyRate: 999,
      warehouseCategory: "LABOR",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.salary, 500);
  assert.equal(payroll.amount, 10000);
  assert.equal(payroll.totalOtHours, 2);
  assert.equal(payroll.payable, 10125);
});

test("labor half-day counts as 0.5 working day", () => {
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 0, halfDay: 1, absent: 0, totalExtraMinutes: 0 },
    {
      salaryType: "DAILY",
      salaryAmount: 500,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "WB_LABOR",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.workingDays, 0.5);
  assert.equal(payroll.amount, 250);
});

test("labor half-day surplus minutes paid as OT", () => {
  // 6h work: half-day base + 2h OT at 500/8 = 62.5 → 250 + 125 = 375
  const payroll = buildMonthlyPayrollSummary(
    [],
    [],
    { present: 0, halfDay: 1, absent: 0, totalExtraMinutes: 120 },
    {
      salaryType: "DAILY",
      salaryAmount: 500,
      otEligible: true,
      otHourlyRate: null,
      warehouseCategory: "LABOR",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.workingDays, 0.5);
  assert.equal(payroll.amount, 250);
  assert.equal(payroll.totalOtHours, 2);
  assert.equal(payroll.payable, 375);
});

function punchPair(workedMinutes: number): { punchIn: Date; punchOut: Date } {
  const punchIn = new Date("2026-09-01T09:00:00.000+05:30");
  const punchOut = new Date(punchIn.getTime() + workedMinutes * 60_000);
  return { punchIn, punchOut };
}

test("calculateAttendanceFromPunch: below half day is absent", () => {
  const { punchIn, punchOut } = punchPair(239);
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240);
  assert.equal(result.status, AttendanceStatus.ABSENT);
  assert.equal(result.extraMinutes, 0);
});

test("calculateAttendanceFromPunch: half-day surplus is OT", () => {
  const { punchIn, punchOut } = punchPair(360);
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240);
  assert.equal(result.status, AttendanceStatus.HALF_DAY);
  assert.equal(result.extraMinutes, 120);
});

test("calculateAttendanceFromPunch: exact half day has zero OT", () => {
  const { punchIn, punchOut } = punchPair(240);
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240);
  assert.equal(result.status, AttendanceStatus.HALF_DAY);
  assert.equal(result.extraMinutes, 0);
});

test("calculateAttendanceFromPunch: present OT relative to full day", () => {
  const { punchIn, punchOut } = punchPair(540);
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240);
  assert.equal(result.status, AttendanceStatus.PRESENT);
  assert.equal(result.extraMinutes, 60);
});

test("calculateAttendanceFromPunch: holiday all minutes are OT", () => {
  const { punchIn, punchOut } = punchPair(180);
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240, true);
  assert.equal(result.status, AttendanceStatus.PRESENT);
  assert.equal(result.extraMinutes, 180);
});

test("calculateAttendanceFromPunch: overnight night shift counts full span", () => {
  const punchIn = new Date("2026-09-06T22:00:00.000+05:30");
  const punchOut = new Date("2026-09-07T06:00:00.000+05:30");
  const result = calculateAttendanceFromPunch(punchIn, punchOut, 480, 240);
  assert.equal(result.status, AttendanceStatus.PRESENT);
  assert.equal(result.extraMinutes, 0);
});

test("addDaysToIstDateString advances by one IST calendar day", () => {
  assert.equal(addDaysToIstDateString("2026-09-06", 1), "2026-09-07");
  assert.equal(addDaysToIstDateString("2026-09-30", 1), "2026-10-01");
});

test("holiday and sunday counters unchanged", () => {
  const cells = [
    { displayStatus: AttendanceStatus.HOLIDAY },
    { displayStatus: AttendanceStatus.HOLIDAY },
  ];
  const days = [{ holidaySource: "SUNDAY" as const }, { holidaySource: "DECLARED" as const }];
  const payroll = buildMonthlyPayrollSummary(
    cells,
    days,
    { present: 0, halfDay: 0, absent: 0, totalExtraMinutes: 0 },
    {
      salaryType: "MONTHLY",
      salaryAmount: 30000,
      otEligible: false,
      otHourlyRate: null,
      warehouseCategory: "STAFF",
      workingMinutesPerDay: 480,
    },
    30,
    emptyEditable
  );
  assert.equal(payroll.sundays, 1);
  assert.equal(payroll.holidays, 1);
});

test("resolveDisplayStatus treats past days without punches as absent", () => {
  assert.equal(
    resolveDisplayStatus(false, null, "2020-06-15"),
    AttendanceStatus.ABSENT
  );
  assert.equal(
    resolveDisplayStatus(
      false,
      { status: AttendanceStatus.ABSENT, punchIn: null, punchOut: null },
      "2020-06-15"
    ),
    AttendanceStatus.ABSENT
  );
});

test("resolveDisplayStatus keeps holidays and future days without punches unmarked", () => {
  assert.equal(
    resolveDisplayStatus(true, null, "2020-06-15"),
    AttendanceStatus.HOLIDAY
  );
  assert.equal(
    resolveDisplayStatus(false, null, "2099-06-15"),
    AttendanceStatus.NOT_MARKED
  );
  assert.equal(
    resolveDisplayStatus(false, null, getTodayIstDateString()),
    AttendanceStatus.NOT_MARKED
  );
});

test("resolveDisplayStatus keeps in-progress when only punch-in exists", () => {
  assert.equal(
    resolveDisplayStatus(
      false,
      {
        status: AttendanceStatus.IN_PROGRESS,
        punchIn: new Date("2020-06-15T09:00:00+05:30"),
        punchOut: null,
      },
      "2020-06-15"
    ),
    AttendanceStatus.IN_PROGRESS
  );
});

test("computeAdvanceDue after grant and partial deduct", () => {
  const grants = [{ year: 2026, month: 9, amount: 8000 }];
  const deductions = [{ year: 2026, month: 9, amount: 2000 }];
  assert.equal(computeAdvanceDue(grants, deductions, 2026, 9, 2000), 6000);
  assert.equal(computeAdvanceDeductionCap(grants, deductions, 2026, 9), 8000);
});

test("computeAdvanceDue runs across months", () => {
  const grants = [{ year: 2026, month: 9, amount: 8000 }];
  const deductions = [
    { year: 2026, month: 9, amount: 2000 },
    { year: 2026, month: 10, amount: 2000 },
  ];
  assert.equal(computeAdvanceDue(grants, deductions, 2026, 9, 2000), 6000);
  assert.equal(computeAdvanceDue(grants, deductions, 2026, 10, 2000), 4000);
  assert.equal(computeAdvanceDue(grants, deductions, 2026, 11, 4000), 0);
});

test("computeAdvanceDue ignores future-month grants", () => {
  const grants = [
    { year: 2026, month: 9, amount: 8000 },
    { year: 2026, month: 11, amount: 5000 },
  ];
  const deductions = [{ year: 2026, month: 9, amount: 2000 }];
  assert.equal(computeAdvanceDue(grants, deductions, 2026, 10, 0), 6000);
});

test("advance deduction cap is remaining before this month deduction", () => {
  const grants = [{ year: 2026, month: 9, amount: 8000 }];
  const deductions = [
    { year: 2026, month: 9, amount: 2000 },
    { year: 2026, month: 10, amount: 9999 },
  ];
  assert.equal(computeAdvanceDeductionCap(grants, deductions, 2026, 10), 6000);
});

test("buildAdvanceLedger lists grants before deductions in the same month", () => {
  const ledger = buildAdvanceLedger(
    [{ id: "g1", year: 2026, month: 9, amount: 8000 }],
    [{ year: 2026, month: 9, amount: 2000 }],
    2026,
    9,
    2000
  );
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0]?.type, "GRANT");
  assert.equal(ledger[1]?.type, "DEDUCTION");
  assert.equal(ledger[1]?.amount, 2000);
});

if (failed > 0) {
  process.exit(1);
}

console.log("All attendance payroll tests passed.");
