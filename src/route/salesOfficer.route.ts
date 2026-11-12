import express from "express";
import {
  createSalesOfficer,
  getAllSalesOfficers,
  getSalesOfficerById,
  updateSalesOfficer,
  deleteSalesOfficer,
  assignDistributorToSalesOfficer,
  removeDistributorFromSalesOfficer,
  getAssignedDistributors,
  getSalesOfficerStats,
} from "../controller/salesOfficer.controller";
import {
  validateCreateSalesOfficer,
  validateUpdateSalesOfficer,
  validateAssignDistributor,
} from "../middleware/salesOfficer.middleware";
import {
  validateAccessToken,
  requireAdminOnly,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdminOnly);

// Create a new sales officer
router.post("/", validateCreateSalesOfficer, createSalesOfficer);

// Get all sales officers
router.get("/", getAllSalesOfficers);

// Assign distributor to sales officer (before /:id)
router.post(
  "/assign",
  validateAssignDistributor,
  assignDistributorToSalesOfficer
);

// Remove distributor from sales officer
router.delete("/assignment/:id", removeDistributorFromSalesOfficer);

// Get sales officer by ID
router.get("/:id", getSalesOfficerById);

// Update sales officer
router.put("/:id", validateUpdateSalesOfficer, updateSalesOfficer);

// Delete sales officer
router.delete("/:id", deleteSalesOfficer);

// Get assigned distributors for a sales officer
router.get("/:salesOfficerId/distributors", getAssignedDistributors);

// Get sales officer stats
router.get("/:salesOfficerId/stats", getSalesOfficerStats);

export default router;
