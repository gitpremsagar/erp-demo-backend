"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrderQuery = exports.validateApplyOrderDiscount = exports.validateUpdateOrderReceivingStatus = exports.validateUpdateOrderExcelMeta = exports.validateUpdateOrderTallyInvoice = exports.validateUpdateOrderNarration = exports.validateUpdateOrderStatus = exports.validateUpdateOrderDeliveryDate = exports.validateUpdateOrderDriver = exports.validateUpdateOrderVehicle = exports.validateAdminUpdateUnverifiedOrder = exports.validateUpdateDistributorDraftOrder = exports.validateUpdateOrder = exports.validateCreateOrder = void 0;
const orderForm_schema_1 = require("../libs/schemas/orderForm.schema");
const zod_1 = __importDefault(require("zod"));
const validateCreateOrder = (req, res, next) => {
    try {
        // console.log("Create Order Validation request body:\n", req.body);
        // CreateOrderSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Create Order Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateCreateOrder = validateCreateOrder;
const validateUpdateOrder = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrder = validateUpdateOrder;
const validateUpdateDistributorDraftOrder = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateDistributorDraftOrderSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update distributor draft order validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateDistributorDraftOrder = validateUpdateDistributorDraftOrder;
const validateAdminUpdateUnverifiedOrder = (req, res, next) => {
    try {
        orderForm_schema_1.AdminUpdateUnverifiedOrderSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Admin update unverified order validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateAdminUpdateUnverifiedOrder = validateAdminUpdateUnverifiedOrder;
const validateUpdateOrderVehicle = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderVehicleSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Vehicle Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderVehicle = validateUpdateOrderVehicle;
const validateUpdateOrderDriver = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderDriverSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Driver Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderDriver = validateUpdateOrderDriver;
const validateUpdateOrderDeliveryDate = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderDeliveryDateSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Delivery Date Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderDeliveryDate = validateUpdateOrderDeliveryDate;
const validateUpdateOrderStatus = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderStatusSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Status Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderStatus = validateUpdateOrderStatus;
const validateUpdateOrderNarration = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderNarrationSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Narration Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderNarration = validateUpdateOrderNarration;
const validateUpdateOrderTallyInvoice = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderTallyInvoiceSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Tally Invoice Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderTallyInvoice = validateUpdateOrderTallyInvoice;
const validateUpdateOrderExcelMeta = (req, res, next) => {
    try {
        req.body = orderForm_schema_1.UpdateOrderExcelMetaSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Excel Meta Validation error:\n", error);
            res.status(400).json({ message: error.issues });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderExcelMeta = validateUpdateOrderExcelMeta;
const validateUpdateOrderReceivingStatus = (req, res, next) => {
    try {
        orderForm_schema_1.UpdateOrderReceivingStatusSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update Order Receiving Status Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateOrderReceivingStatus = validateUpdateOrderReceivingStatus;
const validateApplyOrderDiscount = (req, res, next) => {
    try {
        orderForm_schema_1.ApplyOrderDiscountSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Apply Order Discount Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateApplyOrderDiscount = validateApplyOrderDiscount;
const validateOrderQuery = (req, res, next) => {
    try {
        orderForm_schema_1.OrderQuerySchema.parse(req.query);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Order Query Validation error:\n", error);
            res.status(400).json({ message: error });
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateOrderQuery = validateOrderQuery;
//# sourceMappingURL=order.middleware.js.map