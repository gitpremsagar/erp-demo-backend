"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdatePlant = exports.validateCreatePlant = void 0;
const plantForm_schema_1 = require("../libs/schemas/plantForm.schema");
const zod_1 = __importDefault(require("zod"));
// Plant Middleware
const validateCreatePlant = (req, res, next) => {
    try {
        plantForm_schema_1.CreatePlantSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create Plant Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreatePlant = validateCreatePlant;
const validateUpdatePlant = (req, res, next) => {
    try {
        plantForm_schema_1.UpdatePlantSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Plant Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdatePlant = validateUpdatePlant;
//# sourceMappingURL=plant.middleware.js.map