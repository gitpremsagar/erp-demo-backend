"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dispatch_trip_controller_1 = require("./dispatch-trip.controller");
const dispatch_trip_middleware_1 = require("./dispatch-trip.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager);
router.get("/pending-distributors", dispatch_trip_controller_1.getPendingDistributors);
router.post("/pending-distributors", dispatch_trip_middleware_1.validateCreatePendingDistributor, dispatch_trip_controller_1.createPendingDistributor);
router.patch("/pending-distributors/:id", dispatch_trip_middleware_1.validateUpdatePendingDistributor, dispatch_trip_controller_1.updatePendingDistributor);
router.delete("/pending-distributors/:id", dispatch_trip_controller_1.deletePendingDistributor);
router.post("/", dispatch_trip_middleware_1.validateCreateDispatchTrip, dispatch_trip_controller_1.createDispatchTrip);
router.get("/", dispatch_trip_controller_1.getDispatchTrips);
router.get("/:id", dispatch_trip_controller_1.getDispatchTripById);
router.put("/:id", dispatch_trip_middleware_1.validateUpdateDispatchTrip, dispatch_trip_controller_1.updateDispatchTrip);
router.delete("/:id", dispatch_trip_controller_1.deleteDispatchTrip);
exports.default = router;
//# sourceMappingURL=dispatch-trip.route.js.map