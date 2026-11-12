"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderQuerySchema = exports.UpdateOrderReceivingStatusSchema = exports.UpdateOrderTallyInvoiceSchema = exports.UpdateOrderNarrationSchema = exports.ApplyOrderDiscountSchema = exports.UpdateOrderStatusSchema = exports.UpdateOrderDeliveryDateSchema = exports.UpdateOrderDriverSchema = exports.UpdateOrderVehicleSchema = exports.AdminUpdateUnverifiedOrderSchema = exports.UpdateDistributorDraftOrderSchema = exports.UpdateOrderSchema = exports.UpdateOrderExcelMetaSchema = exports.CreateOrderSchema = exports.OrderSheetTagSchema = exports.ORDER_SHEET_TAG_VALUES = void 0;
const zod_1 = require("zod");
exports.ORDER_SHEET_TAG_VALUES = [
    "TRIP_1",
    "TRIP_2",
    "TRIP_3",
    "TRIP_4",
    "TRIP_5",
    "TRIP_6",
    "TRIP_7",
    "TRIP_8",
    "LCVS",
    "DRAFTS",
    "ADVANCE_DMS",
];
exports.OrderSheetTagSchema = zod_1.z.enum(exports.ORDER_SHEET_TAG_VALUES);
exports.CreateOrderSchema = zod_1.z.object({
    customerId: zod_1.z
        .string()
        .min(24, "Invalid customer ID")
        .max(24, "Invalid customer ID"),
    totalPrice: zod_1.z
        .number()
        .positive("Total price must be a positive number")
        .int("Total price must be an integer")
        .optional(),
    vehicleId: zod_1.z
        .string()
        .min(1, "Invalid vehicle ID")
        .max(24, "Invalid vehicle ID")
        .optional(),
    driverId: zod_1.z
        .string()
        .min(24, "Invalid driver ID")
        .max(24, "Invalid driver ID")
        .optional(),
    deliveryAddressId: zod_1.z
        .string()
        .min(24, "Invalid delivery address ID")
        .max(24, "Invalid delivery address ID")
        .optional(),
    originalOrderId: zod_1.z
        .string()
        .min(24, "Invalid original order ID")
        .max(24, "Invalid original order ID")
        .optional(),
    stockRecordId: zod_1.z
        .string()
        .min(24, "Invalid stock record ID")
        .max(24, "Invalid stock record ID")
        .optional(),
    orderStatusTypeId: zod_1.z
        .string()
        .min(24, "Invalid order status type ID")
        .max(24, "Invalid order status type ID")
        .optional(),
    orderDate: zod_1.z
        .string()
        .refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
        .optional(),
    orderItems: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z
            .string()
            .min(24, "Invalid product ID")
            .max(24, "Invalid product ID"),
        quantity: zod_1.z
            .number()
            .int("Quantity must be an integer")
            .positive("Quantity must be positive"),
        itemDiscountPercent: zod_1.z.number().min(0).max(100).nullable().optional(),
    })).min(1, "At least one order item is required"),
    tallyInvoiceId: zod_1.z.string().trim().min(1).max(64).optional().nullable(),
    orderGeneratorId: zod_1.z.string().min(24).max(24).optional(),
    isVerifiedByAdmin: zod_1.z.boolean().optional(),
    discountPercent: zod_1.z.number().min(0).max(100).optional().nullable(),
    cashDiscountPercent: zod_1.z.number().optional().nullable(),
    narration: zod_1.z.string().max(2000).optional().nullable(),
    dmsInvoiceNumber: zod_1.z.string().trim().max(128).optional().nullable(),
    tripNumber: zod_1.z.number().int().min(0).optional().nullable(),
    sheetTag: exports.OrderSheetTagSchema.optional().nullable(),
    tallyValue: zod_1.z.number().optional().nullable(),
    dmsValue: zod_1.z.number().optional().nullable(),
    diffReason: zod_1.z.string().max(2000).optional().nullable(),
    valuesAutoMatched: zod_1.z.boolean().optional().nullable(),
    isManuallyConfirmed: zod_1.z.boolean().optional().nullable(),
});
exports.UpdateOrderExcelMetaSchema = zod_1.z.object({
    dmsInvoiceNumber: zod_1.z.string().trim().max(128).optional().nullable(),
    tripNumber: zod_1.z.number().int().min(0).optional().nullable(),
    sheetTag: exports.OrderSheetTagSchema.optional().nullable(),
    tallyValue: zod_1.z.number().optional().nullable(),
    dmsValue: zod_1.z.number().optional().nullable(),
    diffReason: zod_1.z.string().max(2000).optional().nullable(),
    valuesAutoMatched: zod_1.z.boolean().optional().nullable(),
    isManuallyConfirmed: zod_1.z.boolean().optional().nullable(),
    narration: zod_1.z.string().max(2000).optional().nullable(),
    discountPercent: zod_1.z.number().min(0).max(100).optional().nullable(),
    cashDiscountPercent: zod_1.z.number().optional().nullable(),
});
// enum OrderStatus {
//   PENDING
//   MODIFYING
//   PACKING_PENDING
//   PACKING
//   APPROVAL_PENDING
//   SHIPPING_PENDING
//   SHIPPING
//   DELIVERED
//   COMPLETED
// }
exports.UpdateOrderSchema = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "MODIFYING", "PACKING_PENDING", "PACKING", "APPROVAL_PENDING", "SHIPPING_PENDING", "SHIPPING", "DELIVERED", "COMPLETED"]).optional(),
    orderStatusTypeId: zod_1.z
        .string()
        .min(24, "Invalid order status type ID")
        .max(24, "Invalid order status type ID")
        .nullable()
        .optional(),
    totalPrice: zod_1.z
        .number()
        .positive("Total price must be a positive number")
        .int("Total price must be an integer")
        .optional(),
    customerId: zod_1.z
        .string()
        .min(24, "Invalid customer ID")
        .max(24, "Invalid customer ID")
        .optional(),
    vehicleId: zod_1.z
        .string()
        .min(24, "Invalid vehicle ID")
        .max(24, "Invalid vehicle ID")
        .optional(),
    driverId: zod_1.z
        .string()
        .min(24, "Invalid driver ID")
        .max(24, "Invalid driver ID")
        .nullable()
        .optional(),
    deliveryAddressId: zod_1.z
        .string()
        .min(24, "Invalid delivery address ID")
        .max(24, "Invalid delivery address ID")
        .optional(),
    originalOrderId: zod_1.z
        .string()
        .min(24, "Invalid original order ID")
        .max(24, "Invalid original order ID")
        .optional(),
    stockRecordId: zod_1.z
        .string()
        .min(24, "Invalid stock record ID")
        .max(24, "Invalid stock record ID")
        .optional(),
    orderUpdaterId: zod_1.z
        .string()
        .min(24, "Invalid order updater ID")
        .max(24, "Invalid order updater ID")
        .optional(),
    orderDate: zod_1.z
        .string()
        .refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
        .optional(),
    orderItems: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z
            .string()
            .min(24, "Invalid product ID")
            .max(24, "Invalid product ID"),
        quantity: zod_1.z
            .number()
            .int("Quantity must be an integer")
            .min(0, "Quantity must be 0 or positive (0 = remove item)"),
        itemDiscountPercent: zod_1.z.number().min(0).max(100).nullable().optional(),
    })).min(1, "At least one order item is required").optional(),
    tallyInvoiceId: zod_1.z.string().trim().max(64).optional().nullable(),
});
/** Distributor-only draft update (authenticated CUSTOMER). Full cart replace; no customerId in body. */
exports.UpdateDistributorDraftOrderSchema = zod_1.z.object({
    orderItems: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().min(24).max(24),
        quantity: zod_1.z.number().int().positive(),
        itemDiscountPercent: zod_1.z.number().min(0).max(100).nullable().optional(),
    }))
        .min(1, "At least one order item is required"),
    vehicleId: zod_1.z.union([zod_1.z.string().min(24).max(24), zod_1.z.null()]).optional(),
    driverId: zod_1.z.union([zod_1.z.string().min(24).max(24), zod_1.z.null()]).optional(),
    deliveryAddressId: zod_1.z.union([zod_1.z.string().min(24).max(24), zod_1.z.null()]).optional(),
    orderDate: zod_1.z
        .string()
        .refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
        .optional(),
    orderStatusTypeId: zod_1.z.string().min(24).max(24).nullable().optional(),
});
/** Admin-only: full cart replace on orders not yet verified (no stock / FIFO). */
exports.AdminUpdateUnverifiedOrderSchema = exports.UpdateDistributorDraftOrderSchema.extend({
    customerId: zod_1.z.string().min(24, "Invalid customer ID").max(24, "Invalid customer ID").optional(),
    tallyInvoiceId: zod_1.z.string().trim().max(64).optional().nullable(),
});
exports.UpdateOrderVehicleSchema = zod_1.z.object({
    vehicleId: zod_1.z
        .string()
        .min(24, "Invalid vehicle ID")
        .max(24, "Invalid vehicle ID")
        .nullable(),
});
exports.UpdateOrderDriverSchema = zod_1.z.object({
    driverId: zod_1.z
        .string()
        .min(24, "Invalid driver ID")
        .max(24, "Invalid driver ID")
        .nullable(),
});
exports.UpdateOrderDeliveryDateSchema = zod_1.z.object({
    deliveryDate: zod_1.z
        .string()
        .refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid delivery date format")
        .nullable(),
});
exports.UpdateOrderStatusSchema = zod_1.z.object({
    orderStatusTypeId: zod_1.z
        .string()
        .min(24, "Invalid order status type ID")
        .max(24, "Invalid order status type ID"),
});
/** Admin-only: apply discount percent (0–100) to a single order. */
exports.ApplyOrderDiscountSchema = zod_1.z.object({
    discountPercent: zod_1.z
        .number()
        .min(0, "Discount must be at least 0")
        .max(100, "Discount must be at most 100"),
});
/** Admin-only: set or clear order narration. */
exports.UpdateOrderNarrationSchema = zod_1.z.object({
    narration: zod_1.z
        .string()
        .max(2000, "Narration must be at most 2000 characters")
        .nullable(),
});
/** Admin-only: set or clear Tally invoice ID. Empty string or null clears. */
exports.UpdateOrderTallyInvoiceSchema = zod_1.z.object({
    tallyInvoiceId: zod_1.z.string().trim().max(64).nullable(),
});
/** Admin-only: update receiving status on sales history orders. */
exports.UpdateOrderReceivingStatusSchema = zod_1.z.object({
    receivingStatus: zod_1.z.enum(["PENDING", "RECEIVED"]),
});
exports.OrderQuerySchema = zod_1.z.object({
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    status: zod_1.z.enum(["PENDING", "MODIFYING", "PACKING", "SHIPPING", "DELIVERED", "COMPLETED"]).optional(),
    orderStatusTypeId: zod_1.z.string().min(24).max(24).optional(),
    customerId: zod_1.z.string().min(24).max(24).optional(),
    /** When "true" and no orderStatusTypeId, return orders of every status (including completed). */
    includeAllStatuses: zod_1.z.enum(["true", "false"]).optional(),
    startDate: zod_1.z.string().refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid start date format").optional(),
    endDate: zod_1.z.string().refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid end date format").optional(),
    deliveryStartDate: zod_1.z.string().refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid delivery start date format").optional(),
    deliveryEndDate: zod_1.z.string().refine((date) => {
        const dateObj = new Date(date);
        return !isNaN(dateObj.getTime());
    }, "Invalid delivery end date format").optional(),
    vehicleNumber: zod_1.z.string().trim().min(1).optional(),
    driverName: zod_1.z.string().trim().min(1).optional(),
});
//# sourceMappingURL=orderForm.schema.js.map