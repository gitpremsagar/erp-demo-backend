"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const employee_controller_1 = require("../controller/employee.controller");
const employee_middleware_1 = require("../middleware/employee.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Create a new employee (admin/super-admin only; only super-admin can set userType ADMIN)
router.post("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOnly, employee_middleware_1.validateCreateEmployee, employee_controller_1.createEmployee);
// Get all employees with pagination and search (MIS allowed for driver lookups)
router.get("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, employee_middleware_1.validateEmployeeQuery, employee_controller_1.getEmployees);
// Get employee statistics (admin management UI only)
router.get("/stats", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOnly, employee_controller_1.getEmployeeStats);
// Get a single employee by ID (MIS allowed for lookups)
router.get("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, employee_controller_1.getEmployeeById);
// Update an employee (admin/super-admin only; only SUPER_ADMIN can set userType to ADMIN)
router.put("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOnly, employee_middleware_1.validateUpdateEmployee, employee_controller_1.updateEmployee);
// Delete an employee (super-admin only)
router.delete("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireSuperAdmin, employee_controller_1.deleteEmployee);
exports.default = router;
//# sourceMappingURL=employee.route.js.map