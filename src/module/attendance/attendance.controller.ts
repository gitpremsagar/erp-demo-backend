import { Request, Response } from "express";
import {
  AttendanceAction,
  AttendanceStatus,
  Department,
  EmployeeSalaryType,
  Prisma,
  UserType,
  WarehouseEmployeeCategory,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  calculateAttendanceFromPunch,
  DEFAULT_WORKING_MINUTES_PER_DAY,
  diffMinutes,
  formatIstDateString,
  addDaysToIstDateString,
  getHolidaySource,
  getIstMonthDateRange,
  getIstWeekdayName,
  isHolidayDate,
  isSameIstCalendarDay,
  isSundayIst,
  parseAttendanceDateParam,
  resolveDisplayStatus,
  buildMonthlyPayrollSummary,
  buildAdvanceLedger,
  computeAdvanceDue,
  computeAdvanceDeductionCap,
  WAREHOUSE_EMPLOYEE_TYPES,
} from "./attendanceCalc";
import type {
  AdvanceDeduction,
  AdvanceGrant,
} from "./attendanceCalc";
import {
  orderTwoSideDistanceSelect,
  resolveOrderTwoSideDistance,
} from "../../lib/orderTwoSideDistance";

const WAREHOUSE_DEPARTMENT = Department.WAREHOUSE;

const WAREHOUSE_CATEGORY_ORDER: WarehouseEmployeeCategory[] = [
  WarehouseEmployeeCategory.STAFF,
  WarehouseEmployeeCategory.DRIVER,
  WarehouseEmployeeCategory.LABOR,
  WarehouseEmployeeCategory.WB_LABOR,
];

const WAREHOUSE_CATEGORY_LABELS: Record<WarehouseEmployeeCategory, string> = {
  [WarehouseEmployeeCategory.STAFF]: "Staff",
  [WarehouseEmployeeCategory.DRIVER]: "Driver",
  [WarehouseEmployeeCategory.LABOR]: "Labor",
  [WarehouseEmployeeCategory.WB_LABOR]: "WB Labor",
};

function getAdminId(req: AuthenticatedRequest): string | null {
  const user = req.user as { id?: string } | undefined;
  return user?.id ?? null;
}

async function getDeclaredHoliday(date: Date, department: Department) {
  return prisma.attendanceHoliday.findUnique({
    where: {
      date_department: { date, department },
    },
  });
}

async function isDateHoliday(date: Date, department: Department): Promise<boolean> {
  const declared = await getDeclaredHoliday(date, department);
  return isHolidayDate(date, department, declared);
}

type ResolvedAttendanceProfile = {
  workingMinutesPerDay: number;
  halfDayMinutes: number;
  salaryType: EmployeeSalaryType | null;
  salaryAmount: number | null;
  otEligible: boolean;
  otHourlyRate: number | null;
};

function resolveProfileDefaults(
  profile: {
    workingMinutesPerDay?: number | null;
    halfDayMinutes?: number | null;
    salaryType?: EmployeeSalaryType | null;
    salaryAmount?: number | null;
    otEligible?: boolean | null;
    otHourlyRate?: number | null;
  } | null
): ResolvedAttendanceProfile {
  const workingMinutesPerDay =
    profile?.workingMinutesPerDay ?? DEFAULT_WORKING_MINUTES_PER_DAY;
  const halfDayMinutes =
    profile?.halfDayMinutes ?? Math.floor(workingMinutesPerDay / 2);

  return {
    workingMinutesPerDay,
    halfDayMinutes,
    salaryType: profile?.salaryType ?? null,
    salaryAmount: profile?.salaryAmount ?? null,
    otEligible: profile?.otEligible ?? false,
    otHourlyRate: profile?.otHourlyRate ?? null,
  };
}

async function getEmployeeAttendanceProfile(
  userId: string
): Promise<ResolvedAttendanceProfile> {
  const profile = await prisma.employeeAttendanceProfile.findUnique({
    where: { userId },
  });
  return resolveProfileDefaults(profile);
}

function warehouseAttendanceEmployeeWhere(
  userId?: string
): Prisma.UserWhereInput {
  return {
    ...(userId ? { id: userId } : {}),
    department: WAREHOUSE_DEPARTMENT,
    warehouseCategory: { not: null },
  };
}

async function getWarehouseEmployee(userId: string) {
  return prisma.user.findFirst({
    where: warehouseAttendanceEmployeeWhere(userId),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      userType: true,
      warehouseCategory: true,
    },
  });
}

function serializeRecord(record: {
  id: string;
  punchIn: Date | null;
  punchOut: Date | null;
  status: AttendanceStatus;
  extraMinutes: number;
  isManualAbsent: boolean;
  lastAction: AttendanceAction | null;
  remark: string | null;
}) {
  return {
    id: record.id,
    punchIn: record.punchIn?.toISOString() ?? null,
    punchOut: record.punchOut?.toISOString() ?? null,
    status: record.status,
    extraMinutes: record.extraMinutes,
    isManualAbsent: record.isManualAbsent,
    lastAction: record.lastAction,
    remark: record.remark ?? null,
  };
}

