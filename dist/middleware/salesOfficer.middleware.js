"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAssignDistributor = exports.validateUpdateSalesOfficer = exports.validateCreateSalesOfficer = void 0;
const salesOfficerForm_schema_1 = require("../libs/schemas/salesOfficerForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateSalesOfficer = (req, res, next) => {
    try {
        salesOfficerForm_schema_1.CreateSalesOfficerSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create Sales Officer Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateSalesOfficer = validateCreateSalesOfficer;
const validateUpdateSalesOfficer = (req, res, next) => {
    try {
        salesOfficerForm_schema_1.UpdateSalesOfficerSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Sales Officer Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateSalesOfficer = validateUpdateSalesOfficer;
const validateAssignDistributor = (req, res, next) => {
    try {
        salesOfficerForm_schema_1.AssignDistributorSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Assign Distributor Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateAssignDistributor = validateAssignDistributor;
//# sourceMappingURL=salesOfficer.middleware.js.map