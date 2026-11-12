import express from "express";
import {
  getPartyWiseSalesReport,
  upsertPartyMonthlySalesTarget,
  upsertPartyMonthlySalesTargetsBulk,
} from "../controller/partyWiseSalesReport.controller";
import { getProductVehicleWiseReport } from "../controller/productVehicleWiseReport.controller";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
  requireAdminOrWarehouseManagerNoMis,
  requireAdminOrWarehouseOrSalesOfficer,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken);

router.get(
  "/party-wise-sales",
  requireAdminOrWarehouseOrSalesOfficer,
  getPartyWiseSalesReport
);
router.put(
  "/party-wise-sales/targets",
  requireAdminOrWarehouseManagerNoMis,
  upsertPartyMonthlySalesTarget
);
router.put(
  "/party-wise-sales/targets/bulk",
  requireAdminOrWarehouseManagerNoMis,
  upsertPartyMonthlySalesTargetsBulk
);
router.get(
  "/product-vehicle-wise",
  requireAdminOrWarehouseManager,
  getProductVehicleWiseReport
);

export default router;
