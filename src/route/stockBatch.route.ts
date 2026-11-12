import express from "express";
import {
  createStockBatch,
  getStockBatches,
  getStockBatchById,
  getStockBatchesByProductId,
  updateStockBatch,
  deleteStockBatch,
  toggleStockArchive,
  getStockStats,
  getStockAlerts,
  reconcileProductQuantity,
} from "../controller/stockBatch.controller";
import {
  validateCreateStockBatch,
  validateUpdateStockBatch,
  validateStockBatchQuery,
  validateToggleArchive,
  validateProductId,
} from "../middleware/stockBatch.middleware";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new stock entry
router.post("/", requireAdminOrWarehouseManager, validateCreateStockBatch, createStockBatch);

// Get all stock entries with pagination and filtering
router.get("/", validateStockBatchQuery, getStockBatches);

// Get stock batches by product ID
router.get("/product/:productId", validateProductId, getStockBatchesByProductId);

// Get stock statistics
router.get("/stats", getStockStats);

// Get stock alerts (expired, low stock, etc.)
router.get("/alerts", getStockAlerts);

// Reconcile total product quantity (admin Excel cross-check)
router.post(
  "/reconcile-product-quantity",
  requireAdminOrWarehouseManager,
  reconcileProductQuantity
);

// Get a single stock entry by ID
router.get("/:id", getStockBatchById);

// Update a stock entry
router.put("/:id", requireAdminOrWarehouseManager, validateUpdateStockBatch, updateStockBatch);

// Archive/Unarchive stock
router.patch(
  "/:id/archive",
  requireAdminOrWarehouseManager,
  validateToggleArchive,
  toggleStockArchive
);

// Delete a stock entry
router.delete("/:id", requireAdminOrWarehouseManager, deleteStockBatch);

export default router;
