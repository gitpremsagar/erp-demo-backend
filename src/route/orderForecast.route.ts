import express from "express";
import {
  createForecast,
  getForecasts,
  getForecastById,
  getForecastDetailReport,
  updateForecast,
  deleteForecast,
  getForecastStats,
  getForecastsByDistributor,
} from "../controller/orderForecast.controller";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new forecast
router.post("/", createForecast);

// Get all forecasts with pagination and filtering
router.get("/", getForecasts);

// Get forecasts by distributor ID 
router.get("/distributor/:distributorId", getForecastsByDistributor);

// Get forecast statistics
router.get("/stats", getForecastStats);

// Get forecast detail report (comparison + products not in forecast) - must be before :forecastId
router.get("/:forecastId/report", getForecastDetailReport);

// Get a single forecast by ID
router.get("/:forecastId", getForecastById);

// Update a forecast
router.put("/:forecastId", updateForecast);

// Delete a forecast
router.delete("/:forecastId", requireAdmin, deleteForecast);

export default router;
