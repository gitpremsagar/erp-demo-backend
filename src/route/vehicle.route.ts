import express from "express";
import {
  // Vehicle controllers
  createVehicle,
  getVehicles,
  getFuelConsumptionReport,
  getFuelConsumptionOrders,
  updateFuelConsumptionEntry,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from "../controller/vehicle.controller";
import {
  // Vehicle middleware
  validateCreateVehicle,
  validateUpdateVehicle,
} from "../middleware/vehicle.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Vehicle routes
router.post("/", requireAdmin, validateCreateVehicle, createVehicle);
router.get("/", getVehicles);
router.get("/reports/fuel-consumption", getFuelConsumptionReport);
router.get("/reports/fuel-consumption/orders", getFuelConsumptionOrders);
router.patch(
  "/reports/fuel-consumption/entry",
  requireAdmin,
  updateFuelConsumptionEntry
);
router.get("/:id", getVehicleById);
router.put("/:id", requireAdmin, validateUpdateVehicle, updateVehicle);
router.delete("/:id", requireAdmin, deleteVehicle);

export default router;
