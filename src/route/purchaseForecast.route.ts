import express from "express";
import {
  getMonthlyPurchaseForecast,
  getPurchaseForecastWorkbook,
  upsertMonthlyPurchaseForecast,
} from "../controller/purchaseForecast.controller";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken);

router.get("/monthly", getMonthlyPurchaseForecast);
router.get("/workbook", getPurchaseForecastWorkbook);
router.patch(
  "/monthly",
  requireAdminOrWarehouseManager,
  upsertMonthlyPurchaseForecast
);

export default router;
