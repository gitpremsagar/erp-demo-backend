"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchaseForecast_controller_1 = require("../controller/purchaseForecast.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken);
router.get("/monthly", purchaseForecast_controller_1.getMonthlyPurchaseForecast);
router.get("/workbook", purchaseForecast_controller_1.getPurchaseForecastWorkbook);
router.patch("/monthly", auth_middleware_1.requireAdminOrWarehouseManager, purchaseForecast_controller_1.upsertMonthlyPurchaseForecast);
exports.default = router;
//# sourceMappingURL=purchaseForecast.route.js.map