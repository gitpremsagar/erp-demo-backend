import express from "express";
import {
  createOrderStatusType,
  getOrderStatusTypes,
  getOrderStatusTypeById,
  updateOrderStatusType,
  deleteOrderStatusType,
} from "../controller/orderStatusType.controller";
import {
  validateCreateOrderStatusType,
  validateUpdateOrderStatusType,
} from "../middleware/orderStatusType.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken);

router.post("/", requireAdmin, validateCreateOrderStatusType, createOrderStatusType);
router.get("/", getOrderStatusTypes);
router.get("/:id", getOrderStatusTypeById);
router.put("/:id", requireAdmin, validateUpdateOrderStatusType, updateOrderStatusType);

// deleting order status type is not allowed
// router.delete("/:id", deleteOrderStatusType);

export default router;
