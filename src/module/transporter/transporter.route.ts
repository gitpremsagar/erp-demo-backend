import express from "express";
import {
  createTransporter,
  getTransporters,
  getTransporterById,
  updateTransporter,
  deleteTransporter,
} from "./transporter.controller";
import {
  validateCreateTransporter,
  validateUpdateTransporter,
} from "./transporter.middleware";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdminOrWarehouseManager);

router.post("/", validateCreateTransporter, createTransporter);
router.get("/", getTransporters);
router.get("/:id", getTransporterById);
router.put("/:id", validateUpdateTransporter, updateTransporter);
router.delete("/:id", deleteTransporter);

export default router;
