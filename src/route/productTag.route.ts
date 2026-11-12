import express from "express";
import {
  createProductTag,
  getProductTags,
  getProductTagById,
  updateProductTag,
  deleteProductTag,
  getProductTagStats,
} from "../controller/productTag.controller";
import {
  validateCreateProductTag,
  validateUpdateProductTag,
  validateProductTagQuery,
} from "../middleware/productTag.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new product tag
router.post("/", requireAdmin, validateCreateProductTag, createProductTag);

// Get all product tags with pagination and filtering
router.get("/", validateProductTagQuery, getProductTags);

// Get product tag statistics
router.get("/stats", getProductTagStats);

// Get a single product tag by ID
router.get("/:id", getProductTagById);

// Update a product tag
router.put("/:id", requireAdmin, validateUpdateProductTag, updateProductTag);

// Delete a product tag
router.delete("/:id", requireAdmin, deleteProductTag);

export default router;
