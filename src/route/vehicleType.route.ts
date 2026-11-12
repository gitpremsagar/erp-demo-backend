import express from "express";
import {
  createVehicleType,
  getVehicleTypes,
  getVehicleTypeById,
  updateVehicleType,
  deleteVehicleType,
} from "../controller/vehicleType.controller";
import {
  validateCreateVehicleType,
  validateUpdateVehicleType,
} from "../middleware/vehicleType.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken);

router.post("/", requireAdmin, validateCreateVehicleType, createVehicleType);
router.get("/", getVehicleTypes);
router.get("/:id", getVehicleTypeById);
router.put("/:id", requireAdmin, validateUpdateVehicleType, updateVehicleType);
router.delete("/:id", requireAdmin, deleteVehicleType);

export default router;
