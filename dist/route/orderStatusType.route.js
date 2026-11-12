"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderStatusType_controller_1 = require("../controller/orderStatusType.controller");
const orderStatusType_middleware_1 = require("../middleware/orderStatusType.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken);
router.post("/", auth_middleware_1.requireAdmin, orderStatusType_middleware_1.validateCreateOrderStatusType, orderStatusType_controller_1.createOrderStatusType);
router.get("/", orderStatusType_controller_1.getOrderStatusTypes);
router.get("/:id", orderStatusType_controller_1.getOrderStatusTypeById);
router.put("/:id", auth_middleware_1.requireAdmin, orderStatusType_middleware_1.validateUpdateOrderStatusType, orderStatusType_controller_1.updateOrderStatusType);
// deleting order status type is not allowed
// router.delete("/:id", deleteOrderStatusType);
exports.default = router;
//# sourceMappingURL=orderStatusType.route.js.map