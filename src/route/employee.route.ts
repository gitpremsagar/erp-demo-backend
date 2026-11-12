import express from "express";
import {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  getEmployeeStats,
} from "../controller/employee.controller";
import {
  validateCreateEmployee,
  validateUpdateEmployee,
  validateEmployeeQuery,
} from "../middleware/employee.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOnly,
  requireSuperAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Create a new employee (admin/super-admin only; only super-admin can set userType ADMIN)
router.post(
  "/",
  validateAccessToken,
  requireAdminOnly,
  validateCreateEmployee,
  createEmployee
);

// Get all employees with pagination and search (MIS allowed for driver lookups)
router.get(
  "/",
  validateAccessToken,
  requireAdmin,
  validateEmployeeQuery,
  getEmployees
);

// Get employee statistics (admin management UI only)
router.get("/stats", validateAccessToken, requireAdminOnly, getEmployeeStats);

// Get a single employee by ID (MIS allowed for lookups)
router.get("/:id", validateAccessToken, requireAdmin, getEmployeeById);

// Update an employee (admin/super-admin only; only SUPER_ADMIN can set userType to ADMIN)
router.put(
  "/:id",
  validateAccessToken,
  requireAdminOnly,
  validateUpdateEmployee,
  updateEmployee
);

// Delete an employee (super-admin only)
router.delete("/:id", validateAccessToken, requireSuperAdmin, deleteEmployee);

export default router;
