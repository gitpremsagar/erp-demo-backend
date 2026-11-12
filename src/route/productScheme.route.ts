import express from "express";
import {
  createProductScheme,
  getProductSchemes,
  getProductSchemeById,
  getActiveSchemesByProduct,
  updateProductScheme,
  deleteProductScheme,
  toggleProductSchemeStatus,
} from "../controller/productScheme.controller";
import {
  validateCreateProductScheme,
  validateUpdateProductScheme,
  validateProductSchemeQuery,
  validateToggleStatus,
} from "../middleware/productScheme.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new product scheme
router.post("/", requireAdmin, validateCreateProductScheme, createProductScheme);

// Get all product schemes with pagination and filtering
router.get("/", validateProductSchemeQuery, getProductSchemes);

// Get active schemes for a specific product
router.get("/product/:productId/active", getActiveSchemesByProduct);

// Get a single product scheme by ID
router.get("/:id", getProductSchemeById);

// Update a product scheme
router.put("/:id", requireAdmin, validateUpdateProductScheme, updateProductScheme);

// Toggle product scheme status (activate/deactivate)
router.patch("/:id/toggle-status", requireAdmin, validateToggleStatus, toggleProductSchemeStatus);

// Delete a product scheme
router.delete("/:id", requireAdmin, deleteProductScheme);

export default router;
