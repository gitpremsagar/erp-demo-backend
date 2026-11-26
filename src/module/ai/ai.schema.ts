import { z } from "zod";

const PURCHASE_STATUS_VALUES = [
  "PENDING",
  "LOADING",
  "LOADED",
  "IN_TRANSIT",
  "ARRIVED",
  "UNLOADING",
  "UNLOADED",
  "EXITED",
  "COMPLETED",
] as const;

export const AiClientMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const AiActionResultSchema = z.object({
  proposalId: z.string().min(1).max(80),
  action: z.enum([
    "create_order_draft",
    "update_order_status",
    "verify_order_stock",
    "create_purchase",
    "update_purchase_status",
    "add_purchase_to_stock",
  ]),
  ok: z.boolean(),
  httpStatus: z.number().int().optional(),
  entityId: z.string().max(120).optional(),
  message: z.string().max(1000).optional(),
});

export const AiChatRequestSchema = z
  .object({
    messages: z.array(AiClientMessageSchema).min(1).max(30),
    context: z
      .object({
        page: z.string().max(300).optional(),
        entityType: z.string().max(40).optional(),
        entityId: z.string().max(120).optional(),
        entityLabel: z.string().max(200).optional(),
      })
      .optional(),
    actionResult: AiActionResultSchema.optional(),
    mode: z.enum(["sse", "json"]).optional().default("sse"),
  })
  .refine(
    (data) => data.messages.reduce((total, message) => total + message.content.length, 0) <= 24000,
    { message: "Conversation is too long. Start a new conversation." }
  );

const CellSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 150) : null;
  }
  return null;
}, z.string().nullable());

export const AiInvoiceParseRequestSchema = z.object({
  fileName: z.string().max(200).optional(),
  rows: z.array(z.array(CellSchema).max(20)).min(1).max(300),
  resolutions: z
    .array(
      z.object({
        rowIndex: z.number().int().min(0),
        productId: z.string().max(40).optional(),
        transporterId: z.string().max(40).optional(),
      })
    )
    .max(500)
    .optional(),
  allowAi: z.boolean().optional().default(true),
});

export const AiLineItemsRequestSchema = z.object({
  target: z.enum(["order", "purchase"]),
  text: z.string().trim().min(1).max(2000),
});

export const AiInsightRequestSchema = z.object({
  kind: z.enum([
    "sales_summary",
    "low_stock",
    "reorder_suggestions",
    "slow_movers",
    "pending_orders",
    "purchases_in_transit",
  ]),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  narrative: z.boolean().optional().default(false),
});

const LimitSchema = z.number().int().min(1).max(50).optional();

export const SearchOrdersArgsSchema = z.object({
  query: z.string().max(200).optional(),
  customerId: z.string().max(40).optional(),
  customerName: z.string().max(200).optional(),
  statusName: z.string().max(80).optional(),
  statusTypeId: z.string().max(40).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  includeCompleted: z.boolean().optional(),
  includeStatusSummary: z.boolean().optional(),
  limit: LimitSchema,
});

export const GetOrderArgsSchema = z.object({
  orderId: z.string().max(80).optional(),
  orderCode: z.string().max(120).optional(),
});

export const CustomerOrderHistoryArgsSchema = z
  .object({
    customerId: z.string().max(40).optional(),
    customerQuery: z
      .string()
      .max(200)
      .optional()
      .describe('Customer name, dbName, or "Name (Area)" as the user says it'),
    orderCount: z.number().int().min(1).max(25).optional(),
    statusScope: z
      .enum(["completed", "verified", "completed_or_verified", "all"])
      .optional(),
    inclusionRule: z.enum(["any", "majority", "latest"]).optional(),
    quantityRule: z.enum(["average", "latest", "max", "min"]).optional(),
  })
  .refine((data) => Boolean(data.customerId || data.customerQuery), {
    message: "Provide customerId or customerQuery (name/dbName, optionally with area)",
  });

export const SearchPurchasesArgsSchema = z.object({
  statuses: z.array(z.enum(PURCHASE_STATUS_VALUES)).max(10).optional(),
  transporterName: z.string().max(200).optional(),
  vehicleNumber: z.string().max(80).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  productId: z.string().max(40).optional(),
  productName: z.string().max(200).optional(),
  limit: LimitSchema,
});

export const GetPurchaseArgsSchema = z.object({
  purchaseId: z.string().min(1).max(40),
});

export const SearchProductsArgsSchema = z.object({
  query: z.string().max(200).optional(),
  queries: z.array(z.string().max(200)).max(10).optional(),
  productId: z.string().max(40).optional(),
  productIds: z.array(z.string().max(40)).max(25).optional(),
  productCode: z.string().max(80).optional(),
  productCodes: z.array(z.string().max(80)).max(25).optional(),
  includeBatches: z.boolean().optional(),
  includeDiscontinued: z.boolean().optional(),
  limit: LimitSchema,
});

export const SearchCustomersArgsSchema = z.object({
  query: z.string().max(200).optional(),
  queries: z.array(z.string().max(200)).max(10).optional(),
  limit: LimitSchema,
});

