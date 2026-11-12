"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vehicleType_controller_1 = require("../controller/vehicleType.controller");
const vehicleType_middleware_1 = require("../middleware/vehicleType.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken);
router.post("/", auth_middleware_1.requireAdmin, vehicleType_middleware_1.validateCreateVehicleType, vehicleType_controller_1.createVehicleType);
router.get("/", vehicleType_controller_1.getVehicleTypes);
router.get("/:id", vehicleType_controller_1.getVehicleTypeById);
router.put("/:id", auth_middleware_1.requireAdmin, vehicleType_middleware_1.validateUpdateVehicleType, vehicleType_controller_1.updateVehicleType);
router.delete("/:id", auth_middleware_1.requireAdmin, vehicleType_controller_1.deleteVehicleType);
exports.default = router;
//# sourceMappingURL=vehicleType.route.js.map