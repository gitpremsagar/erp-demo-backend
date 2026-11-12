import { z } from "zod";

const PurchaseInvoiceItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

const PurchaseInvoiceSchema = z.object({
  invoiceID: z.string().min(1, "Invoice ID is required"),
  invoiceDate: z.coerce.date().optional().nullable(),
  invoiceAmount: z.number().optional().nullable(),
  items: z.array(PurchaseInvoiceItemSchema).min(1, "At least one item is required"),
});

export const CreatePurchaseSchema = z.object({
  transporterId: z.string().min(1, "Transporter is required"),
  vehicleNumber: z.string().trim().optional().nullable(),
  driverContact: z.string().trim().optional().nullable(),
  purchaseTransportStatus: z
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
  markedArrivedAt: z.coerce.date().optional().nullable(),
  invoices: z.array(PurchaseInvoiceSchema).min(1, "At least one invoice is required"),
});

export const CreatePurchasesBulkSchema = z.object({
  purchases: z.array(CreatePurchaseSchema).min(1, "At least one purchase is required"),
});

export const UpdatePurchaseSchema = z.object({
  transporterId: z.string().min(1, "Transporter is required"),
  vehicleNumber: z.string().trim().optional().nullable(),
  driverContact: z.string().trim().optional().nullable(),
  purchaseTransportStatus: z
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
  markedArrivedAt: z.coerce.date().optional().nullable(),
  invoices: z.array(PurchaseInvoiceSchema).min(1, "At least one invoice is required"),
});

export const UpdatePurchaseStatusSchema = z.object({
  purchaseTransportStatus: z.enum([
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

export const UpdatePurchaseTargetUnloadingSchema = z.object({
  TargetUnloadingDate: z.coerce.date().nullable(),
});

/** Partial manual datetime updates; at least one field must be present. */
export const UpdatePurchaseManualDatetimesSchema = z
  .object({
    purchaseDate: z.coerce.date().optional(),
    markedArrivedAt: z.coerce.date().nullable().optional(),
    TargetUnloadingDate: z.coerce.date().nullable().optional(),
    markedUnloadedAt: z.coerce.date().nullable().optional(),
    VehicleExitedAt: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) =>
      (Object.keys(data) as Array<keyof typeof data>).some((k) => data[k] !== undefined),
    { message: "At least one datetime field is required" }
  );

export type UpdatePurchaseManualDatetimesInput = z.infer<
  typeof UpdatePurchaseManualDatetimesSchema
>;

export const UpdatePurchaseGrnSchema = z.object({
  grnNumber: z.string().trim().min(1).nullable(),
});

export type UpdatePurchaseGrnInput = z.infer<typeof UpdatePurchaseGrnSchema>;
