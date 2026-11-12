"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchase_controller_1 = require("./purchase.controller");
const purchase_middleware_1 = require("./purchase.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseOrPurchaser);
router.post("/", purchase_middleware_1.validateCreatePurchase, purchase_controller_1.createPurchase);
router.post("/bulk", purchase_middleware_1.validateCreatePurchasesBulk, purchase_controller_1.createPurchasesBulk);
router.get("/", purchase_controller_1.getPurchases);
router.get("/active", purchase_controller_1.getActivePurchases);
router.get("/warehouse-manager", purchase_controller_1.getWarehouseManagerPurchases);
router.get("/:id", purchase_controller_1.getPurchaseById);
router.put("/:id", purchase_middleware_1.validateUpdatePurchase, purchase_controller_1.updatePurchase);
router.patch("/:id/status", purchase_middleware_1.validateUpdatePurchaseStatus, purchase_controller_1.updatePurchaseStatus);
router.patch("/:id/manual-datetimes", purchase_middleware_1.validateUpdatePurchaseManualDatetimes, purchase_controller_1.updatePurchaseManualDatetimes);
router.patch("/:id/grn", purchase_middleware_1.validateUpdatePurchaseGrn, purchase_controller_1.updatePurchaseGrn);
router.patch("/:id/target-unloading", purchase_middleware_1.validateUpdatePurchaseTargetUnloading, purchase_controller_1.updatePurchaseTargetUnloading);
router.post("/:id/add-to-stock", purchase_controller_1.addPurchaseToStock);
router.post("/:id/sync-pricing", purchase_controller_1.syncPurchasePricing);
router.delete("/:id", purchase_controller_1.deletePurchase);
exports.default = router;
//# sourceMappingURL=purchase.route.js.map