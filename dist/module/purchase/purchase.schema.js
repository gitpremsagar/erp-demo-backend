"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseGrnSchema = exports.UpdatePurchaseManualDatetimesSchema = exports.UpdatePurchaseTargetUnloadingSchema = exports.UpdatePurchaseStatusSchema = exports.UpdatePurchaseSchema = exports.CreatePurchasesBulkSchema = exports.CreatePurchaseSchema = void 0;
const zod_1 = require("zod");
const PurchaseInvoiceItemSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "Product ID is required"),
    quantity: zod_1.z.number().int().min(1, "Quantity must be at least 1"),
});
const PurchaseInvoiceSchema = zod_1.z.object({
    invoiceID: zod_1.z.string().min(1, "Invoice ID is required"),
    invoiceDate: zod_1.z.coerce.date().optional().nullable(),
    invoiceAmount: zod_1.z.number().optional().nullable(),
    items: zod_1.z.array(PurchaseInvoiceItemSchema).min(1, "At least one item is required"),
});
exports.CreatePurchaseSchema = zod_1.z.object({
    transporterId: zod_1.z.string().min(1, "Transporter is required"),
    vehicleNumber: zod_1.z.string().trim().optional().nullable(),
    driverContact: zod_1.z.string().trim().optional().nullable(),
    purchaseTransportStatus: zod_1.z
        .enum([
        "PENDING",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "ARRIVED",
        "UNLOADING",
        "UNLOADED",
        "EXITED",
        "COMPLETED",
    ])
        .optional()
        .default("PENDING"),
    markedArrivedAt: zod_1.z.coerce.date().optional().nullable(),
    invoices: zod_1.z.array(PurchaseInvoiceSchema).min(1, "At least one invoice is required"),
});
exports.CreatePurchasesBulkSchema = zod_1.z.object({
    purchases: zod_1.z.array(exports.CreatePurchaseSchema).min(1, "At least one purchase is required"),
});
exports.UpdatePurchaseSchema = zod_1.z.object({
    transporterId: zod_1.z.string().min(1, "Transporter is required"),
    vehicleNumber: zod_1.z.string().trim().optional().nullable(),
    driverContact: zod_1.z.string().trim().optional().nullable(),
    purchaseTransportStatus: zod_1.z
        .enum([
        "PENDING",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "ARRIVED",
        "UNLOADING",
        "UNLOADED",
        "EXITED",
        "COMPLETED",
    ])
        .optional()
        .default("PENDING"),
    markedArrivedAt: zod_1.z.coerce.date().optional().nullable(),
    invoices: zod_1.z.array(PurchaseInvoiceSchema).min(1, "At least one invoice is required"),
});
exports.UpdatePurchaseStatusSchema = zod_1.z.object({
    purchaseTransportStatus: zod_1.z.enum([
        "PENDING",
        "LOADING",
        "LOADED",
        "IN_TRANSIT",
        "ARRIVED",
        "UNLOADING",
        "UNLOADED",
        "EXITED",
        "COMPLETED",
    ]),
});
exports.UpdatePurchaseTargetUnloadingSchema = zod_1.z.object({
    TargetUnloadingDate: zod_1.z.coerce.date().nullable(),
});
/** Partial manual datetime updates; at least one field must be present. */
exports.UpdatePurchaseManualDatetimesSchema = zod_1.z
    .object({
    purchaseDate: zod_1.z.coerce.date().optional(),
    markedArrivedAt: zod_1.z.coerce.date().nullable().optional(),
    TargetUnloadingDate: zod_1.z.coerce.date().nullable().optional(),
    markedUnloadedAt: zod_1.z.coerce.date().nullable().optional(),
    VehicleExitedAt: zod_1.z.coerce.date().nullable().optional(),
})
    .refine((data) => Object.keys(data).some((k) => data[k] !== undefined), { message: "At least one datetime field is required" });
exports.UpdatePurchaseGrnSchema = zod_1.z.object({
    grnNumber: zod_1.z.string().trim().min(1).nullable(),
});
//# sourceMappingURL=purchase.schema.js.map