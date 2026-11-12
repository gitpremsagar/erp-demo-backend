"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSalaryAdvance = exports.createSalaryAdvance = exports.updateMonthlyPayroll = exports.updateProfile = exports.getProfiles = exports.deleteHoliday = exports.createHoliday = exports.getHolidays = exports.setAttendanceRemark = exports.undoAttendance = exports.markAbsent = exports.punchOut = exports.punchIn = exports.getEmployeeMonthlyAttendance = exports.getWarehouseMonthlyAttendance = exports.getWarehouseDailySheet = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const attendanceCalc_1 = require("./attendanceCalc");
const orderTwoSideDistance_1 = require("../../lib/orderTwoSideDistance");
const WAREHOUSE_DEPARTMENT = client_1.Department.WAREHOUSE;
const WAREHOUSE_CATEGORY_ORDER = [
    client_1.WarehouseEmployeeCategory.STAFF,
    client_1.WarehouseEmployeeCategory.DRIVER,
    client_1.WarehouseEmployeeCategory.LABOR,
    client_1.WarehouseEmployeeCategory.WB_LABOR,
];
const WAREHOUSE_CATEGORY_LABELS = {
    [client_1.WarehouseEmployeeCategory.STAFF]: "Staff",
    [client_1.WarehouseEmployeeCategory.DRIVER]: "Driver",
    [client_1.WarehouseEmployeeCategory.LABOR]: "Labor",
    [client_1.WarehouseEmployeeCategory.WB_LABOR]: "WB Labor",
};
function getAdminId(req) {
    const user = req.user;
    return user?.id ?? null;
}
async function getDeclaredHoliday(date, department) {
    return prisma_1.prisma.attendanceHoliday.findUnique({
        where: {
            date_department: { date, department },
        },
    });
}
async function isDateHoliday(date, department) {
    const declared = await getDeclaredHoliday(date, department);
    return (0, attendanceCalc_1.isHolidayDate)(date, department, declared);
}
function resolveProfileDefaults(profile) {
    const workingMinutesPerDay = profile?.workingMinutesPerDay ?? attendanceCalc_1.DEFAULT_WORKING_MINUTES_PER_DAY;
    const halfDayMinutes = profile?.halfDayMinutes ?? Math.floor(workingMinutesPerDay / 2);
    return {
        workingMinutesPerDay,
        halfDayMinutes,
        salaryType: profile?.salaryType ?? null,
        salaryAmount: profile?.salaryAmount ?? null,
        otEligible: profile?.otEligible ?? false,
        otHourlyRate: profile?.otHourlyRate ?? null,
    };
}
async function getEmployeeAttendanceProfile(userId) {
    const profile = await prisma_1.prisma.employeeAttendanceProfile.findUnique({
        where: { userId },
    });
    return resolveProfileDefaults(profile);
}
function warehouseAttendanceEmployeeWhere(userId) {
    return {
        ...(userId ? { id: userId } : {}),
        department: WAREHOUSE_DEPARTMENT,
        warehouseCategory: { not: null },
    };
}
async function getWarehouseEmployee(userId) {
    return prisma_1.prisma.user.findFirst({
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
function serializeRecord(record) {
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
function serializeAdvanceGrant(grant) {
    return {
        id: grant.id,
        year: grant.year,
        month: grant.month,
        amount: grant.amount,
        note: grant.note,
    };
}
function serializeAdvanceDeductions(rows) {
    return rows.map((row) => ({
        year: row.year,
        month: row.month,
        amount: row.deductionAdvance,
    }));
}
async function loadAdvanceState(userId) {
    const [grantRows, payrollRows] = await Promise.all([
        prisma_1.prisma.employeeSalaryAdvance.findMany({
            where: { userId },
            orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
        }),
        prisma_1.prisma.attendanceMonthlyPayroll.findMany({
            where: { userId },
        }),
    ]);
    return {
        grants: grantRows.map(serializeAdvanceGrant),
        deductions: serializeAdvanceDeductions(payrollRows),
        payrollRows,
    };
}
function thisMonthPayrollRow(payrollRows, year, month) {
    return payrollRows.find((row) => row.year === year && row.month === month) ?? null;
}
const getWarehouseDailySheet = async (req, res) => {
    try {
        const { date: dateParam } = req.params;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateParam);
        if (!date) {
            return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD" });
        }
        const declaredHoliday = await getDeclaredHoliday(date, WAREHOUSE_DEPARTMENT);
        const holidaySource = (0, attendanceCalc_1.getHolidaySource)(date, declaredHoliday !== null);
        const isHoliday = holidaySource !== null;
        const employees = await prisma_1.prisma.user.findMany({
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
            const displayStatus = (0, attendanceCalc_1.resolveDisplayStatus)(isHoliday, record, dateParam);
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
                    date: (0, attendanceCalc_1.formatIstDateString)(declaredHoliday.date),
                }
                : null,
            employees: rows,
        });
    }
    catch (error) {
        console.error("getWarehouseDailySheet error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getWarehouseDailySheet = getWarehouseDailySheet;
function buildMonthlySummary(cells) {
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
            case client_1.AttendanceStatus.PRESENT:
                summary.present += 1;
                break;
            case client_1.AttendanceStatus.HALF_DAY:
                summary.halfDay += 1;
                break;
            case client_1.AttendanceStatus.ABSENT:
                summary.absent += 1;
                break;
            case client_1.AttendanceStatus.HOLIDAY:
                summary.holiday += 1;
                break;
            case client_1.AttendanceStatus.IN_PROGRESS:
                summary.inProgress += 1;
                break;
            case client_1.AttendanceStatus.NOT_MARKED:
                summary.notMarked += 1;
                break;
        }
        if (cell.record) {
            summary.totalExtraMinutes += cell.record.extraMinutes;
            if (cell.record.punchIn && cell.record.punchOut) {
                summary.totalWorkedMinutes += (0, attendanceCalc_1.diffMinutes)(new Date(cell.record.punchIn), new Date(cell.record.punchOut));
            }
        }
    }
    return summary;
}
const getWarehouseMonthlyAttendance = async (req, res) => {
    try {
        const { year: yearStr, month: monthStr } = req.params;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const { from, to, days } = (0, attendanceCalc_1.getIstMonthDateRange)(year, month);
        const employees = await prisma_1.prisma.user.findMany({
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
            .filter((e) => e.warehouseCategory === client_1.WarehouseEmployeeCategory.DRIVER)
            .map((e) => e.id);
        const [records, holidays, profiles, payrollRecords, advanceRecords, driverOrders] = await Promise.all([
            userIds.length
                ? prisma_1.prisma.attendanceRecord.findMany({
                    where: { userId: { in: userIds }, date: { gte: from, lte: to } },
                })
                : Promise.resolve([]),
            prisma_1.prisma.attendanceHoliday.findMany({
                where: {
                    department: WAREHOUSE_DEPARTMENT,
                    date: { gte: from, lte: to },
                },
            }),
            userIds.length
                ? prisma_1.prisma.employeeAttendanceProfile.findMany({
                    where: { userId: { in: userIds } },
                })
                : Promise.resolve([]),
            userIds.length
                ? prisma_1.prisma.attendanceMonthlyPayroll.findMany({
                    where: { userId: { in: userIds } },
                })
                : Promise.resolve([]),
            userIds.length
                ? prisma_1.prisma.employeeSalaryAdvance.findMany({
                    where: { userId: { in: userIds } },
                    orderBy: [{ year: "asc" }, { month: "asc" }, { createdAt: "asc" }],
                })
                : Promise.resolve([]),
            driverIds.length
                ? prisma_1.prisma.order.findMany({
                    where: {
                        driverId: { in: driverIds },
                        deliveryDate: {
                            gte: from,
                            lte: new Date(`${days[days.length - 1]}T23:59:59.999+05:30`),
                        },
                    },
                    orderBy: { deliveryDate: "asc" },
                    select: {
                        id: true,
                        customeOrderId: true,
                        tallyInvoiceId: true,
                        deliveryDate: true,
                        driverId: true,
                        ...orderTwoSideDistance_1.orderTwoSideDistanceSelect,
                    },
                })
                : Promise.resolve([]),
        ]);
        const driverTripStatsByUserId = new Map();
        for (const order of driverOrders) {
            if (!order.driverId || !order.deliveryDate)
                continue;
            const distance = (0, orderTwoSideDistance_1.resolveOrderTwoSideDistance)(order);
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
        const profileByUserId = new Map(profiles.map((p) => [
            p.userId,
            resolveProfileDefaults(p),
        ]));
        const payrollRowsByUserId = new Map();
        for (const row of payrollRecords) {
            const list = payrollRowsByUserId.get(row.userId) ?? [];
            list.push(row);
            payrollRowsByUserId.set(row.userId, list);
        }
        const grantsByUserId = new Map();
        for (const grant of advanceRecords) {
            const list = grantsByUserId.get(grant.userId) ?? [];
            list.push(serializeAdvanceGrant(grant));
            grantsByUserId.set(grant.userId, list);
        }
        const holidayByDate = new Map(holidays.map((h) => [(0, attendanceCalc_1.formatIstDateString)(h.date), h]));
        const dayMeta = days.map((dateStr) => {
            const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
            const declaredHoliday = holidayByDate.get(dateStr) ?? null;
            const holidaySource = (0, attendanceCalc_1.getHolidaySource)(date, declaredHoliday !== null);
            const isHoliday = holidaySource !== null;
            const dayOfMonth = parseInt(dateStr.split("-")[2], 10);
            return {
                date: dateStr,
                dayOfMonth,
                weekday: (0, attendanceCalc_1.getIstWeekdayName)(date),
                isHoliday,
                holidaySource,
                holidayName: declaredHoliday?.name ?? null,
            };
        });
        const recordByUserAndDate = new Map();
        for (const r of records) {
            const dateStr = (0, attendanceCalc_1.formatIstDateString)(r.date);
            if (!recordByUserAndDate.has(r.userId)) {
                recordByUserAndDate.set(r.userId, new Map());
            }
            recordByUserAndDate.get(r.userId).set(dateStr, r);
        }
        // Heal status/extraMinutes from punches so half-day surplus OT applies to older rows.
        const healUpdates = [];
        for (const r of records) {
            if (!r.punchIn || !r.punchOut)
                continue;
            const dateStr = (0, attendanceCalc_1.formatIstDateString)(r.date);
            const day = dayMeta.find((d) => d.date === dateStr);
            const profile = profileByUserId.get(r.userId) ?? resolveProfileDefaults(null);
            const { status, extraMinutes } = (0, attendanceCalc_1.calculateAttendanceFromPunch)(r.punchIn, r.punchOut, profile.workingMinutesPerDay, profile.halfDayMinutes, day?.isHoliday ?? false);
            if (r.status === status && r.extraMinutes === extraMinutes)
                continue;
            recordByUserAndDate.get(r.userId)?.set(dateStr, {
                ...r,
                status,
                extraMinutes,
            });
            healUpdates.push(prisma_1.prisma.attendanceRecord.update({
                where: { id: r.id },
                data: { status, extraMinutes },
            }));
        }
        if (healUpdates.length) {
            await Promise.all(healUpdates);
        }
        const buildEmployeeRow = (emp) => {
            const profile = profileByUserId.get(emp.id) ?? resolveProfileDefaults(null);
            const userRecords = recordByUserAndDate.get(emp.id) ?? new Map();
            const payrollRows = payrollRowsByUserId.get(emp.id) ?? [];
            const savedPayroll = thisMonthPayrollRow(payrollRows, year, month);
            const grants = grantsByUserId.get(emp.id) ?? [];
            const deductions = serializeAdvanceDeductions(payrollRows);
            const deductionAdvance = savedPayroll?.deductionAdvance ?? 0;
            const deductionOther = savedPayroll?.deductionOther ?? 0;
            const totalAdvanceDue = (0, attendanceCalc_1.computeAdvanceDue)(grants, deductions, year, month, deductionAdvance);
            const editable = {
                totalAdvanceDue,
                deductionAdvance,
                deductionOther,
            };
            const cells = dayMeta.map((day) => {
                const record = userRecords.get(day.date) ?? null;
                const displayStatus = (0, attendanceCalc_1.resolveDisplayStatus)(day.isHoliday, record, day.date);
                return {
                    date: day.date,
                    displayStatus,
                    record: record ? serializeRecord(record) : null,
                };
            });
            const summary = buildMonthlySummary(cells);
            const isDriver = emp.warehouseCategory === client_1.WarehouseEmployeeCategory.DRIVER;
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
                advanceLedger: (0, attendanceCalc_1.buildAdvanceLedger)(grants, deductions, year, month, deductionAdvance),
                payroll: (0, attendanceCalc_1.buildMonthlyPayrollSummary)(cells, dayMeta, summary, {
                    salaryType: profile.salaryType,
                    salaryAmount: profile.salaryAmount,
                    otEligible: profile.otEligible,
                    otHourlyRate: profile.otHourlyRate,
                    warehouseCategory: emp.warehouseCategory ?? null,
                    workingMinutesPerDay: profile.workingMinutesPerDay,
                }, days.length, editable),
            };
        };
        const groups = WAREHOUSE_CATEGORY_ORDER.map((category) => ({
            label: WAREHOUSE_CATEGORY_LABELS[category],
            category,
            employees: employees
                .filter((e) => (e.warehouseCategory ?? client_1.WarehouseEmployeeCategory.STAFF) === category)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(buildEmployeeRow),
        }));
        return res.json({
            year,
            month,
            days: dayMeta,
            groups,
        });
    }
    catch (error) {
        console.error("getWarehouseMonthlyAttendance error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getWarehouseMonthlyAttendance = getWarehouseMonthlyAttendance;
const getEmployeeMonthlyAttendance = async (req, res) => {
    try {
        const { userId, year: yearStr, month: monthStr } = req.params;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        const profile = await getEmployeeAttendanceProfile(userId);
        const { from, to, days } = (0, attendanceCalc_1.getIstMonthDateRange)(year, month);
        const [records, holidays] = await Promise.all([
            prisma_1.prisma.attendanceRecord.findMany({
                where: { userId, date: { gte: from, lte: to } },
            }),
            prisma_1.prisma.attendanceHoliday.findMany({
                where: {
                    department: WAREHOUSE_DEPARTMENT,
                    date: { gte: from, lte: to },
                },
            }),
        ]);
        const recordByDate = new Map(records.map((r) => [(0, attendanceCalc_1.formatIstDateString)(r.date), r]));
        const holidayByDate = new Map(holidays.map((h) => [(0, attendanceCalc_1.formatIstDateString)(h.date), h]));
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
            const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
            const declaredHoliday = holidayByDate.get(dateStr) ?? null;
            const holidaySource = (0, attendanceCalc_1.getHolidaySource)(date, declaredHoliday !== null);
            const isHoliday = holidaySource !== null;
            const record = recordByDate.get(dateStr) ?? null;
            const displayStatus = (0, attendanceCalc_1.resolveDisplayStatus)(isHoliday, record, dateStr);
            switch (displayStatus) {
                case client_1.AttendanceStatus.PRESENT:
                    summary.present += 1;
                    break;
                case client_1.AttendanceStatus.HALF_DAY:
                    summary.halfDay += 1;
                    break;
                case client_1.AttendanceStatus.ABSENT:
                    summary.absent += 1;
                    break;
                case client_1.AttendanceStatus.HOLIDAY:
                    summary.holiday += 1;
                    break;
                case client_1.AttendanceStatus.IN_PROGRESS:
                    summary.inProgress += 1;
                    break;
                case client_1.AttendanceStatus.NOT_MARKED:
                    summary.notMarked += 1;
                    break;
            }
            if (record) {
                summary.totalExtraMinutes += record.extraMinutes;
                if (record.punchIn && record.punchOut) {
                    summary.totalWorkedMinutes += (0, attendanceCalc_1.diffMinutes)(record.punchIn, record.punchOut);
                }
            }
            return {
                date: dateStr,
                weekday: (0, attendanceCalc_1.getIstWeekdayName)(date),
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
    }
    catch (error) {
        console.error("getEmployeeMonthlyAttendance error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getEmployeeMonthlyAttendance = getEmployeeMonthlyAttendance;
const punchIn = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { userId, date: dateStr, time } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        if (!(0, attendanceCalc_1.isSameIstCalendarDay)(date, time)) {
            return res
                .status(400)
                .json({ message: "Punch time must be on the selected date (IST)" });
        }
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        const existing = await prisma_1.prisma.attendanceRecord.findUnique({
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
        const record = await prisma_1.prisma.attendanceRecord.upsert({
            where: { userId_date: { userId, date } },
            create: {
                userId,
                date,
                department: WAREHOUSE_DEPARTMENT,
                punchIn: time,
                status: client_1.AttendanceStatus.IN_PROGRESS,
                lastAction: client_1.AttendanceAction.PUNCH_IN,
                markedById: adminId,
            },
            update: {
                punchIn: time,
                punchOut: null,
                extraMinutes: 0,
                isManualAbsent: false,
                status: client_1.AttendanceStatus.IN_PROGRESS,
                lastAction: client_1.AttendanceAction.PUNCH_IN,
                markedById: adminId,
            },
        });
        return res.json({ record: serializeRecord(record) });
    }
    catch (error) {
        console.error("punchIn error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.punchIn = punchIn;
const punchOut = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { userId, date: dateStr, time } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const punchOutDay = (0, attendanceCalc_1.formatIstDateString)(time);
        const nextDay = (0, attendanceCalc_1.addDaysToIstDateString)(dateStr, 1);
        if (punchOutDay !== dateStr && punchOutDay !== nextDay) {
            return res.status(400).json({
                message: "Punch out time must be on the selected date or the next day (IST)",
            });
        }
        const existing = await prisma_1.prisma.attendanceRecord.findUnique({
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
        const { status, extraMinutes } = (0, attendanceCalc_1.calculateAttendanceFromPunch)(existing.punchIn, time, profile.workingMinutesPerDay, profile.halfDayMinutes, isHoliday);
        const record = await prisma_1.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
                punchOut: time,
                status,
                extraMinutes,
                isManualAbsent: false,
                lastAction: client_1.AttendanceAction.PUNCH_OUT,
                markedById: adminId,
            },
        });
        return res.json({ record: serializeRecord(record) });
    }
    catch (error) {
        console.error("punchOut error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.punchOut = punchOut;
const markAbsent = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { userId, date: dateStr } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        const record = await prisma_1.prisma.attendanceRecord.upsert({
            where: { userId_date: { userId, date } },
            create: {
                userId,
                date,
                department: WAREHOUSE_DEPARTMENT,
                status: client_1.AttendanceStatus.ABSENT,
                isManualAbsent: true,
                lastAction: client_1.AttendanceAction.ABSENT,
                markedById: adminId,
            },
            update: {
                punchIn: null,
                punchOut: null,
                extraMinutes: 0,
                status: client_1.AttendanceStatus.ABSENT,
                isManualAbsent: true,
                lastAction: client_1.AttendanceAction.ABSENT,
                markedById: adminId,
            },
        });
        return res.json({ record: serializeRecord(record) });
    }
    catch (error) {
        console.error("markAbsent error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.markAbsent = markAbsent;
const undoAttendance = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { userId, date: dateStr } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const existing = await prisma_1.prisma.attendanceRecord.findUnique({
            where: { userId_date: { userId, date } },
        });
        if (!existing?.lastAction) {
            return res.status(400).json({ message: "Nothing to undo" });
        }
        let record;
        switch (existing.lastAction) {
            case client_1.AttendanceAction.ABSENT: {
                if (existing.remark) {
                    record = await prisma_1.prisma.attendanceRecord.update({
                        where: { id: existing.id },
                        data: {
                            punchIn: null,
                            punchOut: null,
                            extraMinutes: 0,
                            isManualAbsent: false,
                            status: client_1.AttendanceStatus.NOT_MARKED,
                            lastAction: null,
                            markedById: adminId,
                        },
                    });
                    break;
                }
                await prisma_1.prisma.attendanceRecord.delete({ where: { id: existing.id } });
                return res.json({ record: null });
            }
            case client_1.AttendanceAction.PUNCH_OUT:
                record = await prisma_1.prisma.attendanceRecord.update({
                    where: { id: existing.id },
                    data: {
                        punchOut: null,
                        extraMinutes: 0,
                        status: client_1.AttendanceStatus.IN_PROGRESS,
                        lastAction: client_1.AttendanceAction.PUNCH_IN,
                        markedById: adminId,
                    },
                });
                break;
            case client_1.AttendanceAction.PUNCH_IN: {
                if (existing.remark) {
                    record = await prisma_1.prisma.attendanceRecord.update({
                        where: { id: existing.id },
                        data: {
                            punchIn: null,
                            punchOut: null,
                            extraMinutes: 0,
                            isManualAbsent: false,
                            status: client_1.AttendanceStatus.NOT_MARKED,
                            lastAction: null,
                            markedById: adminId,
                        },
                    });
                    break;
                }
                await prisma_1.prisma.attendanceRecord.delete({ where: { id: existing.id } });
                return res.json({ record: null });
            }
            default:
                return res.status(400).json({ message: "Nothing to undo" });
        }
        return res.json({ record: serializeRecord(record) });
    }
    catch (error) {
        console.error("undoAttendance error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.undoAttendance = undoAttendance;
const setAttendanceRemark = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { userId, date: dateStr, remark: rawRemark } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        const remark = typeof rawRemark === "string" && rawRemark.trim()
            ? rawRemark.trim()
            : null;
        const existing = await prisma_1.prisma.attendanceRecord.findUnique({
            where: { userId_date: { userId, date } },
        });
        if (!remark &&
            existing &&
            !existing.punchIn &&
            !existing.punchOut &&
            !existing.isManualAbsent &&
            !existing.lastAction) {
            await prisma_1.prisma.attendanceRecord.delete({ where: { id: existing.id } });
            return res.json({ record: null });
        }
        const record = await prisma_1.prisma.attendanceRecord.upsert({
            where: { userId_date: { userId, date } },
            create: {
                userId,
                date,
                department: WAREHOUSE_DEPARTMENT,
                status: client_1.AttendanceStatus.NOT_MARKED,
                remark,
                markedById: adminId,
            },
            update: {
                remark,
                markedById: adminId,
            },
        });
        return res.json({ record: serializeRecord(record) });
    }
    catch (error) {
        console.error("setAttendanceRemark error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.setAttendanceRemark = setAttendanceRemark;
const getHolidays = async (req, res) => {
    try {
        const { department, from, to } = req.query;
        const where = { department };
        if (from || to) {
            where.date = {};
            if (from) {
                const fromDate = (0, attendanceCalc_1.parseAttendanceDateParam)(from);
                if (!fromDate) {
                    return res.status(400).json({ message: "Invalid from date" });
                }
                where.date.gte = fromDate;
            }
            if (to) {
                const toDate = (0, attendanceCalc_1.parseAttendanceDateParam)(to);
                if (!toDate) {
                    return res.status(400).json({ message: "Invalid to date" });
                }
                where.date.lte = toDate;
            }
        }
        const holidays = await prisma_1.prisma.attendanceHoliday.findMany({
            where,
            orderBy: { date: "asc" },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });
        return res.json({
            holidays: holidays.map((h) => ({
                id: h.id,
                date: (0, attendanceCalc_1.formatIstDateString)(h.date),
                department: h.department,
                name: h.name,
                createdBy: h.createdBy,
                createdAt: h.createdAt.toISOString(),
            })),
        });
    }
    catch (error) {
        console.error("getHolidays error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getHolidays = getHolidays;
const createHoliday = async (req, res) => {
    try {
        const adminId = getAdminId(req);
        if (!adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { date: dateStr, department, name } = req.body;
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        if (!date) {
            return res.status(400).json({ message: "Invalid date" });
        }
        if ((0, attendanceCalc_1.isSundayIst)(date)) {
            return res
                .status(400)
                .json({ message: "Sunday is already a system holiday" });
        }
        const existing = await getDeclaredHoliday(date, department);
        if (existing) {
            return res.status(409).json({ message: "Holiday already declared for this date" });
        }
        const holiday = await prisma_1.prisma.attendanceHoliday.create({
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
                date: (0, attendanceCalc_1.formatIstDateString)(holiday.date),
                department: holiday.department,
                name: holiday.name,
            },
        });
    }
    catch (error) {
        console.error("createHoliday error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.createHoliday = createHoliday;
const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const holiday = await prisma_1.prisma.attendanceHoliday.findUnique({ where: { id } });
        if (!holiday) {
            return res.status(404).json({ message: "Holiday not found" });
        }
        await prisma_1.prisma.attendanceHoliday.delete({ where: { id } });
        return res.json({ message: "Holiday removed" });
    }
    catch (error) {
        console.error("deleteHoliday error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteHoliday = deleteHoliday;
const getProfiles = async (req, res) => {
    try {
        const { department } = req.query;
        const employees = await prisma_1.prisma.user.findMany({
            where: department === WAREHOUSE_DEPARTMENT
                ? warehouseAttendanceEmployeeWhere()
                : {
                    department,
                    userType: { in: attendanceCalc_1.WAREHOUSE_EMPLOYEE_TYPES },
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
    }
    catch (error) {
        console.error("getProfiles error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProfiles = getProfiles;
const updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const { workingMinutesPerDay, halfDayMinutes, salaryType, salaryAmount, otEligible, otHourlyRate, } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, department: true, userType: true },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const profile = await prisma_1.prisma.employeeAttendanceProfile.upsert({
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
    }
    catch (error) {
        console.error("updateProfile error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProfile = updateProfile;
async function computeEmployeeMonthlyPayroll(userId, year, month, editable) {
    const employee = await getWarehouseEmployee(userId);
    if (!employee)
        return null;
    const profile = await getEmployeeAttendanceProfile(userId);
    const { from, to, days } = (0, attendanceCalc_1.getIstMonthDateRange)(year, month);
    const [records, holidays] = await Promise.all([
        prisma_1.prisma.attendanceRecord.findMany({
            where: { userId, date: { gte: from, lte: to } },
        }),
        prisma_1.prisma.attendanceHoliday.findMany({
            where: {
                department: WAREHOUSE_DEPARTMENT,
                date: { gte: from, lte: to },
            },
        }),
    ]);
    const holidayByDate = new Map(holidays.map((h) => [(0, attendanceCalc_1.formatIstDateString)(h.date), h]));
    const dayMeta = days.map((dateStr) => {
        const date = (0, attendanceCalc_1.parseAttendanceDateParam)(dateStr);
        const declaredHoliday = holidayByDate.get(dateStr) ?? null;
        const holidaySource = (0, attendanceCalc_1.getHolidaySource)(date, declaredHoliday !== null);
        const isHoliday = holidaySource !== null;
        return { holidaySource, isHoliday, date: dateStr };
    });
    const recordByDate = new Map(records.map((r) => [(0, attendanceCalc_1.formatIstDateString)(r.date), r]));
    const cells = dayMeta.map((day) => {
        const record = recordByDate.get(day.date) ?? null;
        const displayStatus = (0, attendanceCalc_1.resolveDisplayStatus)(day.isHoliday, record, day.date);
        return {
            displayStatus,
            record: record ? serializeRecord(record) : null,
        };
    });
    const summary = buildMonthlySummary(cells.map((cell, i) => ({
        displayStatus: cell.displayStatus,
        record: recordByDate.get(dayMeta[i].date)
            ? serializeRecord(recordByDate.get(dayMeta[i].date))
            : null,
    })));
    const { grants, deductions } = await loadAdvanceState(userId);
    const totalAdvanceDue = (0, attendanceCalc_1.computeAdvanceDue)(grants, deductions, year, month, editable.deductionAdvance);
    const payroll = (0, attendanceCalc_1.buildMonthlyPayrollSummary)(cells, dayMeta, summary, {
        salaryType: profile.salaryType,
        salaryAmount: profile.salaryAmount,
        otEligible: profile.otEligible,
        otHourlyRate: profile.otHourlyRate,
        warehouseCategory: employee.warehouseCategory ?? null,
        workingMinutesPerDay: profile.workingMinutesPerDay,
    }, days.length, {
        totalAdvanceDue,
        deductionAdvance: editable.deductionAdvance,
        deductionOther: editable.deductionOther,
    });
    return {
        payroll,
        advanceGrants: grants,
        advanceDeductions: deductions,
        advanceLedger: (0, attendanceCalc_1.buildAdvanceLedger)(grants, deductions, year, month, editable.deductionAdvance),
    };
}
const updateMonthlyPayroll = async (req, res) => {
    try {
        const { userId, year: yearStr, month: monthStr } = req.params;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const { deductionAdvance, deductionOther } = req.body;
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        const { grants, deductions } = await loadAdvanceState(userId);
        const cap = (0, attendanceCalc_1.computeAdvanceDeductionCap)(grants, deductions, year, month);
        if (deductionAdvance > cap) {
            return res.status(400).json({
                message: `Advance deduction cannot exceed remaining due of ${cap}`,
            });
        }
        const totalAdvanceDue = (0, attendanceCalc_1.computeAdvanceDue)(grants, deductions, year, month, deductionAdvance);
        await prisma_1.prisma.attendanceMonthlyPayroll.upsert({
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
    }
    catch (error) {
        console.error("updateMonthlyPayroll error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateMonthlyPayroll = updateMonthlyPayroll;
const createSalaryAdvance = async (req, res) => {
    try {
        const { userId, amount, year, month, note } = req.body;
        const employee = await getWarehouseEmployee(userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        await prisma_1.prisma.employeeSalaryAdvance.create({
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
        const totalAdvanceDue = (0, attendanceCalc_1.computeAdvanceDue)(grants, deductions, year, month, deductionAdvance);
        if (saved) {
            await prisma_1.prisma.attendanceMonthlyPayroll.update({
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
    }
    catch (error) {
        console.error("createSalaryAdvance error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.createSalaryAdvance = createSalaryAdvance;
const deleteSalaryAdvance = async (req, res) => {
    try {
        const { id } = req.params;
        const year = parseInt(String(req.query.year), 10);
        const month = parseInt(String(req.query.month), 10);
        const grant = await prisma_1.prisma.employeeSalaryAdvance.findUnique({
            where: { id },
        });
        if (!grant) {
            return res.status(404).json({ message: "Advance record not found" });
        }
        const employee = await getWarehouseEmployee(grant.userId);
        if (!employee) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        await prisma_1.prisma.employeeSalaryAdvance.delete({ where: { id } });
        const { grants, deductions, payrollRows } = await loadAdvanceState(grant.userId);
        const saved = thisMonthPayrollRow(payrollRows, year, month);
        const deductionAdvance = saved?.deductionAdvance ?? 0;
        const deductionOther = saved?.deductionOther ?? 0;
        const totalAdvanceDue = (0, attendanceCalc_1.computeAdvanceDue)(grants, deductions, year, month, deductionAdvance);
        if (saved) {
            await prisma_1.prisma.attendanceMonthlyPayroll.update({
                where: { userId_year_month: { userId: grant.userId, year, month } },
                data: { totalAdvanceDue },
            });
        }
        const computed = await computeEmployeeMonthlyPayroll(grant.userId, year, month, { deductionAdvance, deductionOther });
        if (!computed) {
            return res.status(404).json({ message: "Warehouse employee not found" });
        }
        return res.json(computed);
    }
    catch (error) {
        console.error("deleteSalaryAdvance error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteSalaryAdvance = deleteSalaryAdvance;
//# sourceMappingURL=attendance.controller.js.map