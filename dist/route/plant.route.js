"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const plant_controller_1 = require("../controller/plant.controller");
const plant_middleware_1 = require("../middleware/plant.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Plant routes
router.post("/", auth_middleware_1.requireAdmin, plant_middleware_1.validateCreatePlant, plant_controller_1.createPlant);
router.get("/", plant_controller_1.getPlants);
router.get("/:id", plant_controller_1.getPlantById);
router.put("/:id", auth_middleware_1.requireAdmin, plant_middleware_1.validateUpdatePlant, plant_controller_1.updatePlant);
router.delete("/:id", auth_middleware_1.requireAdmin, plant_controller_1.deletePlant);
exports.default = router;
//# sourceMappingURL=plant.route.js.map