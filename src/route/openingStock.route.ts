import express from "express";
import {
  bulkUpdateOpeningStockFields,
  getBulkUpdateTemplate,
  getDailyStockReport,
  getDailyStockMovements,
  recordCurrentStockWithDate,
  upsertDailyStockFields,
} from "../controller/openingStock.controller";
import { rebuildRecentOpeningStockSnapshots } from "../lib/openingStockSnapshot";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
} from "../middleware/auth.middleware";

const router = express.Router();

router.get("/cron/record", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized cron request" });
  }

  try {
    const { dates, productCount } = await rebuildRecentOpeningStockSnapshots();
    return res.json({
      message: "Opening stock recorded successfully",
      date: dates[dates.length - 1],
      dates,
      productCount,
    });
  } catch (error) {
    console.error("[Cron] Opening stock recording failed:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.use(validateAccessToken);

router.post("/record", requireAdminOrWarehouseManager, recordCurrentStockWithDate);
router.get("/bulk-update-template", getBulkUpdateTemplate);
router.post(
  "/bulk-update-fields",
  requireAdminOrWarehouseManager,
  bulkUpdateOpeningStockFields
);
router.patch(
  "/daily-fields",
  requireAdminOrWarehouseManager,
  upsertDailyStockFields
);
router.get("/report/movements", getDailyStockMovements);
router.get("/report", getDailyStockReport);

export default router;
