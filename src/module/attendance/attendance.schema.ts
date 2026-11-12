import { z } from "zod";
import { Department } from "@prisma/client";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const PunchActionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  date: dateStringSchema,
  time: z.coerce.date(),
});

export const UserDateActionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  date: dateStringSchema,
});

export const SetAttendanceRemarkSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  date: dateStringSchema,
  remark: z
    .union([z.string().max(500, "Remark cannot exceed 500 characters"), z.null()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export const CreateHolidaySchema = z.object({
  date: dateStringSchema,
  department: z.nativeEnum(Department),
  name: z.string().optional(),
});

export const UpdateProfileSchema = z
  .object({
    workingMinutesPerDay: z
      .number()
      .int()
      .min(30, "Working minutes must be at least 30")
      .max(960, "Working minutes cannot exceed 16 hours"),
    halfDayMinutes: z
      .number()
      .int()
      .min(30, "Half-day minutes must be at least 30")
      .max(959, "Half-day minutes cannot exceed 15 hours 59 minutes"),
    salaryType: z.enum(["MONTHLY", "DAILY"]).nullable(),
    salaryAmount: z.number().min(0, "Salary cannot be negative").nullable(),
    otEligible: z.boolean(),
    otHourlyRate: z
      .number()
      .min(0, "OT hourly rate cannot be negative")
      .nullable(),
  })
  .refine((data) => data.halfDayMinutes < data.workingMinutesPerDay, {
    message: "Half-day duration must be less than full working day",
    path: ["halfDayMinutes"],
  })
  .refine(
    (data) => !data.otEligible || (data.otHourlyRate !== null && data.otHourlyRate > 0),
    {
      message: "OT hourly rate is required when OT eligible",
      path: ["otHourlyRate"],
    }
  );

export const HolidaysQuerySchema = z.object({
  department: z.nativeEnum(Department),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const ProfilesQuerySchema = z.object({
  department: z.nativeEnum(Department),
});

export const MonthlyParamsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const WarehouseMonthlyParamsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const UpdateMonthlyPayrollParamsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const UpdateMonthlyPayrollSchema = z.object({
  deductionAdvance: z.number().min(0, "Advance deduction cannot be negative"),
  deductionOther: z.number().min(0, "Other deduction cannot be negative"),
});

export const CreateSalaryAdvanceSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  amount: z.number().gt(0, "Advance amount must be greater than 0"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  note: z.string().max(200).optional(),
});

export const DeleteSalaryAdvanceParamsSchema = z.object({
  id: z.string().min(1, "Advance ID is required"),
});

export const DeleteSalaryAdvanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
