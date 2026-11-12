"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateVehicleType = exports.validateCreateVehicleType = void 0;
const vehicleTypeForm_schema_1 = require("../libs/schemas/vehicleTypeForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateVehicleType = (req, res, next) => {
    try {
        vehicleTypeForm_schema_1.CreateVehicleTypeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create Vehicle Type Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateVehicleType = validateCreateVehicleType;
const validateUpdateVehicleType = (req, res, next) => {
    try {
        vehicleTypeForm_schema_1.UpdateVehicleTypeSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Vehicle Type Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateVehicleType = validateUpdateVehicleType;
//# sourceMappingURL=vehicleType.middleware.js.map