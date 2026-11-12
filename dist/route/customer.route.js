"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const customer_controller_1 = require("../controller/customer.controller");
const customer_middleware_1 = require("../middleware/customer.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new customer
router.post("/", customer_middleware_1.validateCreateCustomer, customer_controller_1.createCustomer);
// Get all customers with pagination and search
router.get("/", auth_middleware_1.requireAdminOrWarehouseManager, customer_middleware_1.validateCustomerQuery, customer_controller_1.getCustomers);
// Get distributors assigned to a sales officer
router.get("/sales-officer/:salesOfficerId/assigned", customer_controller_1.getAssignedDistributors);
// Get assigned distributors with forecasts for a sales officer
router.get("/sales-officer/:salesOfficerId/assigned-with-forecasts", auth_middleware_1.requireSalesOfficer, customer_controller_1.getAssignedDistributorsWithForecast);
// Get all distributors with forecast
router.get("/distributors-with-forecasts", auth_middleware_1.requireAdmin, customer_controller_1.getDistributorsWithForecast);
// Get customer statistics
router.get("/stats", customer_controller_1.getCustomerStats);
// Get a single customer by ID
router.get("/:id", customer_controller_1.getCustomerById);
// Update own profile (for logged-in customers/distributors)
router.put("/me", customer_middleware_1.validateUpdateCustomer, customer_controller_1.updateOwnCustomer);
// Update a customer
router.put("/:id", auth_middleware_1.requireAdmin, customer_middleware_1.validateUpdateCustomer, customer_controller_1.updateCustomer);
// Delete all customers and customer details
// router.delete("/delete-all", deleteAllCustomers);
// Delete a customer
router.delete("/:id", auth_middleware_1.requireAdmin, customer_controller_1.deleteCustomer);
exports.default = router;
//# sourceMappingURL=customer.route.js.map