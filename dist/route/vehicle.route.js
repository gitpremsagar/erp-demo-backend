"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vehicle_controller_1 = require("../controller/vehicle.controller");
const vehicle_middleware_1 = require("../middleware/vehicle.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Vehicle routes
router.post("/", auth_middleware_1.requireAdmin, vehicle_middleware_1.validateCreateVehicle, vehicle_controller_1.createVehicle);
router.get("/", vehicle_controller_1.getVehicles);
router.get("/reports/fuel-consumption", vehicle_controller_1.getFuelConsumptionReport);
router.get("/reports/fuel-consumption/orders", vehicle_controller_1.getFuelConsumptionOrders);
router.patch("/reports/fuel-consumption/entry", auth_middleware_1.requireAdmin, vehicle_controller_1.updateFuelConsumptionEntry);
router.get("/:id", vehicle_controller_1.getVehicleById);
router.put("/:id", auth_middleware_1.requireAdmin, vehicle_middleware_1.validateUpdateVehicle, vehicle_controller_1.updateVehicle);
router.delete("/:id", auth_middleware_1.requireAdmin, vehicle_controller_1.deleteVehicle);
exports.default = router;
//# sourceMappingURL=vehicle.route.js.map