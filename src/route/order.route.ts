import express from "express";
import {
  createOrder,
  createSalesHistory,
  getOrders,
  getOrdersForSalesOfficer,
  getSalesHistory,
  getSalesHistoryForSalesOfficer,
  getOrderById,
  getOrdersByOriginalOrderId,
  deleteOrder,
  getOrderStats,
  updateOrder,
  updateOrderVehicle,
  updateOrderDriver,
  updateOrderDeliveryDate,
  updateOrderStatus,
  applyOrderDiscount,
  getOrdersByDriverId,
  getOrdersByDistributorId,
  verifyOrderForStock,
  getOrderSchemes,
  applyItemSchemeDiscount,
  applyItemDiscount,
  applyItemFestivePrice,
  applyCashDiscount,
  applyLedgerBalance,
  updateOrderNarration,
  updateOrderTallyInvoice,
  updateOrderExcelMeta,
  updateOrderReceivingStatus,
  getOrdersForWarehouseManager,
  getWarehouseManagerOrdersForBoard,
  getWarehouseManagerOrderById,
  finalizeDistributorOrder,
  updateDistributorDraftOrder,
  updateAdminUnverifiedOrder,
  deleteDistributorDraftOrder,
} from "../controller/order.controller";
import {
  validateCreateOrder,
  validateUpdateOrder,
  validateUpdateOrderVehicle,
  validateUpdateOrderDriver,
  validateUpdateOrderDeliveryDate,
  validateUpdateOrderStatus,
  validateApplyOrderDiscount,
  validateUpdateOrderNarration,
  validateUpdateOrderTallyInvoice,
  validateUpdateOrderExcelMeta,
  validateUpdateOrderReceivingStatus,
  validateOrderQuery,
  validateUpdateDistributorDraftOrder,
  validateAdminUpdateUnverifiedOrder,
} from "../middleware/order.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOrWarehouseManager,
  requireOrderCreator,
  requireSalesOfficer,
  requireWarehouseManager,
} from "../middleware/auth.middleware";
import { getCustomerProductOrderHistory } from "../controller/orderItem.controller";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new order
router.post("/", requireOrderCreator, validateCreateOrder, createOrder);

// Create sales history (without stock operations)
router.post("/sales-history", validateCreateOrder, createSalesHistory);

// Get all orders with pagination and filtering
router.get("/", validateOrderQuery, getOrders);

// Get sales history (all orders except distributor drafts) with pagination and filtering
router.get("/sales-history", validateOrderQuery, getSalesHistory);

// Get sales history for logged-in sales officer (only assigned distributors)
router.get(
  "/sales-officer/sales-history",
  validateAccessToken,
  requireSalesOfficer,
  validateOrderQuery,
  getSalesHistoryForSalesOfficer
);

// Get all orders for logged-in sales officer (only assigned distributors)
router.get(
  "/sales-officer/orders",
  validateAccessToken,
  requireSalesOfficer,
  validateOrderQuery,
  getOrdersForSalesOfficer
);

// Warehouse manager: in-flight orders only (excludes pending, modifying, completed)
router.get(
  "/warehouse-manager/orders",
  validateAccessToken,
  requireWarehouseManager,
  validateOrderQuery,
  getOrdersForWarehouseManager
);

// Warehouse manager: orders board — only Finalized, Pending, Loading (OrderStatusType.name)
router.get(
  "/warehouse-manager/orders/board",
  validateAccessToken,
  requireWarehouseManager,
  validateOrderQuery,
  getWarehouseManagerOrdersForBoard
);

// Warehouse manager: single order (same visibility rules as list)
router.get(
  "/warehouse-manager/order/:orderId",
  validateAccessToken,
  requireWarehouseManager,
  getWarehouseManagerOrderById
);

// Distributor: finalize draft order ("Send to SS") — must be registered before `GET /:orderId` patterns overlap by segment
router.patch(
  "/:orderId/finalize-for-ss",
  validateAccessToken,
  finalizeDistributorOrder
);

// Distributor: replace draft order line items (auth required; separate from admin PUT /:orderId)
router.patch(
  "/:orderId/distributor-draft",
  validateAccessToken,
  validateUpdateDistributorDraftOrder,
  updateDistributorDraftOrder
);

