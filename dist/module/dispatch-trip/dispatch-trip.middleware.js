"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateDispatchTrip = exports.validateUpdatePendingDistributor = exports.validateCreatePendingDistributor = exports.validateCreateDispatchTrip = void 0;
const dispatch_trip_schema_1 = require("./dispatch-trip.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateDispatchTrip = (req, res, next) => {
    try {
        req.body = dispatch_trip_schema_1.CreateDispatchTripSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreateDispatchTrip = validateCreateDispatchTrip;
const validateCreatePendingDistributor = (req, res, next) => {
    try {
        req.body = dispatch_trip_schema_1.CreatePendingDistributorSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreatePendingDistributor = validateCreatePendingDistributor;
const validateUpdatePendingDistributor = (req, res, next) => {
    try {
        req.body = dispatch_trip_schema_1.UpdatePendingDistributorSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePendingDistributor = validateUpdatePendingDistributor;
const validateUpdateDispatchTrip = (req, res, next) => {
    try {
        dispatch_trip_schema_1.UpdateDispatchTripSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdateDispatchTrip = validateUpdateDispatchTrip;
//# sourceMappingURL=dispatch-trip.middleware.js.map