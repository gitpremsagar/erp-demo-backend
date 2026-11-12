import express from "express";
import {
  getGuardDrivers,
  getGuardOrders,
  getGuardPurchases,
  updateGuardOrderDriver,
  updateGuardOrderStatus,
  updateGuardPurchaseStatus,
} from "../controller/guard.controller";
import { requireGuard, validateAccessToken } from "../middleware/auth.middleware";
import {
  validateGuardOrderDriverUpdate,
  validateGuardOrderStatusUpdate,
  validateGuardPurchaseStatusUpdate,
} from "../middleware/guard.middleware";

const router = express.Router();

router.get("/purchases", validateAccessToken, requireGuard, getGuardPurchases);
router.patch(
  "/purchases/:id/status",
  validateAccessToken,
  requireGuard,
  validateGuardPurchaseStatusUpdate,
  updateGuardPurchaseStatus
);
router.get("/orders", validateAccessToken, requireGuard, getGuardOrders);
router.get("/drivers", validateAccessToken, requireGuard, getGuardDrivers);
router.patch(
  "/orders/:id/driver",
  validateAccessToken,
  requireGuard,
  validateGuardOrderDriverUpdate,
  updateGuardOrderDriver
);
router.patch(
  "/orders/:id/status",
  validateAccessToken,
  requireGuard,
  validateGuardOrderStatusUpdate,
  updateGuardOrderStatus
);

export default router;
