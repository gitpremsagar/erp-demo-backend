import express from "express";
import {
  getWarehouseDailySheet,
  getWarehouseMonthlyAttendance,
  markAbsent,
  punchIn,
  punchOut,
  undoAttendance,
} from "../module/attendance/attendance.controller";
import {
  validatePunchAction,
  validateUserDateAction,
  validateWarehouseMonthlyParams,
} from "../module/attendance/attendance.middleware";
import { requireGuard, validateAccessToken } from "../middleware/auth.middleware";

const router = express.Router();

router.get(
  "/daily/:date",
  validateAccessToken,
  requireGuard,
  getWarehouseDailySheet
);

router.get(
  "/monthly/:year/:month",
  validateAccessToken,
  requireGuard,
  validateWarehouseMonthlyParams,
  getWarehouseMonthlyAttendance
);

router.post(
  "/punch-in",
  validateAccessToken,
  requireGuard,
  validatePunchAction,
  punchIn
);

router.post(
  "/punch-out",
  validateAccessToken,
  requireGuard,
  validatePunchAction,
  punchOut
);

router.post(
  "/mark-absent",
  validateAccessToken,
  requireGuard,
  validateUserDateAction,
  markAbsent
);

router.post(
  "/undo",
  validateAccessToken,
  requireGuard,
  validateUserDateAction,
  undoAttendance
);

export default router;
