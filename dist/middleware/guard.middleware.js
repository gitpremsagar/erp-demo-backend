"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGuardOrderStatusUpdate = exports.validateGuardOrderDriverUpdate = exports.validateGuardPurchaseStatusUpdate = void 0;
const zod_1 = __importDefault(require("zod"));
const UpdateGuardPurchaseStatusSchema = zod_1.default.discriminatedUnion("purchaseTransportStatus", [
    zod_1.default.object({
        purchaseTransportStatus: zod_1.default.literal("EXITED"),
    }),
    zod_1.default.object({
        purchaseTransportStatus: zod_1.default.literal("ARRIVED"),
        markedArrivedAt: zod_1.default.coerce.date(),
        grnNumber: zod_1.default.string().trim().min(1, "GRN number is required"),
    }),
]);
const UpdateGuardOrderDriverSchema = zod_1.default.object({
    driverId: zod_1.default.string().min(1, "driverId is required"),
});
const UpdateGuardOrderStatusSchema = zod_1.default.object({
    orderStatusTypeId: zod_1.default.string().min(1, "orderStatusTypeId is required"),
});
const validateGuardPurchaseStatusUpdate = (req, res, next) => {
    try {
        req.body = UpdateGuardPurchaseStatusSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateGuardPurchaseStatusUpdate = validateGuardPurchaseStatusUpdate;
const validateGuardOrderDriverUpdate = (req, res, next) => {
    try {
        req.body = UpdateGuardOrderDriverSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateGuardOrderDriverUpdate = validateGuardOrderDriverUpdate;
const validateGuardOrderStatusUpdate = (req, res, next) => {
    try {
        req.body = UpdateGuardOrderStatusSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            return res.status(400).json({ message: error.issues });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
    next();
};
exports.validateGuardOrderStatusUpdate = validateGuardOrderStatusUpdate;
//# sourceMappingURL=guard.middleware.js.map