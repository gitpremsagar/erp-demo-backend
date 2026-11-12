import { z } from "zod";

export const ORDER_SHEET_TAG_VALUES = [
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
] as const;

export const OrderSheetTagSchema = z.enum(ORDER_SHEET_TAG_VALUES);

export const CreateOrderSchema = z.object({
  customerId: z
    .string()
    .min(24, "Invalid customer ID")
    .max(24, "Invalid customer ID"),
  totalPrice: z
    .number()
    .positive("Total price must be a positive number")
    .int("Total price must be an integer")
    .optional(),
  vehicleId: z
    .string()
    .min(1, "Invalid vehicle ID")
    .max(24, "Invalid vehicle ID")
    .optional(),
  driverId: z
    .string()
    .min(24, "Invalid driver ID")
    .max(24, "Invalid driver ID")
    .optional(),
  deliveryAddressId: z
    .string()
    .min(24, "Invalid delivery address ID")
    .max(24, "Invalid delivery address ID")
    .optional(),
  originalOrderId: z
    .string()
    .min(24, "Invalid original order ID")
    .max(24, "Invalid original order ID")
    .optional(),
  stockRecordId: z
    .string()
    .min(24, "Invalid stock record ID")
    .max(24, "Invalid stock record ID")
    .optional(),
  orderStatusTypeId: z
    .string()
    .min(24, "Invalid order status type ID")
    .max(24, "Invalid order status type ID")
    .optional(),
  orderDate: z
    .string()
    .refine((date) => {
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
    .optional(),
  orderItems: z.array(z.object({
    productId: z
      .string()
      .min(24, "Invalid product ID")
      .max(24, "Invalid product ID"),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .positive("Quantity must be positive"),
    itemDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  })).min(1, "At least one order item is required"),
  tallyInvoiceId: z.string().trim().min(1).max(64).optional().nullable(),
  orderGeneratorId: z.string().min(24).max(24).optional(),
  isVerifiedByAdmin: z.boolean().optional(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  cashDiscountPercent: z.number().optional().nullable(),
  narration: z.string().max(2000).optional().nullable(),
  dmsInvoiceNumber: z.string().trim().max(128).optional().nullable(),
  tripNumber: z.number().int().min(0).optional().nullable(),
  sheetTag: OrderSheetTagSchema.optional().nullable(),
  tallyValue: z.number().optional().nullable(),
  dmsValue: z.number().optional().nullable(),
  diffReason: z.string().max(2000).optional().nullable(),
  valuesAutoMatched: z.boolean().optional().nullable(),
  isManuallyConfirmed: z.boolean().optional().nullable(),
});

export const UpdateOrderExcelMetaSchema = z.object({
  dmsInvoiceNumber: z.string().trim().max(128).optional().nullable(),
  tripNumber: z.number().int().min(0).optional().nullable(),
  sheetTag: OrderSheetTagSchema.optional().nullable(),
  tallyValue: z.number().optional().nullable(),
  dmsValue: z.number().optional().nullable(),
  diffReason: z.string().max(2000).optional().nullable(),
  valuesAutoMatched: z.boolean().optional().nullable(),
  isManuallyConfirmed: z.boolean().optional().nullable(),
  narration: z.string().max(2000).optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  cashDiscountPercent: z.number().optional().nullable(),
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

export const UpdateOrderSchema = z.object({
  status: z.enum(["PENDING", "MODIFYING", "PACKING_PENDING", "PACKING", "APPROVAL_PENDING", "SHIPPING_PENDING", "SHIPPING", "DELIVERED", "COMPLETED"]).optional(),
  orderStatusTypeId: z
    .string()
    .min(24, "Invalid order status type ID")
    .max(24, "Invalid order status type ID")
    .nullable()
    .optional(),
  totalPrice: z
    .number()
    .positive("Total price must be a positive number")
    .int("Total price must be an integer")
    .optional(),
  customerId: z
    .string()
    .min(24, "Invalid customer ID")
    .max(24, "Invalid customer ID")
    .optional(),
  vehicleId: z
    .string()
    .min(24, "Invalid vehicle ID")
    .max(24, "Invalid vehicle ID")
    .optional(),
  driverId: z
    .string()
    .min(24, "Invalid driver ID")
    .max(24, "Invalid driver ID")
    .nullable()
    .optional(),
  deliveryAddressId: z
    .string()
    .min(24, "Invalid delivery address ID")
    .max(24, "Invalid delivery address ID")
    .optional(),
  originalOrderId: z
    .string()
    .min(24, "Invalid original order ID")
    .max(24, "Invalid original order ID")
    .optional(),
  stockRecordId: z
    .string()
    .min(24, "Invalid stock record ID")
    .max(24, "Invalid stock record ID")
    .optional(),
  orderUpdaterId: z
    .string()
    .min(24, "Invalid order updater ID")
    .max(24, "Invalid order updater ID")
    .optional(),
  orderDate: z
    .string()
    .refine((date) => {
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
    .optional(),
  orderItems: z.array(z.object({
    productId: z
      .string()
      .min(24, "Invalid product ID")
      .max(24, "Invalid product ID"),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(0, "Quantity must be 0 or positive (0 = remove item)"),
    itemDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  })).min(1, "At least one order item is required").optional(),
  tallyInvoiceId: z.string().trim().max(64).optional().nullable(),
});

/** Distributor-only draft update (authenticated CUSTOMER). Full cart replace; no customerId in body. */
export const UpdateDistributorDraftOrderSchema = z.object({
  orderItems: z
    .array(
      z.object({
        productId: z.string().min(24).max(24),
        quantity: z.number().int().positive(),
        itemDiscountPercent: z.number().min(0).max(100).nullable().optional(),
      })
    )
    .min(1, "At least one order item is required"),
  vehicleId: z.union([z.string().min(24).max(24), z.null()]).optional(),
  driverId: z.union([z.string().min(24).max(24), z.null()]).optional(),
  deliveryAddressId: z.union([z.string().min(24).max(24), z.null()]).optional(),
  orderDate: z
    .string()
    .refine((date) => {
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid order date format")
    .optional(),
  orderStatusTypeId: z.string().min(24).max(24).nullable().optional(),
});

/** Admin-only: full cart replace on orders not yet verified (no stock / FIFO). */
export const AdminUpdateUnverifiedOrderSchema = UpdateDistributorDraftOrderSchema.extend({
  customerId: z.string().min(24, "Invalid customer ID").max(24, "Invalid customer ID").optional(),
  tallyInvoiceId: z.string().trim().max(64).optional().nullable(),
});

export const UpdateOrderVehicleSchema = z.object({
  vehicleId: z
    .string()
    .min(24, "Invalid vehicle ID")
    .max(24, "Invalid vehicle ID")
    .nullable(),
});

export const UpdateOrderDriverSchema = z.object({
  driverId: z
    .string()
    .min(24, "Invalid driver ID")
    .max(24, "Invalid driver ID")
    .nullable(),
});

export const UpdateOrderDeliveryDateSchema = z.object({
  deliveryDate: z
    .string()
    .refine((date) => {
      const dateObj = new Date(date);
      return !isNaN(dateObj.getTime());
    }, "Invalid delivery date format")
    .nullable(),
});

export const UpdateOrderStatusSchema = z.object({
  orderStatusTypeId: z
    .string()
    .min(24, "Invalid order status type ID")
    .max(24, "Invalid order status type ID"),
});

/** Admin-only: apply discount percent (0–100) to a single order. */
export const ApplyOrderDiscountSchema = z.object({
  discountPercent: z
    .number()
    .min(0, "Discount must be at least 0")
    .max(100, "Discount must be at most 100"),
});

/** Admin-only: set or clear order narration. */
export const UpdateOrderNarrationSchema = z.object({
  narration: z
    .string()
    .max(2000, "Narration must be at most 2000 characters")
    .nullable(),
});

/** Admin-only: set or clear Tally invoice ID. Empty string or null clears. */
export const UpdateOrderTallyInvoiceSchema = z.object({
  tallyInvoiceId: z.string().trim().max(64).nullable(),
});

/** Admin-only: update receiving status on sales history orders. */
export const UpdateOrderReceivingStatusSchema = z.object({
  receivingStatus: z.enum(["PENDING", "RECEIVED"]),
});

export const OrderQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: z.enum(["PENDING", "MODIFYING", "PACKING", "SHIPPING", "DELIVERED", "COMPLETED"]).optional(),
  orderStatusTypeId: z.string().min(24).max(24).optional(),
  customerId: z.string().min(24).max(24).optional(),
  /** When "true" and no orderStatusTypeId, return orders of every status (including completed). */
  includeAllStatuses: z.enum(["true", "false"]).optional(),
  startDate: z.string().refine((date) => {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid start date format").optional(),
  endDate: z.string().refine((date) => {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid end date format").optional(),
  deliveryStartDate: z.string().refine((date) => {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid delivery start date format").optional(),
  deliveryEndDate: z.string().refine((date) => {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }, "Invalid delivery end date format").optional(),
  vehicleNumber: z.string().trim().min(1).optional(),
  driverName: z.string().trim().min(1).optional(),
});
