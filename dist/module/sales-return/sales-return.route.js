"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const sales_return_controller_1 = require("./sales-return.controller");
const sales_return_middleware_1 = require("./sales-return.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.post("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, sales_return_middleware_1.validateCreateSalesReturn, sales_return_controller_1.createSalesReturn);
router.get("/", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, sales_return_controller_1.getSalesReturns);
router.get("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager, sales_return_controller_1.getSalesReturnById);
router.patch("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, sales_return_middleware_1.validateUpdateSalesReturn, sales_return_controller_1.updateSalesReturn);
router.delete("/:id", auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin, sales_return_controller_1.deleteSalesReturn);
exports.default = router;
//# sourceMappingURL=sales-return.route.js.map