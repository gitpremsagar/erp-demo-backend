import express from "express";
import {
  createPurchase,
  createPurchasesBulk,
  getPurchases,
  getActivePurchases,
  getWarehouseManagerPurchases,
  getPurchaseById,
  updatePurchase,
  updatePurchaseStatus,
  updatePurchaseManualDatetimes,
  updatePurchaseGrn,
  updatePurchaseTargetUnloading,
  addPurchaseToStock,
  deletePurchase,
  syncPurchasePricing,
} from "./purchase.controller";
import {
  validateCreatePurchase,
  validateCreatePurchasesBulk,
  validateUpdatePurchase,
  validateUpdatePurchaseStatus,
  validateUpdatePurchaseManualDatetimes,
  validateUpdatePurchaseGrn,
  validateUpdatePurchaseTargetUnloading,
} from "./purchase.middleware";
import {
  validateAccessToken,
  requireAdminOrWarehouseOrPurchaser,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdminOrWarehouseOrPurchaser);

router.post("/", validateCreatePurchase, createPurchase);
router.post("/bulk", validateCreatePurchasesBulk, createPurchasesBulk);
router.get("/", getPurchases);
router.get("/active", getActivePurchases);
router.get("/warehouse-manager", getWarehouseManagerPurchases);
router.get("/:id", getPurchaseById);
router.put("/:id", validateUpdatePurchase, updatePurchase);
router.patch("/:id/status", validateUpdatePurchaseStatus, updatePurchaseStatus);
router.patch(
  "/:id/manual-datetimes",
  validateUpdatePurchaseManualDatetimes,
  updatePurchaseManualDatetimes
);
router.patch("/:id/grn", validateUpdatePurchaseGrn, updatePurchaseGrn);
router.patch(
  "/:id/target-unloading",
  validateUpdatePurchaseTargetUnloading,
  updatePurchaseTargetUnloading
);
router.post("/:id/add-to-stock", addPurchaseToStock);
router.post("/:id/sync-pricing", syncPurchasePricing);
router.delete("/:id", deletePurchase);

export default router;
