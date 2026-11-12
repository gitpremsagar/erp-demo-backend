import express from "express";
import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  getEmployeeMonthlyAttendance,
  getProfiles,
  getWarehouseDailySheet,
  getWarehouseMonthlyAttendance,
  markAbsent,
  punchIn,
  punchOut,
  undoAttendance,
  setAttendanceRemark,
  updateProfile,
  updateMonthlyPayroll,
  createSalaryAdvance,
  deleteSalaryAdvance,
} from "./attendance.controller";
import {
  validateCreateHoliday,
  validateHolidaysQuery,
  validateMonthlyParams,
  validateWarehouseMonthlyParams,
  validateUpdateMonthlyPayroll,
  validateCreateSalaryAdvance,
  validateDeleteSalaryAdvance,
  validateProfilesQuery,
  validatePunchAction,
  validateUpdateProfile,
  validateUserDateAction,
  validateSetAttendanceRemark,
} from "./attendance.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.get(
  "/warehouse/daily/:date",
  validateAccessToken,
  requireAdmin,
  getWarehouseDailySheet
);

router.get(
  "/warehouse/monthly/:year/:month",
  validateAccessToken,
  requireAdmin,
  validateWarehouseMonthlyParams,
  getWarehouseMonthlyAttendance
);

router.put(
  "/warehouse/monthly/:year/:month/payroll/:userId",
  validateAccessToken,
  requireAdmin,
  validateUpdateMonthlyPayroll,
  updateMonthlyPayroll
);

router.post(
  "/warehouse/advances",
  validateAccessToken,
  requireAdmin,
  validateCreateSalaryAdvance,
  createSalaryAdvance
);

router.delete(
  "/warehouse/advances/:id",
  validateAccessToken,
  requireAdmin,
  validateDeleteSalaryAdvance,
  deleteSalaryAdvance
);

router.get(
  "/warehouse/employee/:userId/monthly/:year/:month",
  validateAccessToken,
  requireAdmin,
  validateMonthlyParams,
  getEmployeeMonthlyAttendance
);

router.post(
  "/warehouse/punch-in",
  validateAccessToken,
  requireAdmin,
  validatePunchAction,
  punchIn
);

router.post(
  "/warehouse/punch-out",
  validateAccessToken,
  requireAdmin,
  validatePunchAction,
  punchOut
);

router.post(
  "/warehouse/mark-absent",
  validateAccessToken,
  requireAdmin,
  validateUserDateAction,
  markAbsent
);

router.post(
  "/warehouse/undo",
  validateAccessToken,
  requireAdmin,
  validateUserDateAction,
  undoAttendance
);

router.post(
  "/warehouse/remark",
  validateAccessToken,
  requireAdmin,
  validateSetAttendanceRemark,
  setAttendanceRemark
);

router.get(
  "/holidays",
  validateAccessToken,
  requireAdmin,
  validateHolidaysQuery,
  getHolidays
);

router.post(
  "/holidays",
  validateAccessToken,
  requireAdmin,
  validateCreateHoliday,
  createHoliday
);

router.delete(
  "/holidays/:id",
  validateAccessToken,
  requireAdmin,
  deleteHoliday
);

router.get(
  "/profiles",
  validateAccessToken,
  requireAdmin,
  validateProfilesQuery,
  getProfiles
);

router.put(
  "/profiles/:userId",
  validateAccessToken,
  requireAdmin,
  validateUpdateProfile,
  updateProfile
);

export default router;
