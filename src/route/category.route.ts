import express from "express";
import {
  // Category controllers
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controller/category.controller";
import {
  // Category middleware
  validateCreateCategory,
  validateUpdateCategory,
} from "../middleware/category.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Category routes
router.post("/", requireAdmin, validateCreateCategory, createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.put("/:id", requireAdmin, validateUpdateCategory, updateCategory);
router.delete("/:id", requireAdmin, deleteCategory);

export default router;
