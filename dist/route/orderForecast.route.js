"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderForecast_controller_1 = require("../controller/orderForecast.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new forecast
router.post("/", orderForecast_controller_1.createForecast);
// Get all forecasts with pagination and filtering
router.get("/", orderForecast_controller_1.getForecasts);
// Get forecasts by distributor ID 
router.get("/distributor/:distributorId", orderForecast_controller_1.getForecastsByDistributor);
// Get forecast statistics
router.get("/stats", orderForecast_controller_1.getForecastStats);
// Get forecast detail report (comparison + products not in forecast) - must be before :forecastId
router.get("/:forecastId/report", orderForecast_controller_1.getForecastDetailReport);
// Get a single forecast by ID
router.get("/:forecastId", orderForecast_controller_1.getForecastById);
// Update a forecast
router.put("/:forecastId", orderForecast_controller_1.updateForecast);
// Delete a forecast
router.delete("/:forecastId", auth_middleware_1.requireAdmin, orderForecast_controller_1.deleteForecast);
exports.default = router;
//# sourceMappingURL=orderForecast.route.js.map