import express from "express";
import {
  // Plant controllers
  createPlant,
  getPlants,
  getPlantById,
  updatePlant,
  deletePlant,
} from "../controller/plant.controller";
import {
  // Plant middleware
  validateCreatePlant,
  validateUpdatePlant,
} from "../middleware/plant.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Plant routes
router.post("/", requireAdmin, validateCreatePlant, createPlant);
router.get("/", getPlants);
router.get("/:id", getPlantById);
router.put("/:id", requireAdmin, validateUpdatePlant, updatePlant);
router.delete("/:id", requireAdmin, deletePlant);

export default router;
