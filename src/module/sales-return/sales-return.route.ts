import express from "express";
import {
  createSalesReturn,
  getSalesReturns,
  getSalesReturnById,
  updateSalesReturn,
  deleteSalesReturn,
} from "./sales-return.controller";
import { validateCreateSalesReturn, validateUpdateSalesReturn } from "./sales-return.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOrWarehouseManager,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.post(
  "/",
  validateAccessToken,
  requireAdmin,
  validateCreateSalesReturn,
  createSalesReturn
);
router.get("/", validateAccessToken, requireAdminOrWarehouseManager, getSalesReturns);
router.get("/:id", validateAccessToken, requireAdminOrWarehouseManager, getSalesReturnById);
router.patch(
  "/:id",
  validateAccessToken,
  requireAdmin,
  validateUpdateSalesReturn,
  updateSalesReturn
);
router.delete("/:id", validateAccessToken, requireAdmin, deleteSalesReturn);

export default router;
