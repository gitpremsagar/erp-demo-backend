import express from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateOwnCustomer,
  deleteCustomer,
  getCustomerStats,
  getDistributorsWithForecast,
  deleteAllCustomers,
  getAssignedDistributors,
  getAssignedDistributorsWithForecast,
} from "../controller/customer.controller";
import {
  validateCreateCustomer,
  validateUpdateCustomer,
  validateCustomerQuery,
} from "../middleware/customer.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOrWarehouseManager,
  requireSalesOfficer,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new customer
router.post("/", validateCreateCustomer, createCustomer);

// Get all customers with pagination and search
router.get(
  "/",
  requireAdminOrWarehouseManager,
  validateCustomerQuery,
  getCustomers
);

// Get distributors assigned to a sales officer
router.get("/sales-officer/:salesOfficerId/assigned", getAssignedDistributors);

// Get assigned distributors with forecasts for a sales officer
router.get(
  "/sales-officer/:salesOfficerId/assigned-with-forecasts",
  requireSalesOfficer,
  getAssignedDistributorsWithForecast
);

// Get all distributors with forecast
router.get("/distributors-with-forecasts", requireAdmin, getDistributorsWithForecast);

// Get customer statistics
router.get("/stats", getCustomerStats);

// Get a single customer by ID
router.get("/:id", getCustomerById);

// Update own profile (for logged-in customers/distributors)
router.put("/me", validateUpdateCustomer, updateOwnCustomer);

// Update a customer
router.put("/:id", requireAdmin, validateUpdateCustomer, updateCustomer);

// Delete all customers and customer details
// router.delete("/delete-all", deleteAllCustomers);

// Delete a customer
router.delete("/:id", requireAdmin, deleteCustomer);

export default router;
