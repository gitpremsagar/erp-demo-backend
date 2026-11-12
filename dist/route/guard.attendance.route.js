"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const attendance_controller_1 = require("../module/attendance/attendance.controller");
const attendance_middleware_1 = require("../module/attendance/attendance.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/daily/:date", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_controller_1.getWarehouseDailySheet);
router.get("/monthly/:year/:month", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_middleware_1.validateWarehouseMonthlyParams, attendance_controller_1.getWarehouseMonthlyAttendance);
router.post("/punch-in", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_middleware_1.validatePunchAction, attendance_controller_1.punchIn);
router.post("/punch-out", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_middleware_1.validatePunchAction, attendance_controller_1.punchOut);
router.post("/mark-absent", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_middleware_1.validateUserDateAction, attendance_controller_1.markAbsent);
router.post("/undo", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, attendance_middleware_1.validateUserDateAction, attendance_controller_1.undoAttendance);
exports.default = router;
//# sourceMappingURL=guard.attendance.route.js.map