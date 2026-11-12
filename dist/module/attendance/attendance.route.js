"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const attendance_controller_1 = require("./attendance.controller");
const attendance_middleware_1 = require("./attendance.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/warehouse/daily/:date", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_controller_1.getWarehouseDailySheet);
router.get("/warehouse/monthly/:year/:month", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateWarehouseMonthlyParams, attendance_controller_1.getWarehouseMonthlyAttendance);
router.put("/warehouse/monthly/:year/:month/payroll/:userId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateUpdateMonthlyPayroll, attendance_controller_1.updateMonthlyPayroll);
router.post("/warehouse/advances", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateCreateSalaryAdvance, attendance_controller_1.createSalaryAdvance);
router.delete("/warehouse/advances/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateDeleteSalaryAdvance, attendance_controller_1.deleteSalaryAdvance);
router.get("/warehouse/employee/:userId/monthly/:year/:month", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateMonthlyParams, attendance_controller_1.getEmployeeMonthlyAttendance);
router.post("/warehouse/punch-in", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validatePunchAction, attendance_controller_1.punchIn);
router.post("/warehouse/punch-out", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validatePunchAction, attendance_controller_1.punchOut);
router.post("/warehouse/mark-absent", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateUserDateAction, attendance_controller_1.markAbsent);
router.post("/warehouse/undo", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateUserDateAction, attendance_controller_1.undoAttendance);
router.post("/warehouse/remark", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateSetAttendanceRemark, attendance_controller_1.setAttendanceRemark);
router.get("/holidays", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateHolidaysQuery, attendance_controller_1.getHolidays);
router.post("/holidays", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateCreateHoliday, attendance_controller_1.createHoliday);
router.delete("/holidays/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_controller_1.deleteHoliday);
router.get("/profiles", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateProfilesQuery, attendance_controller_1.getProfiles);
router.put("/profiles/:userId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, attendance_middleware_1.validateUpdateProfile, attendance_controller_1.updateProfile);
exports.default = router;
//# sourceMappingURL=attendance.route.js.map