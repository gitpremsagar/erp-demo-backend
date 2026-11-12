import { Request, Response, NextFunction } from "express";
import z from "zod";
import {
  CreateHolidaySchema,
  HolidaysQuerySchema,
  MonthlyParamsSchema,
  WarehouseMonthlyParamsSchema,
  UpdateMonthlyPayrollParamsSchema,
  UpdateMonthlyPayrollSchema,
  CreateSalaryAdvanceSchema,
  DeleteSalaryAdvanceParamsSchema,
  DeleteSalaryAdvanceQuerySchema,
  ProfilesQuerySchema,
  PunchActionSchema,
  UpdateProfileSchema,
  UserDateActionSchema,
  SetAttendanceRemarkSchema,
} from "./attendance.schema";

function handleZodError(error: unknown, res: Response): boolean {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: error.issues });
    return true;
  }
  res.status(500).json({ message: "Internal server error" });
  return true;
}

export const validatePunchAction = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = PunchActionSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateUserDateAction = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UserDateActionSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateCreateHoliday = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateHolidaySchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateUpdateProfile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateProfileSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateHolidaysQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    HolidaysQuerySchema.parse(req.query);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateProfilesQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ProfilesQuerySchema.parse(req.query);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateMonthlyParams = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    MonthlyParamsSchema.parse(req.params);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateWarehouseMonthlyParams = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    WarehouseMonthlyParamsSchema.parse(req.params);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateUpdateMonthlyPayroll = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateMonthlyPayrollParamsSchema.parse(req.params);
    req.body = UpdateMonthlyPayrollSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateCreateSalaryAdvance = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateSalaryAdvanceSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateDeleteSalaryAdvance = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    DeleteSalaryAdvanceParamsSchema.parse(req.params);
    DeleteSalaryAdvanceQuerySchema.parse(req.query);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};

export const validateSetAttendanceRemark = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = SetAttendanceRemarkSchema.parse(req.body);
  } catch (error) {
    if (handleZodError(error, res)) return;
  }
  next();
};
