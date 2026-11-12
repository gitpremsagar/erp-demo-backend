"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const salesOfficer_controller_1 = require("../controller/salesOfficer.controller");
const salesOfficer_middleware_1 = require("../middleware/salesOfficer.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOnly);
// Create a new sales officer
router.post("/", salesOfficer_middleware_1.validateCreateSalesOfficer, salesOfficer_controller_1.createSalesOfficer);
// Get all sales officers
router.get("/", salesOfficer_controller_1.getAllSalesOfficers);
// Assign distributor to sales officer (before /:id)
router.post("/assign", salesOfficer_middleware_1.validateAssignDistributor, salesOfficer_controller_1.assignDistributorToSalesOfficer);
// Remove distributor from sales officer
router.delete("/assignment/:id", salesOfficer_controller_1.removeDistributorFromSalesOfficer);
// Get sales officer by ID
router.get("/:id", salesOfficer_controller_1.getSalesOfficerById);
// Update sales officer
router.put("/:id", salesOfficer_middleware_1.validateUpdateSalesOfficer, salesOfficer_controller_1.updateSalesOfficer);
// Delete sales officer
router.delete("/:id", salesOfficer_controller_1.deleteSalesOfficer);
// Get assigned distributors for a sales officer
router.get("/:salesOfficerId/distributors", salesOfficer_controller_1.getAssignedDistributors);
// Get sales officer stats
router.get("/:salesOfficerId/stats", salesOfficer_controller_1.getSalesOfficerStats);
exports.default = router;
//# sourceMappingURL=salesOfficer.route.js.map