// Admin: replace line items before stock verification (no FIFO / no isVerifiedByAdmin change)
router.patch(
  "/:orderId/admin-unverified",
  validateAccessToken,
  requireAdmin,
  validateAdminUpdateUnverifiedOrder,
  updateAdminUnverifiedOrder
);

// Distributor: delete own draft order
router.delete(
  "/:orderId/distributor-draft",
  validateAccessToken,
  deleteDistributorDraftOrder
);

// Get a single order by ID
router.get("/:orderId", getOrderById);

// Get a single order by driver ID
router.get("/driver/:driverId", getOrdersByDriverId);

// Get orders by distributor ID (minimal info, no order details)
router.get("/distributor/:distributorId", getOrdersByDistributorId);

// Get order statistics
router.get("/stats", getOrderStats);

// Get order history by customer ID and product ID
router.get("/customer-product-order-history/:customerId/:productId", getCustomerProductOrderHistory);

// Get orders by original order ID
router.get("/original/:originalOrderId", validateOrderQuery, getOrdersByOriginalOrderId);

// Update order's associated vehicle only (admin: assign or remove vehicle)
router.patch(
  "/:orderId/vehicle",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  validateUpdateOrderVehicle,
  updateOrderVehicle
);

// Update order's associated driver only (admin: assign or remove driver)
router.patch(
  "/:orderId/driver",
  requireAdmin,
  validateUpdateOrderDriver,
  updateOrderDriver
);

// Update order delivery date only. Body: { deliveryDate: string (ISO) | null } — null clears the field.
router.patch(
  "/:orderId/delivery-date",
  requireAdmin,
  validateUpdateOrderDeliveryDate,
  updateOrderDeliveryDate
);

// Update order status only (admin and warehouse manager)
router.patch(
  "/:orderId/status",
  validateAccessToken,
  requireAdminOrWarehouseManager,
  validateUpdateOrderStatus,
  updateOrderStatus
);

// Apply discount to order (admin only). Body: { discountPercent: number } (0–100).
router.patch(
  "/:orderId/discount",
  validateAccessToken,
  requireAdmin,
  validateApplyOrderDiscount,
  applyOrderDiscount
);

// Get active schemes for all products in an order
router.get("/:orderId/schemes", getOrderSchemes);

// Apply scheme discount to a specific order item
router.patch(
  "/:orderId/items/:itemId/scheme-discount",
  requireAdmin,
  applyItemSchemeDiscount
);

// Apply admin item discount to a specific order item
router.patch(
  "/:orderId/items/:itemId/item-discount",
  requireAdmin,
  applyItemDiscount
);

// Apply or remove festive price on a specific order item
router.patch(
  "/:orderId/items/:itemId/festive-price",
  requireAdmin,
  applyItemFestivePrice
);

// Apply cash discount to order. Body: { cashDiscountPercent: 0 | >0–100 }
router.patch("/:orderId/cash-discount", requireAdmin, applyCashDiscount);

// Persist ledger balance adjustment for invoice value. Body: { ledgerBalance: number | null }
router.patch("/:orderId/ledger-balance", requireAdmin, applyLedgerBalance);

// Admin-only: set or clear order narration. Body: { narration: string | null }
router.patch(
  "/:orderId/narration",
  validateAccessToken,
  requireAdmin,
  validateUpdateOrderNarration,
  updateOrderNarration
);

// Admin-only: set or clear Tally invoice ID. Body: { tallyInvoiceId: string | null }
router.patch(
  "/:orderId/tally-invoice",
  validateAccessToken,
  requireAdmin,
  validateUpdateOrderTallyInvoice,
  updateOrderTallyInvoice
);

router.patch(
  "/:orderId/excel-meta",
  validateAccessToken,
  requireAdmin,
  validateUpdateOrderExcelMeta,
  updateOrderExcelMeta
);

// Admin-only: update receiving status on sales history orders.
router.patch(
  "/:orderId/receiving-status",
  validateAccessToken,
  requireAdmin,
  validateUpdateOrderReceivingStatus,
  updateOrderReceivingStatus
);

// Update an order
router.put("/:orderId", requireAdmin, validateUpdateOrder, updateOrder);

// Verify order for stock (admin only) - deducts stock for orders created by sales officers/distributors
router.post(
  "/:orderId/verify-stock",
  validateAccessToken,
  requireAdmin,
  verifyOrderForStock
);

// Delete an order
router.delete("/:orderId",validateAccessToken, requireAdmin, deleteOrder);

export default router;
