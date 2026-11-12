import express from "express";
import {
  listProductAllocations,
  getProductAllocationById,
  getPartySheetPreview,
  getDueAllocation,
  createProductAllocation,
  updateProductAllocation,
  deleteProductAllocation,
  createFulfillment,
  updateFulfillment,
  deleteFulfillment,
} from "./product-allocation.controller";
import {
  validateCreateProductAllocation,
  validateUpdateProductAllocation,
  validateCreateFulfillment,
  validateUpdateFulfillment,
  validateProductAllocationQuery,
} from "./product-allocation.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOrWarehouseManager,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.get(
  "/",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  validateProductAllocationQuery,
  listProductAllocations
);

router.get(
  "/party-sheet",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  getPartySheetPreview
);

router.get(
  "/due",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  getDueAllocation
);

router.post(
  "/",
  validateAccessToken,
  requireAdmin,
  validateCreateProductAllocation,
  createProductAllocation
);

// Fulfillment routes before /:id to avoid path collision
router.patch(
  "/fulfillments/:fulfillmentId",
  validateAccessToken,
  requireAdmin,
  validateUpdateFulfillment,
  updateFulfillment
);

router.delete(
  "/fulfillments/:fulfillmentId",
  validateAccessToken,
  requireAdmin,
  deleteFulfillment
);

router.post(
  "/:id/lines/:lineId/fulfillments",
  validateAccessToken,
  requireAdmin,
  validateCreateFulfillment,
  createFulfillment
);

router.get(
  "/:id",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  getProductAllocationById
);

router.patch(
  "/:id",
  validateAccessToken,
  requireAdmin,
  validateUpdateProductAllocation,
  updateProductAllocation
);

router.delete(
  "/:id",
  validateAccessToken,
  requireAdmin,
  deleteProductAllocation
);

export default router;
