"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdatePurchaseGrn = exports.validateUpdatePurchaseManualDatetimes = exports.validateUpdatePurchaseTargetUnloading = exports.validateUpdatePurchaseStatus = exports.validateCreatePurchasesBulk = exports.validateUpdatePurchase = exports.validateCreatePurchase = void 0;
const purchase_schema_1 = require("./purchase.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreatePurchase = (req, res, next) => {
    try {
        // console.log("req.body", req.body);
        req.body = purchase_schema_1.CreatePurchaseSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            // console.log("error", error);
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreatePurchase = validateCreatePurchase;
const validateUpdatePurchase = (req, res, next) => {
    try {
        req.body = purchase_schema_1.UpdatePurchaseSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePurchase = validateUpdatePurchase;
const validateCreatePurchasesBulk = (req, res, next) => {
    try {
        req.body = purchase_schema_1.CreatePurchasesBulkSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateCreatePurchasesBulk = validateCreatePurchasesBulk;
const validateUpdatePurchaseStatus = (req, res, next) => {
    try {
        req.body = purchase_schema_1.UpdatePurchaseStatusSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePurchaseStatus = validateUpdatePurchaseStatus;
const validateUpdatePurchaseTargetUnloading = (req, res, next) => {
    try {
        req.body = purchase_schema_1.UpdatePurchaseTargetUnloadingSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePurchaseTargetUnloading = validateUpdatePurchaseTargetUnloading;
const validateUpdatePurchaseManualDatetimes = (req, res, next) => {
    try {
        req.body = purchase_schema_1.UpdatePurchaseManualDatetimesSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePurchaseManualDatetimes = validateUpdatePurchaseManualDatetimes;
const validateUpdatePurchaseGrn = (req, res, next) => {
    try {
        req.body = purchase_schema_1.UpdatePurchaseGrnSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateUpdatePurchaseGrn = validateUpdatePurchaseGrn;
//# sourceMappingURL=purchase.middleware.js.map