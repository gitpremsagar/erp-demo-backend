"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchasingOrder_controller_1 = require("../controller/purchasingOrder.controller");
const router = express_1.default.Router();
// Protected routes - require authentication
// router.use(validateAccessToken);
// Create a new purchasing order
router.post("/", purchasingOrder_controller_1.createPurchasingOrder);
// Get all purchasing orders with pagination and filtering
router.get("/", purchasingOrder_controller_1.getPurchasingOrders);
// Get purchasing order statistics
router.get("/stats", purchasingOrder_controller_1.getPurchasingOrderStats);
// Get a single purchasing order by ID
router.get("/:id", purchasingOrder_controller_1.getPurchasingOrderById);
// Update a purchasing order
router.put("/:id", purchasingOrder_controller_1.updatePurchasingOrder);
// Delete a purchasing order
router.delete("/:id", purchasingOrder_controller_1.deletePurchasingOrder);
exports.default = router;
//# sourceMappingURL=purchasingOrder.route.js.map