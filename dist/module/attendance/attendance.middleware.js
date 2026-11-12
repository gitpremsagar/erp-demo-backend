"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSetAttendanceRemark = exports.validateDeleteSalaryAdvance = exports.validateCreateSalaryAdvance = exports.validateUpdateMonthlyPayroll = exports.validateWarehouseMonthlyParams = exports.validateMonthlyParams = exports.validateProfilesQuery = exports.validateHolidaysQuery = exports.validateUpdateProfile = exports.validateCreateHoliday = exports.validateUserDateAction = exports.validatePunchAction = void 0;
const zod_1 = __importDefault(require("zod"));
const attendance_schema_1 = require("./attendance.schema");
function handleZodError(error, res) {
    if (error instanceof zod_1.default.ZodError) {
        res.status(400).json({ message: error.issues });
        return true;
    }
    res.status(500).json({ message: "Internal server error" });
    return true;
}
const validatePunchAction = (req, res, next) => {
    try {
        req.body = attendance_schema_1.PunchActionSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validatePunchAction = validatePunchAction;
const validateUserDateAction = (req, res, next) => {
    try {
        req.body = attendance_schema_1.UserDateActionSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateUserDateAction = validateUserDateAction;
const validateCreateHoliday = (req, res, next) => {
    try {
        req.body = attendance_schema_1.CreateHolidaySchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateCreateHoliday = validateCreateHoliday;
const validateUpdateProfile = (req, res, next) => {
    try {
        req.body = attendance_schema_1.UpdateProfileSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateUpdateProfile = validateUpdateProfile;
const validateHolidaysQuery = (req, res, next) => {
    try {
        attendance_schema_1.HolidaysQuerySchema.parse(req.query);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateHolidaysQuery = validateHolidaysQuery;
const validateProfilesQuery = (req, res, next) => {
    try {
        attendance_schema_1.ProfilesQuerySchema.parse(req.query);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateProfilesQuery = validateProfilesQuery;
const validateMonthlyParams = (req, res, next) => {
    try {
        attendance_schema_1.MonthlyParamsSchema.parse(req.params);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateMonthlyParams = validateMonthlyParams;
const validateWarehouseMonthlyParams = (req, res, next) => {
    try {
        attendance_schema_1.WarehouseMonthlyParamsSchema.parse(req.params);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateWarehouseMonthlyParams = validateWarehouseMonthlyParams;
const validateUpdateMonthlyPayroll = (req, res, next) => {
    try {
        attendance_schema_1.UpdateMonthlyPayrollParamsSchema.parse(req.params);
        req.body = attendance_schema_1.UpdateMonthlyPayrollSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateUpdateMonthlyPayroll = validateUpdateMonthlyPayroll;
const validateCreateSalaryAdvance = (req, res, next) => {
    try {
        req.body = attendance_schema_1.CreateSalaryAdvanceSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateCreateSalaryAdvance = validateCreateSalaryAdvance;
const validateDeleteSalaryAdvance = (req, res, next) => {
    try {
        attendance_schema_1.DeleteSalaryAdvanceParamsSchema.parse(req.params);
        attendance_schema_1.DeleteSalaryAdvanceQuerySchema.parse(req.query);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateDeleteSalaryAdvance = validateDeleteSalaryAdvance;
const validateSetAttendanceRemark = (req, res, next) => {
    try {
        req.body = attendance_schema_1.SetAttendanceRemarkSchema.parse(req.body);
    }
    catch (error) {
        if (handleZodError(error, res))
            return;
    }
    next();
};
exports.validateSetAttendanceRemark = validateSetAttendanceRemark;
//# sourceMappingURL=attendance.middleware.js.map