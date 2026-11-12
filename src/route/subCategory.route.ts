import express from "express";
import {
  createSubCategory,
  getSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} from "../controller/subCategory.controller";
import {
  validateCreateSubCategory,
  validateUpdateSubCategory,
} from "../middleware/subCategory.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken);

router.post("/", requireAdmin, validateCreateSubCategory, createSubCategory);
router.get("/", getSubCategories);
router.get("/:id", getSubCategoryById);
router.put("/:id", requireAdmin, validateUpdateSubCategory, updateSubCategory);
router.delete("/:id", requireAdmin, deleteSubCategory);

export default router;
