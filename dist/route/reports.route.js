"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const partyWiseSalesReport_controller_1 = require("../controller/partyWiseSalesReport.controller");
const productVehicleWiseReport_controller_1 = require("../controller/productVehicleWiseReport.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken);
router.get("/party-wise-sales", auth_middleware_1.requireAdminOrWarehouseOrSalesOfficer, partyWiseSalesReport_controller_1.getPartyWiseSalesReport);
router.put("/party-wise-sales/targets", auth_middleware_1.requireAdminOrWarehouseManagerNoMis, partyWiseSalesReport_controller_1.upsertPartyMonthlySalesTarget);
router.put("/party-wise-sales/targets/bulk", auth_middleware_1.requireAdminOrWarehouseManagerNoMis, partyWiseSalesReport_controller_1.upsertPartyMonthlySalesTargetsBulk);
router.get("/product-vehicle-wise", auth_middleware_1.requireAdminOrWarehouseManager, productVehicleWiseReport_controller_1.getProductVehicleWiseReport);
exports.default = router;
//# sourceMappingURL=reports.route.js.map