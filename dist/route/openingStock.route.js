"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const openingStock_controller_1 = require("../controller/openingStock.controller");
const openingStockSnapshot_1 = require("../lib/openingStockSnapshot");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.get("/cron/record", async (req, res) => {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ message: "Unauthorized cron request" });
    }
    try {
        const { dates, productCount } = await (0, openingStockSnapshot_1.rebuildRecentOpeningStockSnapshots)();
        return res.json({
            message: "Opening stock recorded successfully",
            date: dates[dates.length - 1],
            dates,
            productCount,
        });
    }
    catch (error) {
        console.error("[Cron] Opening stock recording failed:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});
router.use(auth_middleware_1.validateAccessToken);
router.post("/record", auth_middleware_1.requireAdminOrWarehouseManager, openingStock_controller_1.recordCurrentStockWithDate);
router.get("/bulk-update-template", openingStock_controller_1.getBulkUpdateTemplate);
router.post("/bulk-update-fields", auth_middleware_1.requireAdminOrWarehouseManager, openingStock_controller_1.bulkUpdateOpeningStockFields);
router.patch("/daily-fields", auth_middleware_1.requireAdminOrWarehouseManager, openingStock_controller_1.upsertDailyStockFields);
router.get("/report/movements", openingStock_controller_1.getDailyStockMovements);
router.get("/report", openingStock_controller_1.getDailyStockReport);
exports.default = router;
//# sourceMappingURL=openingStock.route.js.map