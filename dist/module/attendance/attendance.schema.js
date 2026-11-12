"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteSalaryAdvanceQuerySchema = exports.DeleteSalaryAdvanceParamsSchema = exports.CreateSalaryAdvanceSchema = exports.UpdateMonthlyPayrollSchema = exports.UpdateMonthlyPayrollParamsSchema = exports.WarehouseMonthlyParamsSchema = exports.MonthlyParamsSchema = exports.ProfilesQuerySchema = exports.HolidaysQuerySchema = exports.UpdateProfileSchema = exports.CreateHolidaySchema = exports.SetAttendanceRemarkSchema = exports.UserDateActionSchema = exports.PunchActionSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const dateStringSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
exports.PunchActionSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    date: dateStringSchema,
    time: zod_1.z.coerce.date(),
});
exports.UserDateActionSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    date: dateStringSchema,
});
exports.SetAttendanceRemarkSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    date: dateStringSchema,
    remark: zod_1.z
        .union([zod_1.z.string().max(500, "Remark cannot exceed 500 characters"), zod_1.z.null()])
        .transform((value) => {
        if (value == null)
            return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }),
});
exports.CreateHolidaySchema = zod_1.z.object({
    date: dateStringSchema,
    department: zod_1.z.nativeEnum(client_1.Department),
    name: zod_1.z.string().optional(),
});
exports.UpdateProfileSchema = zod_1.z
    .object({
    workingMinutesPerDay: zod_1.z
        .number()
        .int()
        .min(30, "Working minutes must be at least 30")
        .max(960, "Working minutes cannot exceed 16 hours"),
    halfDayMinutes: zod_1.z
        .number()
        .int()
        .min(30, "Half-day minutes must be at least 30")
        .max(959, "Half-day minutes cannot exceed 15 hours 59 minutes"),
    salaryType: zod_1.z.enum(["MONTHLY", "DAILY"]).nullable(),
    salaryAmount: zod_1.z.number().min(0, "Salary cannot be negative").nullable(),
    otEligible: zod_1.z.boolean(),
    otHourlyRate: zod_1.z
        .number()
        .min(0, "OT hourly rate cannot be negative")
        .nullable(),
})
    .refine((data) => data.halfDayMinutes < data.workingMinutesPerDay, {
    message: "Half-day duration must be less than full working day",
    path: ["halfDayMinutes"],
})
    .refine((data) => !data.otEligible || (data.otHourlyRate !== null && data.otHourlyRate > 0), {
    message: "OT hourly rate is required when OT eligible",
    path: ["otHourlyRate"],
});
exports.HolidaysQuerySchema = zod_1.z.object({
    department: zod_1.z.nativeEnum(client_1.Department),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
});
exports.ProfilesQuerySchema = zod_1.z.object({
    department: zod_1.z.nativeEnum(client_1.Department),
});
exports.MonthlyParamsSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    month: zod_1.z.coerce.number().int().min(1).max(12),
});
exports.WarehouseMonthlyParamsSchema = zod_1.z.object({
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    month: zod_1.z.coerce.number().int().min(1).max(12),
});
exports.UpdateMonthlyPayrollParamsSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    month: zod_1.z.coerce.number().int().min(1).max(12),
});
exports.UpdateMonthlyPayrollSchema = zod_1.z.object({
    deductionAdvance: zod_1.z.number().min(0, "Advance deduction cannot be negative"),
    deductionOther: zod_1.z.number().min(0, "Other deduction cannot be negative"),
});
exports.CreateSalaryAdvanceSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
    amount: zod_1.z.number().gt(0, "Advance amount must be greater than 0"),
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    month: zod_1.z.coerce.number().int().min(1).max(12),
    note: zod_1.z.string().max(200).optional(),
});
exports.DeleteSalaryAdvanceParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, "Advance ID is required"),
});
exports.DeleteSalaryAdvanceQuerySchema = zod_1.z.object({
    year: zod_1.z.coerce.number().int().min(2000).max(2100),
    month: zod_1.z.coerce.number().int().min(1).max(12),
});
//# sourceMappingURL=attendance.schema.js.map