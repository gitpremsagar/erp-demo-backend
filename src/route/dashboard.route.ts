import express from "express";
import {
  getDashboardSummary,
  getTillDateSale,
  getTillDatePurchase,
  getMonthWiseSales,
  getMonthWisePurchases,
  getSsForecastCurrent,
  getSsForecastYearly,
  getDbForecastCurrent,
  getNearExpiry,
  getActualStock,
  getContacts,
  getDocuments,
  getShipmentTargets,
  upsertShipmentTarget,
  createContact,
  deleteContact,
  createDocument,
  deleteDocument,
} from "../controller/dashboard.controller";
import {
  getMonthWiseSalesReport,
  getMonthWiseSalesDetail,
  upsertMonthWiseSalesReport,
} from "../controller/monthWiseSalesReport.controller";
import {
  getMonthWisePurchaseReport,
  upsertMonthWisePurchaseReport,
} from "../controller/monthWisePurchaseReport.controller";
import {
  getShipmentVsAchieveReport,
  upsertShipmentVsAchieveMonth,
} from "../controller/shipmentVsAchieveReport.controller";
import {
  bulkUpsertCollectiveReport,
  getCollectiveReport,
} from "../controller/collectiveReport.controller";
import {
  createCollectiveReportGroup,
  deleteCollectiveReportGroup,
  listCollectiveReportGroups,
  setCollectiveReportGroupMembers,
  updateCollectiveReportGroup,
} from "../controller/collectiveReportGroup.controller";
import { validateAccessToken, requireAdminOnly, requireSuperAdmin } from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdminOnly);

router.get("/summary", getDashboardSummary);

router.get("/till-date-sale", getTillDateSale);
router.get("/till-date-purchase", getTillDatePurchase);
router.get("/month-wise-sales", requireSuperAdmin, getMonthWiseSales);
router.get("/month-wise-sales-report", requireSuperAdmin, getMonthWiseSalesReport);
router.get("/month-wise-sales-detail", requireSuperAdmin, getMonthWiseSalesDetail);
router.get("/month-wise-purchases", requireSuperAdmin, getMonthWisePurchases);
router.get("/month-wise-purchase-report", requireSuperAdmin, getMonthWisePurchaseReport);
router.get("/shipment-vs-achieve", getShipmentVsAchieveReport);
router.get("/collective-report", getCollectiveReport);
router.get("/ss-forecast-current", getSsForecastCurrent);
router.get("/ss-forecast-yearly", getSsForecastYearly);
router.get("/db-forecast-current", getDbForecastCurrent);
router.get("/near-expiry", getNearExpiry);
router.get("/actual-stock", getActualStock);
router.get("/contacts", getContacts);
router.get("/documents", getDocuments);

router.get("/shipment-targets", getShipmentTargets);
router.post("/shipment-targets", upsertShipmentTarget);
router.post("/shipment-vs-achieve-month", upsertShipmentVsAchieveMonth);
router.post("/month-wise-sales-report", requireSuperAdmin, upsertMonthWiseSalesReport);
router.post("/month-wise-purchase-report", requireSuperAdmin, upsertMonthWisePurchaseReport);
router.post("/collective-report/bulk", bulkUpsertCollectiveReport);
router.get("/collective-report/groups", listCollectiveReportGroups);
router.post("/collective-report/groups", createCollectiveReportGroup);
router.patch("/collective-report/groups/:id", updateCollectiveReportGroup);
router.delete("/collective-report/groups/:id", deleteCollectiveReportGroup);
router.put("/collective-report/groups/:id/members", setCollectiveReportGroupMembers);

router.post("/contacts", createContact);
router.delete("/contacts/:id", deleteContact);

router.post("/documents", createDocument);
router.delete("/documents/:id", deleteDocument);

export default router;