export const SearchTransportersArgsSchema = z.object({
  query: z.string().max(200).optional(),
  queries: z.array(z.string().max(200)).max(10).optional(),
  limit: LimitSchema,
});

export const ListOrderStatusTypesArgsSchema = z.object({});

export const SalesSummaryArgsSchema = z.object({
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  groupBy: z.enum(["none", "day", "product", "customer"]).optional().default("none"),
  limit: LimitSchema,
});

export const LowStockArgsSchema = z.object({
  mode: z.enum(["low_stock", "reorder", "slow_movers"]),
  threshold: z.number().int().min(0).max(1000000).optional(),
  lookbackDays: z.number().int().min(1).max(366).optional(),
  targetCoverDays: z.number().int().min(1).max(365).optional(),
  limit: LimitSchema,
});

/** A product can be referenced by id, exact code, or name; the server resolves it. */
const ProductRefSchema = z
  .object({
    productId: z.string().max(40).optional(),
    productCode: z.string().max(120).optional(),
    productName: z.string().max(200).optional(),
    quantity: z.number().int().min(1).max(100000),
  })
  .refine(
    (data) => Boolean(data.productId || data.productCode || data.productName),
    { message: "Provide productId, productCode, or productName" }
  );

export const ProposeCreateOrderDraftArgsSchema = z
  .object({
    customerId: z.string().max(40).optional(),
    customerQuery: z.string().max(200).optional(),
    items: z.array(ProductRefSchema).min(1).max(50),
    orderDate: z.string().max(40).optional(),
    vehicleId: z.string().max(40).optional(),
    driverId: z.string().max(40).optional(),
    narration: z.string().max(500).optional(),
  })
  .refine((data) => Boolean(data.customerId || data.customerQuery), {
    message: "Provide customerId or customerQuery (name/dbName/email/phone)",
  });

export const ProposeUpdateOrderStatusArgsSchema = z
  .object({
    orderId: z.string().max(80).optional(),
    orderCode: z.string().max(120).optional(),
    statusTypeId: z.string().max(40).optional(),
    statusName: z.string().max(80).optional(),
  })
  .refine((data) => Boolean(data.orderId || data.orderCode), {
    message: "Provide orderId or orderCode",
  })
  .refine((data) => Boolean(data.statusTypeId || data.statusName), {
    message: "Provide statusTypeId or statusName",
  });

export const ProposeVerifyOrderStockArgsSchema = z
  .object({
    orderId: z.string().max(80).optional(),
    orderCode: z.string().max(120).optional(),
  })
  .refine((data) => Boolean(data.orderId || data.orderCode), {
    message: "Provide orderId or orderCode",
  });

const PurchaseInvoiceInputSchema = z.object({
  invoiceID: z.string().min(1).max(120),
  invoiceDate: z.string().max(40).optional(),
  items: z.array(ProductRefSchema).min(1).max(100),
});

export const ProposeCreatePurchaseArgsSchema = z
  .object({
    transporterId: z.string().max(40).optional(),
    transporterQuery: z.string().max(200).optional(),
    vehicleNumber: z.string().max(80).optional(),
    driverContact: z.string().max(80).optional(),
    purchaseTransportStatus: z.enum(PURCHASE_STATUS_VALUES).optional(),
    markedArrivedAt: z.string().max(40).optional(),
    invoices: z.array(PurchaseInvoiceInputSchema).min(1).max(20),
  })
  .refine((data) => Boolean(data.transporterId || data.transporterQuery), {
    message: "Provide transporterId or transporterQuery (name)",
  });

const PurchaseIdentityFields = {
  purchaseId: z.string().max(80).optional(),
  grnNumber: z.string().max(120).optional(),
  invoiceID: z.string().max(120).optional(),
  vehicleNumber: z.string().max(80).optional(),
};

export const ProposeUpdatePurchaseStatusArgsSchema = z
  .object({
    ...PurchaseIdentityFields,
    purchaseTransportStatus: z.enum(PURCHASE_STATUS_VALUES),
  })
  .refine(
    (data) =>
      Boolean(
        data.purchaseId ||
          data.grnNumber ||
          data.invoiceID ||
          data.vehicleNumber
      ),
    { message: "Provide purchaseId, grnNumber, invoiceID, or vehicleNumber" }
  );

export const ProposeAddPurchaseToStockArgsSchema = z
  .object({
    ...PurchaseIdentityFields,
  })
  .refine(
    (data) =>
      Boolean(
        data.purchaseId ||
          data.grnNumber ||
          data.invoiceID ||
          data.vehicleNumber
      ),
    { message: "Provide purchaseId, grnNumber, invoiceID, or vehicleNumber" }
  );

export const BusinessOverviewArgsSchema = z.object({
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  includeLowStock: z.boolean().optional().default(true),
  includeReorder: z.boolean().optional().default(true),
  includePendingOrders: z.boolean().optional().default(true),
  includePurchasesInTransit: z.boolean().optional().default(true),
  limit: LimitSchema,
});

export type AiInvoiceParseRequestInput = z.infer<typeof AiInvoiceParseRequestSchema>;
export type AiLineItemsRequestInput = z.infer<typeof AiLineItemsRequestSchema>;
export type AiInsightRequestInput = z.infer<typeof AiInsightRequestSchema>;
