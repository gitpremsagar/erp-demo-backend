import express from "express";
import {
  createDispatchTrip,
  getDispatchTrips,
  getDispatchTripById,
  updateDispatchTrip,
  deleteDispatchTrip,
  getPendingDistributors,
  createPendingDistributor,
  updatePendingDistributor,
  deletePendingDistributor,
} from "./dispatch-trip.controller";
import {
  validateCreateDispatchTrip,
  validateUpdateDispatchTrip,
  validateCreatePendingDistributor,
  validateUpdatePendingDistributor,
} from "./dispatch-trip.middleware";
import {
  validateAccessToken,
  requireAdminOrWarehouseManager,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdminOrWarehouseManager);

router.get("/pending-distributors", getPendingDistributors);
router.post(
  "/pending-distributors",
  validateCreatePendingDistributor,
  createPendingDistributor
);
router.patch(
  "/pending-distributors/:id",
  validateUpdatePendingDistributor,
  updatePendingDistributor
);
router.delete("/pending-distributors/:id", deletePendingDistributor);

router.post("/", validateCreateDispatchTrip, createDispatchTrip);
router.get("/", getDispatchTrips);
router.get("/:id", getDispatchTripById);
router.put("/:id", validateUpdateDispatchTrip, updateDispatchTrip);
router.delete("/:id", deleteDispatchTrip);

export default router;
