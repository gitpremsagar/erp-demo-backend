import express from "express";
import {
  createProductGroup,
  getProductGroups,
  getProductGroupById,
  updateProductGroup,
  deleteProductGroup,
  getProductGroupStats,
} from "../controller/productGroup.controller";
import {
  validateCreateProductGroup,
  validateUpdateProductGroup,
  validateProductGroupQuery,
} from "../middleware/productGroup.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new product group
router.post("/", requireAdmin, validateCreateProductGroup, createProductGroup);

// Get all product groups with pagination and filtering
router.get("/", validateProductGroupQuery, getProductGroups);

// Get product group statistics
router.get("/stats", getProductGroupStats);

// Get a single product group by ID
router.get("/:id", getProductGroupById);

// Update a product group
router.put("/:id", requireAdmin, validateUpdateProductGroup, updateProductGroup);

// Delete a product group
router.delete("/:id", requireAdmin, deleteProductGroup);

export default router;
