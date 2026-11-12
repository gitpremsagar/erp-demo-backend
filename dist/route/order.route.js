"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const order_controller_1 = require("../controller/order.controller");
const order_middleware_1 = require("../middleware/order.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const orderItem_controller_1 = require("../controller/orderItem.controller");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new order
router.post("/", auth_middleware_1.requireOrderCreator, order_middleware_1.validateCreateOrder, order_controller_1.createOrder);
// Create sales history (without stock operations)
router.post("/sales-history", order_middleware_1.validateCreateOrder, order_controller_1.createSalesHistory);
// Get all orders with pagination and filtering
router.get("/", order_middleware_1.validateOrderQuery, order_controller_1.getOrders);
// Get sales history (all orders except distributor drafts) with pagination and filtering
router.get("/sales-history", order_middleware_1.validateOrderQuery, order_controller_1.getSalesHistory);
// Get sales history for logged-in sales officer (only assigned distributors)
router.get("/sales-officer/sales-history", auth_middleware_1.validateAccessToken, auth_middleware_1.requireSalesOfficer, order_middleware_1.validateOrderQuery, order_controller_1.getSalesHistoryForSalesOfficer);
// Get all orders for logged-in sales officer (only assigned distributors)
router.get("/sales-officer/orders", auth_middleware_1.validateAccessToken, auth_middleware_1.requireSalesOfficer, order_middleware_1.validateOrderQuery, order_controller_1.getOrdersForSalesOfficer);
// Warehouse manager: in-flight orders only (excludes pending, modifying, completed)
router.get("/warehouse-manager/orders", auth_middleware_1.validateAccessToken, auth_middleware_1.requireWarehouseManager, order_middleware_1.validateOrderQuery, order_controller_1.getOrdersForWarehouseManager);
// Warehouse manager: orders board — only Finalized, Pending, Loading (OrderStatusType.name)
router.get("/warehouse-manager/orders/board", auth_middleware_1.validateAccessToken, auth_middleware_1.requireWarehouseManager, order_middleware_1.validateOrderQuery, order_controller_1.getWarehouseManagerOrdersForBoard);
// Warehouse manager: single order (same visibility rules as list)
router.get("/warehouse-manager/order/:orderId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireWarehouseManager, order_controller_1.getWarehouseManagerOrderById);
// Distributor: finalize draft order ("Send to SS") — must be registered before `GET /:orderId` patterns overlap by segment
router.patch("/:orderId/finalize-for-ss", auth_middleware_1.validateAccessToken, order_controller_1.finalizeDistributorOrder);
// Distributor: replace draft order line items (auth required; separate from admin PUT /:orderId)
router.patch("/:orderId/distributor-draft", auth_middleware_1.validateAccessToken, order_middleware_1.validateUpdateDistributorDraftOrder, order_controller_1.updateDistributorDraftOrder);
// Admin: replace line items before stock verification (no FIFO / no isVerifiedByAdmin change)
router.patch("/:orderId/admin-unverified", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateAdminUpdateUnverifiedOrder, order_controller_1.updateAdminUnverifiedOrder);
// Distributor: delete own draft order
router.delete("/:orderId/distributor-draft", auth_middleware_1.validateAccessToken, order_controller_1.deleteDistributorDraftOrder);
// Get a single order by ID
router.get("/:orderId", order_controller_1.getOrderById);
// Get a single order by driver ID
router.get("/driver/:driverId", order_controller_1.getOrdersByDriverId);
// Get orders by distributor ID (minimal info, no order details)
router.get("/distributor/:distributorId", order_controller_1.getOrdersByDistributorId);
// Get order statistics
router.get("/stats", order_controller_1.getOrderStats);
// Get order history by customer ID and product ID
router.get("/customer-product-order-history/:customerId/:productId", orderItem_controller_1.getCustomerProductOrderHistory);
// Get orders by original order ID
router.get("/original/:originalOrderId", order_middleware_1.validateOrderQuery, order_controller_1.getOrdersByOriginalOrderId);
// Update order's associated vehicle only (admin: assign or remove vehicle)
router.patch("/:orderId/vehicle", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, order_middleware_1.validateUpdateOrderVehicle, order_controller_1.updateOrderVehicle);
// Update order's associated driver only (admin: assign or remove driver)
router.patch("/:orderId/driver", auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderDriver, order_controller_1.updateOrderDriver);
// Update order delivery date only. Body: { deliveryDate: string (ISO) | null } — null clears the field.
router.patch("/:orderId/delivery-date", auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderDeliveryDate, order_controller_1.updateOrderDeliveryDate);
// Update order status only (admin and warehouse manager)
router.patch("/:orderId/status", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, order_middleware_1.validateUpdateOrderStatus, order_controller_1.updateOrderStatus);
// Apply discount to order (admin only). Body: { discountPercent: number } (0–100).
router.patch("/:orderId/discount", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateApplyOrderDiscount, order_controller_1.applyOrderDiscount);
// Get active schemes for all products in an order
router.get("/:orderId/schemes", order_controller_1.getOrderSchemes);
// Apply scheme discount to a specific order item
router.patch("/:orderId/items/:itemId/scheme-discount", auth_middleware_1.requireAdmin, order_controller_1.applyItemSchemeDiscount);
// Apply admin item discount to a specific order item
router.patch("/:orderId/items/:itemId/item-discount", auth_middleware_1.requireAdmin, order_controller_1.applyItemDiscount);
// Apply or remove festive price on a specific order item
router.patch("/:orderId/items/:itemId/festive-price", auth_middleware_1.requireAdmin, order_controller_1.applyItemFestivePrice);
// Apply cash discount to order. Body: { cashDiscountPercent: 0 | >0–100 }
router.patch("/:orderId/cash-discount", auth_middleware_1.requireAdmin, order_controller_1.applyCashDiscount);
// Persist ledger balance adjustment for invoice value. Body: { ledgerBalance: number | null }
router.patch("/:orderId/ledger-balance", auth_middleware_1.requireAdmin, order_controller_1.applyLedgerBalance);
// Admin-only: set or clear order narration. Body: { narration: string | null }
router.patch("/:orderId/narration", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderNarration, order_controller_1.updateOrderNarration);
// Admin-only: set or clear Tally invoice ID. Body: { tallyInvoiceId: string | null }
router.patch("/:orderId/tally-invoice", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderTallyInvoice, order_controller_1.updateOrderTallyInvoice);
router.patch("/:orderId/excel-meta", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderExcelMeta, order_controller_1.updateOrderExcelMeta);
// Admin-only: update receiving status on sales history orders.
router.patch("/:orderId/receiving-status", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrderReceivingStatus, order_controller_1.updateOrderReceivingStatus);
// Update an order
router.put("/:orderId", auth_middleware_1.requireAdmin, order_middleware_1.validateUpdateOrder, order_controller_1.updateOrder);
// Verify order for stock (admin only) - deducts stock for orders created by sales officers/distributors
router.post("/:orderId/verify-stock", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_controller_1.verifyOrderForStock);
// Delete an order
router.delete("/:orderId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, order_controller_1.deleteOrder);
exports.default = router;
//# sourceMappingURL=order.route.js.map