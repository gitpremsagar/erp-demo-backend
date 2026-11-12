"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const guard_controller_1 = require("../controller/guard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const guard_middleware_1 = require("../middleware/guard.middleware");
const router = express_1.default.Router();
router.get("/purchases", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_controller_1.getGuardPurchases);
router.patch("/purchases/:id/status", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_middleware_1.validateGuardPurchaseStatusUpdate, guard_controller_1.updateGuardPurchaseStatus);
router.get("/orders", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_controller_1.getGuardOrders);
router.get("/drivers", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_controller_1.getGuardDrivers);
router.patch("/orders/:id/driver", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_middleware_1.validateGuardOrderDriverUpdate, guard_controller_1.updateGuardOrderDriver);
router.patch("/orders/:id/status", auth_middleware_1.validateAccessToken, auth_middleware_1.requireGuard, guard_middleware_1.validateGuardOrderStatusUpdate, guard_controller_1.updateGuardOrderStatus);
exports.default = router;
//# sourceMappingURL=guard.route.js.map