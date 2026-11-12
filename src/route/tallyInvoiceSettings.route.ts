import express from "express";
import {
  getTallyInvoiceSettings,
  updateTallyInvoiceSettings,
} from "../controller/tallyInvoiceSettings.controller";
import { validateAccessToken, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/", validateAccessToken, requireAdmin, getTallyInvoiceSettings);
router.put("/", validateAccessToken, requireAdmin, updateTallyInvoiceSettings);

export default router;
