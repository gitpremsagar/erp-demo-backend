"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const product_allocation_controller_1 = require("./product-allocation.controller");
const product_allocation_middleware_1 = require("./product-allocation.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, product_allocation_middleware_1.validateProductAllocationQuery, product_allocation_controller_1.listProductAllocations);
router.get("/party-sheet", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, product_allocation_controller_1.getPartySheetPreview);
router.get("/due", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, product_allocation_controller_1.getDueAllocation);
router.post("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_middleware_1.validateCreateProductAllocation, product_allocation_controller_1.createProductAllocation);
// Fulfillment routes before /:id to avoid path collision
router.patch("/fulfillments/:fulfillmentId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_middleware_1.validateUpdateFulfillment, product_allocation_controller_1.updateFulfillment);
router.delete("/fulfillments/:fulfillmentId", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_controller_1.deleteFulfillment);
router.post("/:id/lines/:lineId/fulfillments", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_middleware_1.validateCreateFulfillment, product_allocation_controller_1.createFulfillment);
router.get("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, product_allocation_controller_1.getProductAllocationById);
router.patch("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_middleware_1.validateUpdateProductAllocation, product_allocation_controller_1.updateProductAllocation);
router.delete("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, product_allocation_controller_1.deleteProductAllocation);
exports.default = router;
//# sourceMappingURL=product-allocation.route.js.map