function serializeAdvanceGrant(grant: {
  id: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
}): AdvanceGrant {
  return {
    id: grant.id,
    year: grant.year,
    month: grant.month,
    amount: grant.amount,
    note: grant.note,
  };
}

function serializeAdvanceDeductions(
  rows: { year: number; month: number; deductionAdvance: number }[]
): AdvanceDeduction[] {
  return rows.map((row) => ({
    year: row.year,
    month: row.month,
    amount: row.deductionAdvance,
  }));
}

async function loadAdvanceState(userId: string) {
  const [grantRows, payrollRows] = await Promise.all([
    prisma.employeeSalaryAdvance.findMany({
      where: { userId },
      orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
    }),
    prisma.attendanceMonthlyPayroll.findMany({
      where: { userId },
    }),
  ]);

  return {
    grants: grantRows.map(serializeAdvanceGrant),
    deductions: serializeAdvanceDeductions(payrollRows),
    payrollRows,
  };
}

function thisMonthPayrollRow(
  payrollRows: { year: number; month: number; deductionAdvance: number; deductionOther: number }[],
  year: number,
  month: number
) {
  return payrollRows.find((row) => row.year === year && row.month === month) ?? null;
}

export const getWarehouseDailySheet = async (req: Request, res: Response) => {
  try {
    const { date: dateParam } = req.params;
    const date = parseAttendanceDateParam(dateParam);
    if (!date) {
      return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD" });
    }

    const declaredHoliday = await getDeclaredHoliday(date, WAREHOUSE_DEPARTMENT);
    const holidaySource = getHolidaySource(date, declaredHoliday !== null);
    const isHoliday = holidaySource !== null;

    const employees = await prisma.user.findMany({
      where: warehouseAttendanceEmployeeWhere(),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        userType: true,
        warehouseCategory: true,
        attendanceProfile: {
          select: { workingMinutesPerDay: true, halfDayMinutes: true },
        },
        attendanceRecords: {
          where: { date },
          take: 1,
        },
      },
      orderBy: [{ warehouseCategory: "asc" }, { name: "asc" }],
    });

    const rows = employees.map((emp) => {
      const record = emp.attendanceRecords[0] ?? null;
      const profile = resolveProfileDefaults(emp.attendanceProfile);

      const displayStatus = resolveDisplayStatus(isHoliday, record, dateParam);

      return {
        user: {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          userType: emp.userType,
          warehouseCategory: emp.warehouseCategory,
        },
        workingMinutesPerDay: profile.workingMinutesPerDay,
        halfDayMinutes: profile.halfDayMinutes,
        record: record ? serializeRecord(record) : null,
        displayStatus,
      };
    });

    return res.json({
      date: dateParam,
      isHoliday,
      holidaySource,
      holiday: declaredHoliday
        ? {
            id: declaredHoliday.id,
            name: declaredHoliday.name,
            date: formatIstDateString(declaredHoliday.date),
          }
        : null,
      employees: rows,
    });
  } catch (error) {
    console.error("getWarehouseDailySheet error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

function buildMonthlySummary(
  cells: { displayStatus: AttendanceStatus; record: ReturnType<typeof serializeRecord> | null }[]
) {
  const summary = {
    present: 0,
    halfDay: 0,
    absent: 0,
    holiday: 0,
    notMarked: 0,
    inProgress: 0,
    totalExtraMinutes: 0,
    totalWorkedMinutes: 0,
  };

  for (const cell of cells) {
    switch (cell.displayStatus) {
      case AttendanceStatus.PRESENT:
        summary.present += 1;
        break;
      case AttendanceStatus.HALF_DAY:
        summary.halfDay += 1;
        break;
      case AttendanceStatus.ABSENT:
        summary.absent += 1;
        break;
      case AttendanceStatus.HOLIDAY:
        summary.holiday += 1;
        break;
      case AttendanceStatus.IN_PROGRESS:
        summary.inProgress += 1;
        break;
      case AttendanceStatus.NOT_MARKED:
        summary.notMarked += 1;
        break;
    }

    if (cell.record) {
      summary.totalExtraMinutes += cell.record.extraMinutes;
      if (cell.record.punchIn && cell.record.punchOut) {
        summary.totalWorkedMinutes += diffMinutes(
          new Date(cell.record.punchIn),
          new Date(cell.record.punchOut)
        );
      }
    }
  }

  return summary;
}

export const getWarehouseMonthlyAttendance = async (
  req: Request,
  res: Response
) => {
  try {
    const { year: yearStr, month: monthStr } = req.params;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const { from, to, days } = getIstMonthDateRange(year, month);

    const employees = await prisma.user.findMany({
      where: warehouseAttendanceEmployeeWhere(),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        userType: true,
        warehouseCategory: true,
      },
      orderBy: [{ warehouseCategory: "asc" }, { name: "asc" }],
    });

    const userIds = employees.map((e) => e.id);
    const driverIds = employees
      .filter((e) => e.warehouseCategory === WarehouseEmployeeCategory.DRIVER)
      .map((e) => e.id);

    const [records, holidays, profiles, payrollRecords, advanceRecords, driverOrders] =
      await Promise.all([
        userIds.length
          ? prisma.attendanceRecord.findMany({
              where: { userId: { in: userIds }, date: { gte: from, lte: to } },
            })
          : Promise.resolve([]),
        prisma.attendanceHoliday.findMany({
          where: {
            department: WAREHOUSE_DEPARTMENT,
            date: { gte: from, lte: to },
          },
        }),
        userIds.length
          ? prisma.employeeAttendanceProfile.findMany({
              where: { userId: { in: userIds } },
            })
          : Promise.resolve([]),
        userIds.length
          ? prisma.attendanceMonthlyPayroll.findMany({
              where: { userId: { in: userIds } },
            })
          : Promise.resolve([]),
        userIds.length
          ? prisma.employeeSalaryAdvance.findMany({
              where: { userId: { in: userIds } },
              orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
            })
          : Promise.resolve([]),
        driverIds.length
          ? prisma.order.findMany({
              where: {
                driverId: { in: driverIds },
                deliveryDate: {
                  gte: from,
                  lte: new Date(
                    `${days[days.length - 1]}T23:59:59.999+05:30`
                  ),
                },
              },
              orderBy: { deliveryDate: "asc" },
              select: {
                id: true,
                customeOrderId: true,
                tallyInvoiceId: true,
                deliveryDate: true,
                driverId: true,
                ...orderTwoSideDistanceSelect,
              },
            })
          : Promise.resolve([]),
      ]);

    const driverTripStatsByUserId = new Map<
      string,
      {
        trips: number;
        totalKm: number;
        tripOrders: {
          orderId: string;
          customeOrderId: string;
          tallyInvoiceId: string | null;
          customerName: string | null;
          deliveryDate: string;
          twoSideDistance: number;
        }[];
      }
    >();
    for (const order of driverOrders) {
      if (!order.driverId || !order.deliveryDate) continue;
      const distance = resolveOrderTwoSideDistance(order);
      const current = driverTripStatsByUserId.get(order.driverId) ?? {
        trips: 0,
        totalKm: 0,
        tripOrders: [],
      };
      current.trips += 1;
      current.totalKm += distance;
      current.tripOrders.push({
        orderId: order.id,
        customeOrderId: order.customeOrderId,
        tallyInvoiceId: order.tallyInvoiceId ?? null,
        customerName: order.Customer?.CustomerDetail?.[0]?.dbName ?? null,
        deliveryDate: order.deliveryDate.toISOString(),
        twoSideDistance: distance,
      });
      driverTripStatsByUserId.set(order.driverId, current);
    }

    const profileByUserId = new Map(
      profiles.map((p) => [
        p.userId,
        resolveProfileDefaults(p),
      ])
    );
    const payrollRowsByUserId = new Map<string, (typeof payrollRecords)[number][]>();
    for (const row of payrollRecords) {
      const list = payrollRowsByUserId.get(row.userId) ?? [];
      list.push(row);
      payrollRowsByUserId.set(row.userId, list);
    }
    const grantsByUserId = new Map<string, AdvanceGrant[]>();
    for (const grant of advanceRecords) {
      const list = grantsByUserId.get(grant.userId) ?? [];
      list.push(serializeAdvanceGrant(grant));
      grantsByUserId.set(grant.userId, list);
    }
    const holidayByDate = new Map(
      holidays.map((h) => [formatIstDateString(h.date), h])
    );

    const dayMeta = days.map((dateStr) => {
      const date = parseAttendanceDateParam(dateStr)!;
      const declaredHoliday = holidayByDate.get(dateStr) ?? null;
      const holidaySource = getHolidaySource(date, declaredHoliday !== null);
      const isHoliday = holidaySource !== null;
      const dayOfMonth = parseInt(dateStr.split("-")[2]!, 10);
      return {
        date: dateStr,
        dayOfMonth,
        weekday: getIstWeekdayName(date),
        isHoliday,
        holidaySource,
        holidayName: declaredHoliday?.name ?? null,
      };
    });

    const recordByUserAndDate = new Map<
      string,
      Map<string, (typeof records)[number]>
    >();
    for (const r of records) {
      const dateStr = formatIstDateString(r.date);
      if (!recordByUserAndDate.has(r.userId)) {
        recordByUserAndDate.set(r.userId, new Map());
      }
      recordByUserAndDate.get(r.userId)!.set(dateStr, r);
    }

    // Heal status/extraMinutes from punches so half-day surplus OT applies to older rows.
    const healUpdates: Promise<unknown>[] = [];
    for (const r of records) {
      if (!r.punchIn || !r.punchOut) continue;
      const dateStr = formatIstDateString(r.date);
      const day = dayMeta.find((d) => d.date === dateStr);
      const profile =
        profileByUserId.get(r.userId) ?? resolveProfileDefaults(null);
      const { status, extraMinutes } = calculateAttendanceFromPunch(
        r.punchIn,
        r.punchOut,
        profile.workingMinutesPerDay,
        profile.halfDayMinutes,
        day?.isHoliday ?? false
      );
      if (r.status === status && r.extraMinutes === extraMinutes) continue;
      recordByUserAndDate.get(r.userId)?.set(dateStr, {
        ...r,
        status,
        extraMinutes,
      });
      healUpdates.push(
        prisma.attendanceRecord.update({
          where: { id: r.id },
          data: { status, extraMinutes },
        })
      );
    }
    if (healUpdates.length) {
      await Promise.all(healUpdates);
    }

    const buildEmployeeRow = (emp: (typeof employees)[number]) => {
      const profile = profileByUserId.get(emp.id) ?? resolveProfileDefaults(null);
      const userRecords = recordByUserAndDate.get(emp.id) ?? new Map();
      const payrollRows = payrollRowsByUserId.get(emp.id) ?? [];
      const savedPayroll = thisMonthPayrollRow(payrollRows, year, month);
      const grants = grantsByUserId.get(emp.id) ?? [];
      const deductions = serializeAdvanceDeductions(payrollRows);
      const deductionAdvance = savedPayroll?.deductionAdvance ?? 0;
      const deductionOther = savedPayroll?.deductionOther ?? 0;
      const totalAdvanceDue = computeAdvanceDue(
        grants,
        deductions,
        year,
        month,
        deductionAdvance
      );
      const editable = {
        totalAdvanceDue,
        deductionAdvance,
        deductionOther,
      };

      const cells = dayMeta.map((day) => {
        const record = userRecords.get(day.date) ?? null;
        const displayStatus = resolveDisplayStatus(day.isHoliday, record, day.date);
        return {
          date: day.date,
          displayStatus,
          record: record ? serializeRecord(record) : null,
        };
      });

      const summary = buildMonthlySummary(cells);
      const isDriver =
        emp.warehouseCategory === WarehouseEmployeeCategory.DRIVER;
      const tripStats = isDriver
        ? driverTripStatsByUserId.get(emp.id) ?? {
            trips: 0,
            totalKm: 0,
            tripOrders: [],
          }
        : null;

      return {
        user: {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          userType: emp.userType,
          warehouseCategory: emp.warehouseCategory,
        },
        workingMinutesPerDay: profile.workingMinutesPerDay,
        halfDayMinutes: profile.halfDayMinutes,
        salaryType: profile.salaryType,
        salaryAmount: profile.salaryAmount,
        otEligible: profile.otEligible,
        otHourlyRate: profile.otHourlyRate,
        trips: tripStats?.trips ?? null,
        totalKm: tripStats?.totalKm ?? null,
        tripOrders: tripStats?.tripOrders ?? null,
        cells,
        summary,
        advanceGrants: grants,
        advanceDeductions: deductions,
        advanceLedger: buildAdvanceLedger(
          grants,
          deductions,
          year,
          month,
          deductionAdvance
        ),
        payroll: buildMonthlyPayrollSummary(
          cells,
          dayMeta,
          summary,
          {
            salaryType: profile.salaryType,
            salaryAmount: profile.salaryAmount,
            otEligible: profile.otEligible,
            otHourlyRate: profile.otHourlyRate,
            warehouseCategory: emp.warehouseCategory ?? null,
            workingMinutesPerDay: profile.workingMinutesPerDay,
          },
          days.length,
          editable
        ),
      };
    };

    const groups = WAREHOUSE_CATEGORY_ORDER.map((category) => ({
      label: WAREHOUSE_CATEGORY_LABELS[category],
      category,
      employees: employees
        .filter(
          (e) => (e.warehouseCategory ?? WarehouseEmployeeCategory.STAFF) === category
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(buildEmployeeRow),
    }));

    return res.json({
      year,
      month,
      days: dayMeta,
      groups,
    });
  } catch (error) {
    console.error("getWarehouseMonthlyAttendance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getEmployeeMonthlyAttendance = async (req: Request, res: Response) => {
  try {
    const { userId, year: yearStr, month: monthStr } = req.params;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    const profile = await getEmployeeAttendanceProfile(userId);
    const { from, to, days } = getIstMonthDateRange(year, month);

    const [records, holidays] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { userId, date: { gte: from, lte: to } },
      }),
      prisma.attendanceHoliday.findMany({
        where: {
          department: WAREHOUSE_DEPARTMENT,
          date: { gte: from, lte: to },
        },
      }),
    ]);

    const recordByDate = new Map(
      records.map((r) => [formatIstDateString(r.date), r])
    );
    const holidayByDate = new Map(
      holidays.map((h) => [formatIstDateString(h.date), h])
    );

    const summary = {
      present: 0,
      halfDay: 0,
      absent: 0,
      holiday: 0,
      notMarked: 0,
      inProgress: 0,
      totalExtraMinutes: 0,
      totalWorkedMinutes: 0,
    };

    const dayRows = days.map((dateStr) => {
      const date = parseAttendanceDateParam(dateStr)!;
      const declaredHoliday = holidayByDate.get(dateStr) ?? null;
      const holidaySource = getHolidaySource(date, declaredHoliday !== null);
      const isHoliday = holidaySource !== null;
      const record = recordByDate.get(dateStr) ?? null;

      const displayStatus = resolveDisplayStatus(isHoliday, record, dateStr);

      switch (displayStatus) {
        case AttendanceStatus.PRESENT:
          summary.present += 1;
          break;
        case AttendanceStatus.HALF_DAY:
          summary.halfDay += 1;
          break;
        case AttendanceStatus.ABSENT:
          summary.absent += 1;
          break;
        case AttendanceStatus.HOLIDAY:
          summary.holiday += 1;
          break;
        case AttendanceStatus.IN_PROGRESS:
          summary.inProgress += 1;
          break;
        case AttendanceStatus.NOT_MARKED:
          summary.notMarked += 1;
          break;
      }

      if (record) {
        summary.totalExtraMinutes += record.extraMinutes;
        if (record.punchIn && record.punchOut) {
          summary.totalWorkedMinutes += diffMinutes(record.punchIn, record.punchOut);
        }
      }

      return {
        date: dateStr,
        weekday: getIstWeekdayName(date),
        isHoliday,
        holidaySource,
        holidayName: declaredHoliday?.name ?? null,
        displayStatus,
        record: record ? serializeRecord(record) : null,
      };
    });

    return res.json({
      employee,
      year,
      month,
      workingMinutesPerDay: profile.workingMinutesPerDay,
      halfDayMinutes: profile.halfDayMinutes,
      days: dayRows,
      summary,
    });
  } catch (error) {
    console.error("getEmployeeMonthlyAttendance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const punchIn = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, date: dateStr, time } = req.body as {
      userId: string;
      date: string;
      time: Date;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    if (!isSameIstCalendarDay(date, time)) {
      return res
        .status(400)
        .json({ message: "Punch time must be on the selected date (IST)" });
    }

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (existing?.punchIn) {
      return res.status(400).json({ message: "Employee already punched in" });
    }
    if (existing?.isManualAbsent) {
      return res
        .status(400)
        .json({ message: "Employee is marked absent. Undo absent first." });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        department: WAREHOUSE_DEPARTMENT,
        punchIn: time,
        status: AttendanceStatus.IN_PROGRESS,
        lastAction: AttendanceAction.PUNCH_IN,
        markedById: adminId,
      },
      update: {
        punchIn: time,
        punchOut: null,
        extraMinutes: 0,
        isManualAbsent: false,
        status: AttendanceStatus.IN_PROGRESS,
        lastAction: AttendanceAction.PUNCH_IN,
        markedById: adminId,
      },
    });

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error("punchIn error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const punchOut = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, date: dateStr, time } = req.body as {
      userId: string;
      date: string;
      time: Date;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const punchOutDay = formatIstDateString(time);
    const nextDay = addDaysToIstDateString(dateStr, 1);
    if (punchOutDay !== dateStr && punchOutDay !== nextDay) {
      return res.status(400).json({
        message:
          "Punch out time must be on the selected date or the next day (IST)",
      });
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (!existing?.punchIn) {
      return res.status(400).json({ message: "Employee has not punched in" });
    }
    if (time.getTime() <= existing.punchIn.getTime()) {
      return res
        .status(400)
        .json({ message: "Punch out time must be after punch in time" });
    }

    const profile = await getEmployeeAttendanceProfile(userId);
    const isHoliday = await isDateHoliday(date, WAREHOUSE_DEPARTMENT);
    const { status, extraMinutes } = calculateAttendanceFromPunch(
      existing.punchIn,
      time,
      profile.workingMinutesPerDay,
      profile.halfDayMinutes,
      isHoliday
    );

    const record = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        punchOut: time,
        status,
        extraMinutes,
        isManualAbsent: false,
        lastAction: AttendanceAction.PUNCH_OUT,
        markedById: adminId,
      },
    });

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error("punchOut error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const markAbsent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, date: dateStr } = req.body as {
      userId: string;
      date: string;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        department: WAREHOUSE_DEPARTMENT,
        status: AttendanceStatus.ABSENT,
        isManualAbsent: true,
        lastAction: AttendanceAction.ABSENT,
        markedById: adminId,
      },
      update: {
        punchIn: null,
        punchOut: null,
        extraMinutes: 0,
        status: AttendanceStatus.ABSENT,
        isManualAbsent: true,
        lastAction: AttendanceAction.ABSENT,
        markedById: adminId,
      },
    });

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error("markAbsent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const undoAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, date: dateStr } = req.body as {
      userId: string;
      date: string;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (!existing?.lastAction) {
      return res.status(400).json({ message: "Nothing to undo" });
    }

    let record;

    switch (existing.lastAction) {
      case AttendanceAction.ABSENT: {
        if (existing.remark) {
          record = await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              punchIn: null,
              punchOut: null,
              extraMinutes: 0,
              isManualAbsent: false,
              status: AttendanceStatus.NOT_MARKED,
              lastAction: null,
              markedById: adminId,
            },
          });
          break;
        }
        await prisma.attendanceRecord.delete({ where: { id: existing.id } });
        return res.json({ record: null });
      }
      case AttendanceAction.PUNCH_OUT:
        record = await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            punchOut: null,
            extraMinutes: 0,
            status: AttendanceStatus.IN_PROGRESS,
            lastAction: AttendanceAction.PUNCH_IN,
            markedById: adminId,
          },
        });
        break;
      case AttendanceAction.PUNCH_IN: {
        if (existing.remark) {
          record = await prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              punchIn: null,
              punchOut: null,
              extraMinutes: 0,
              isManualAbsent: false,
              status: AttendanceStatus.NOT_MARKED,
              lastAction: null,
              markedById: adminId,
            },
          });
          break;
        }
        await prisma.attendanceRecord.delete({ where: { id: existing.id } });
        return res.json({ record: null });
      }
      default:
        return res.status(400).json({ message: "Nothing to undo" });
    }

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error("undoAttendance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const setAttendanceRemark = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { userId, date: dateStr, remark: rawRemark } = req.body as {
      userId: string;
      date: string;
      remark: string | null;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    const remark =
      typeof rawRemark === "string" && rawRemark.trim()
        ? rawRemark.trim()
        : null;

    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date } },
    });

    if (
      !remark &&
      existing &&
      !existing.punchIn &&
      !existing.punchOut &&
      !existing.isManualAbsent &&
      !existing.lastAction
    ) {
      await prisma.attendanceRecord.delete({ where: { id: existing.id } });
      return res.json({ record: null });
    }

    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId,
        date,
        department: WAREHOUSE_DEPARTMENT,
        status: AttendanceStatus.NOT_MARKED,
        remark,
        markedById: adminId,
      },
      update: {
        remark,
        markedById: adminId,
      },
    });

    return res.json({ record: serializeRecord(record) });
  } catch (error) {
    console.error("setAttendanceRemark error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { department, from, to } = req.query as {
      department: Department;
      from?: string;
      to?: string;
    };

    const where: Prisma.AttendanceHolidayWhereInput = { department };

    if (from || to) {
      where.date = {};
      if (from) {
        const fromDate = parseAttendanceDateParam(from);
        if (!fromDate) {
          return res.status(400).json({ message: "Invalid from date" });
        }
        where.date.gte = fromDate;
      }
      if (to) {
        const toDate = parseAttendanceDateParam(to);
        if (!toDate) {
          return res.status(400).json({ message: "Invalid to date" });
        }
        where.date.lte = toDate;
      }
    }

    const holidays = await prisma.attendanceHoliday.findMany({
      where,
      orderBy: { date: "asc" },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.json({
      holidays: holidays.map((h) => ({
        id: h.id,
        date: formatIstDateString(h.date),
        department: h.department,
        name: h.name,
        createdBy: h.createdBy,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("getHolidays error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createHoliday = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = getAdminId(req);
    if (!adminId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { date: dateStr, department, name } = req.body as {
      date: string;
      department: Department;
      name?: string;
    };

    const date = parseAttendanceDateParam(dateStr);
    if (!date) {
      return res.status(400).json({ message: "Invalid date" });
    }

    if (isSundayIst(date)) {
      return res
        .status(400)
        .json({ message: "Sunday is already a system holiday" });
    }

    const existing = await getDeclaredHoliday(date, department);
    if (existing) {
      return res.status(409).json({ message: "Holiday already declared for this date" });
    }

    const holiday = await prisma.attendanceHoliday.create({
      data: {
        date,
        department,
        name: name?.trim() || null,
        createdById: adminId,
      },
    });

    return res.status(201).json({
      holiday: {
        id: holiday.id,
        date: formatIstDateString(holiday.date),
        department: holiday.department,
        name: holiday.name,
      },
    });
  } catch (error) {
    console.error("createHoliday error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const holiday = await prisma.attendanceHoliday.findUnique({ where: { id } });
    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    await prisma.attendanceHoliday.delete({ where: { id } });

    return res.json({ message: "Holiday removed" });
  } catch (error) {
    console.error("deleteHoliday error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getProfiles = async (req: Request, res: Response) => {
  try {
    const { department } = req.query as { department: Department };

    const employees = await prisma.user.findMany({
      where:
        department === WAREHOUSE_DEPARTMENT
          ? warehouseAttendanceEmployeeWhere()
          : {
              department,
              userType: { in: WAREHOUSE_EMPLOYEE_TYPES },
            },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        userType: true,
        warehouseCategory: true,
        attendanceProfile: true,
      },
      orderBy: { name: "asc" },
    });

    return res.json({
      profiles: employees.map((emp) => {
        const profile = resolveProfileDefaults(emp.attendanceProfile);
        return {
          user: {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone,
            userType: emp.userType,
            warehouseCategory: emp.warehouseCategory,
          },
          workingMinutesPerDay: profile.workingMinutesPerDay,
          halfDayMinutes: profile.halfDayMinutes,
          salaryType: profile.salaryType,
          salaryAmount: profile.salaryAmount,
          otEligible: profile.otEligible,
          otHourlyRate: profile.otHourlyRate,
          profileId: emp.attendanceProfile?.id ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("getProfiles error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      workingMinutesPerDay,
      halfDayMinutes,
      salaryType,
      salaryAmount,
      otEligible,
      otHourlyRate,
    } = req.body as {
      workingMinutesPerDay: number;
      halfDayMinutes: number;
      salaryType: EmployeeSalaryType | null;
      salaryAmount: number | null;
      otEligible: boolean;
      otHourlyRate: number | null;
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, department: true, userType: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const profile = await prisma.employeeAttendanceProfile.upsert({
      where: { userId },
      create: {
        userId,
        workingMinutesPerDay,
        halfDayMinutes,
        salaryType,
        salaryAmount,
        otEligible,
        otHourlyRate: otEligible ? otHourlyRate : null,
      },
      update: {
        workingMinutesPerDay,
        halfDayMinutes,
        salaryType,
        salaryAmount,
        otEligible,
        otHourlyRate: otEligible ? otHourlyRate : null,
      },
    });

    const resolved = resolveProfileDefaults(profile);

    return res.json({
      profile: {
        id: profile.id,
        userId: profile.userId,
        workingMinutesPerDay: resolved.workingMinutesPerDay,
        halfDayMinutes: resolved.halfDayMinutes,
        salaryType: resolved.salaryType,
        salaryAmount: resolved.salaryAmount,
        otEligible: resolved.otEligible,
        otHourlyRate: resolved.otHourlyRate,
      },
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

async function computeEmployeeMonthlyPayroll(
  userId: string,
  year: number,
  month: number,
  editable: {
    deductionAdvance: number;
    deductionOther: number;
  }
) {
  const employee = await getWarehouseEmployee(userId);
  if (!employee) return null;

  const profile = await getEmployeeAttendanceProfile(userId);
  const { from, to, days } = getIstMonthDateRange(year, month);

  const [records, holidays] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { userId, date: { gte: from, lte: to } },
    }),
    prisma.attendanceHoliday.findMany({
      where: {
        department: WAREHOUSE_DEPARTMENT,
        date: { gte: from, lte: to },
      },
    }),
  ]);

  const holidayByDate = new Map(
    holidays.map((h) => [formatIstDateString(h.date), h])
  );

  const dayMeta = days.map((dateStr) => {
    const date = parseAttendanceDateParam(dateStr)!;
    const declaredHoliday = holidayByDate.get(dateStr) ?? null;
    const holidaySource = getHolidaySource(date, declaredHoliday !== null);
    const isHoliday = holidaySource !== null;
    return { holidaySource, isHoliday, date: dateStr };
  });

  const recordByDate = new Map(
    records.map((r) => [formatIstDateString(r.date), r])
  );

  const cells = dayMeta.map((day) => {
    const record = recordByDate.get(day.date) ?? null;
    const displayStatus = resolveDisplayStatus(day.isHoliday, record, day.date);
    return {
      displayStatus,
      record: record ? serializeRecord(record) : null,
    };
  });

  const summary = buildMonthlySummary(
    cells.map((cell, i) => ({
      displayStatus: cell.displayStatus,
      record: recordByDate.get(dayMeta[i]!.date)
        ? serializeRecord(recordByDate.get(dayMeta[i]!.date)!)
        : null,
    }))
  );

  const { grants, deductions } = await loadAdvanceState(userId);
  const totalAdvanceDue = computeAdvanceDue(
    grants,
    deductions,
    year,
    month,
    editable.deductionAdvance
  );

  const payroll = buildMonthlyPayrollSummary(
    cells,
    dayMeta,
    summary,
    {
      salaryType: profile.salaryType,
      salaryAmount: profile.salaryAmount,
      otEligible: profile.otEligible,
      otHourlyRate: profile.otHourlyRate,
      warehouseCategory: employee.warehouseCategory ?? null,
      workingMinutesPerDay: profile.workingMinutesPerDay,
    },
    days.length,
    {
      totalAdvanceDue,
      deductionAdvance: editable.deductionAdvance,
      deductionOther: editable.deductionOther,
    }
  );

  return {
    payroll,
    advanceGrants: grants,
    advanceDeductions: deductions,
    advanceLedger: buildAdvanceLedger(
      grants,
      deductions,
      year,
      month,
      editable.deductionAdvance
    ),
  };
}

export const updateMonthlyPayroll = async (req: Request, res: Response) => {
  try {
    const { userId, year: yearStr, month: monthStr } = req.params;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const { deductionAdvance, deductionOther } = req.body as {
      deductionAdvance: number;
      deductionOther: number;
    };

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    const { grants, deductions } = await loadAdvanceState(userId);
    const cap = computeAdvanceDeductionCap(grants, deductions, year, month);
    if (deductionAdvance > cap) {
      return res.status(400).json({
        message: `Advance deduction cannot exceed remaining due of ${cap}`,
      });
    }

    const totalAdvanceDue = computeAdvanceDue(
      grants,
      deductions,
      year,
      month,
      deductionAdvance
    );

    await prisma.attendanceMonthlyPayroll.upsert({
      where: {
        userId_year_month: { userId, year, month },
      },
      create: {
        userId,
        year,
        month,
        totalAdvanceDue,
        deductionAdvance,
        deductionOther,
      },
      update: {
        totalAdvanceDue,
        deductionAdvance,
        deductionOther,
      },
    });

    const computed = await computeEmployeeMonthlyPayroll(userId, year, month, {
      deductionAdvance,
      deductionOther,
    });
    if (!computed) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    return res.json(computed);
  } catch (error) {
    console.error("updateMonthlyPayroll error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createSalaryAdvance = async (req: Request, res: Response) => {
  try {
    const { userId, amount, year, month, note } = req.body as {
      userId: string;
      amount: number;
      year: number;
      month: number;
      note?: string;
    };

    const employee = await getWarehouseEmployee(userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    await prisma.employeeSalaryAdvance.create({
      data: {
        userId,
        amount,
        year,
        month,
        note: note?.trim() ? note.trim() : null,
      },
    });

    const { grants, deductions, payrollRows } = await loadAdvanceState(userId);
    const saved = thisMonthPayrollRow(payrollRows, year, month);
    const deductionAdvance = saved?.deductionAdvance ?? 0;
    const deductionOther = saved?.deductionOther ?? 0;
    const totalAdvanceDue = computeAdvanceDue(
      grants,
      deductions,
      year,
      month,
      deductionAdvance
    );

    if (saved) {
      await prisma.attendanceMonthlyPayroll.update({
        where: { userId_year_month: { userId, year, month } },
        data: { totalAdvanceDue },
      });
    }

    const computed = await computeEmployeeMonthlyPayroll(userId, year, month, {
      deductionAdvance,
      deductionOther,
    });
    if (!computed) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    return res.json(computed);
  } catch (error) {
    console.error("createSalaryAdvance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSalaryAdvance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const year = parseInt(String(req.query.year), 10);
    const month = parseInt(String(req.query.month), 10);

    const grant = await prisma.employeeSalaryAdvance.findUnique({
      where: { id },
    });
    if (!grant) {
      return res.status(404).json({ message: "Advance record not found" });
    }

    const employee = await getWarehouseEmployee(grant.userId);
    if (!employee) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    await prisma.employeeSalaryAdvance.delete({ where: { id } });

    const { grants, deductions, payrollRows } = await loadAdvanceState(grant.userId);
    const saved = thisMonthPayrollRow(payrollRows, year, month);
    const deductionAdvance = saved?.deductionAdvance ?? 0;
    const deductionOther = saved?.deductionOther ?? 0;
    const totalAdvanceDue = computeAdvanceDue(
      grants,
      deductions,
      year,
      month,
      deductionAdvance
    );

    if (saved) {
      await prisma.attendanceMonthlyPayroll.update({
        where: { userId_year_month: { userId: grant.userId, year, month } },
        data: { totalAdvanceDue },
      });
    }

    const computed = await computeEmployeeMonthlyPayroll(
      grant.userId,
      year,
      month,
      { deductionAdvance, deductionOther }
    );
    if (!computed) {
      return res.status(404).json({ message: "Warehouse employee not found" });
    }

    return res.json(computed);
  } catch (error) {
    console.error("deleteSalaryAdvance error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
