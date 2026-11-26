"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessOverviewArgsSchema = exports.ProposeUpdatePurchaseDatetimesArgsSchema = exports.ProposeUpdatePurchaseGrnArgsSchema = exports.ProposeAddPurchaseToStockArgsSchema = exports.ProposeUpdatePurchaseStatusArgsSchema = exports.ProposeCreatePurchaseArgsSchema = exports.ProposeVerifyOrderStockArgsSchema = exports.ProposeUpdateOrderStatusArgsSchema = exports.ProposeCreateOrderDraftArgsSchema = exports.LowStockArgsSchema = exports.SalesSummaryArgsSchema = exports.ListOrderStatusTypesArgsSchema = exports.SearchTransportersArgsSchema = exports.SearchCustomersArgsSchema = exports.SearchProductsArgsSchema = exports.ReconcilePurchaseArgsSchema = exports.PurchasePriceHistoryArgsSchema = exports.SupplierPurchaseHistoryArgsSchema = exports.PurchaseAnalyticsArgsSchema = exports.PurchaseWorkspaceArgsSchema = exports.GetPurchaseArgsSchema = exports.SearchPurchasesArgsSchema = exports.CustomerOrderHistoryArgsSchema = exports.GetOrderArgsSchema = exports.SearchOrdersArgsSchema = exports.AiInsightRequestSchema = exports.AiLineItemsRequestSchema = exports.AiInvoiceParseRequestSchema = exports.AiChatRequestSchema = exports.AiChatPurchaseRefSchema = exports.AiActionResultSchema = exports.AiClientMessageSchema = void 0;
const zod_1 = require("zod");
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
];
exports.AiClientMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(["user", "assistant"]),
    content: zod_1.z.string().trim().min(1).max(4000),
});
exports.AiActionResultSchema = zod_1.z.object({
    proposalId: zod_1.z.string().min(1).max(80),
    action: zod_1.z.enum([
        "create_order_draft",
        "update_order_status",
        "verify_order_stock",
        "create_purchase",
        "update_purchase_status",
        "add_purchase_to_stock",
    ]),
    ok: zod_1.z.boolean(),
    httpStatus: zod_1.z.number().int().optional(),
    entityId: zod_1.z.string().max(120).optional(),
    message: zod_1.z.string().max(1000).optional(),
});
exports.AiChatPurchaseRefSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(40),
    label: zod_1.z.string().max(200).optional(),
    status: zod_1.z.string().max(40).optional(),
    vehicleNumber: zod_1.z.string().max(80).nullable().optional(),
    transporter: zod_1.z.string().max(200).nullable().optional(),
});
exports.AiChatRequestSchema = zod_1.z
    .object({
    messages: zod_1.z.array(exports.AiClientMessageSchema).min(1).max(30),
    context: zod_1.z
        .object({
        page: zod_1.z.string().max(300).optional(),
        entityType: zod_1.z.string().max(40).optional(),
        entityId: zod_1.z.string().max(120).optional(),
        entityLabel: zod_1.z.string().max(200).optional(),
        assistant: zod_1.z.literal("purchase").optional(),
        filters: zod_1.z
            .object({
            unloadingFrom: zod_1.z.string().max(40).optional(),
            unloadingTo: zod_1.z.string().max(40).optional(),
        })
            .optional(),
        visiblePurchases: zod_1.z.array(exports.AiChatPurchaseRefSchema).max(80).optional(),
        selectedPurchase: exports.AiChatPurchaseRefSchema.optional(),
    })
        .optional(),
    actionResult: exports.AiActionResultSchema.optional(),
    mode: zod_1.z.enum(["sse", "json"]).optional().default("sse"),
})
    .refine((data) => data.messages.reduce((total, message) => total + message.content.length, 0) <= 24000, { message: "Conversation is too long. Start a new conversation." });
const CellSchema = zod_1.z.preprocess((value) => {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (typeof value === "string") {
        const text = value.replace(/\s+/g, " ").trim();
        return text ? text.slice(0, 150) : null;
    }
    return null;
}, zod_1.z.string().nullable());
exports.AiInvoiceParseRequestSchema = zod_1.z.object({
    fileName: zod_1.z.string().max(200).optional(),
    rows: zod_1.z.array(zod_1.z.array(CellSchema).max(20)).min(1).max(300),
    resolutions: zod_1.z
        .array(zod_1.z.object({
        rowIndex: zod_1.z.number().int().min(0),
        productId: zod_1.z.string().max(40).optional(),
        transporterId: zod_1.z.string().max(40).optional(),
    }))
        .max(500)
        .optional(),
    allowAi: zod_1.z.boolean().optional().default(true),
});
exports.AiLineItemsRequestSchema = zod_1.z.object({
    target: zod_1.z.enum(["order", "purchase"]),
    text: zod_1.z.string().trim().min(1).max(2000),
});
exports.AiInsightRequestSchema = zod_1.z.object({
    kind: zod_1.z.enum([
        "sales_summary",
        "low_stock",
        "reorder_suggestions",
        "slow_movers",
        "pending_orders",
        "purchases_in_transit",
    ]),
    params: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional().default({}),
    narrative: zod_1.z.boolean().optional().default(false),
});
const LimitSchema = zod_1.z.number().int().min(1).max(50).optional();
exports.SearchOrdersArgsSchema = zod_1.z.object({
    query: zod_1.z.string().max(200).optional(),
    customerId: zod_1.z.string().max(40).optional(),
    customerName: zod_1.z.string().max(200).optional(),
    statusName: zod_1.z.string().max(80).optional(),
    statusTypeId: zod_1.z.string().max(40).optional(),
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    includeCompleted: zod_1.z.boolean().optional(),
    includeStatusSummary: zod_1.z.boolean().optional(),
    limit: LimitSchema,
});
exports.GetOrderArgsSchema = zod_1.z.object({
    orderId: zod_1.z.string().max(80).optional(),
    orderCode: zod_1.z.string().max(120).optional(),
});
exports.CustomerOrderHistoryArgsSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().max(40).optional(),
    customerQuery: zod_1.z
        .string()
        .max(200)
        .optional()
        .describe('Customer name, dbName, or "Name (Area)" as the user says it'),
    orderCount: zod_1.z.number().int().min(1).max(25).optional(),
    statusScope: zod_1.z
        .enum(["completed", "verified", "completed_or_verified", "all"])
        .optional(),
    inclusionRule: zod_1.z.enum(["any", "majority", "latest"]).optional(),
    quantityRule: zod_1.z.enum(["average", "latest", "max", "min"]).optional(),
})
    .refine((data) => Boolean(data.customerId || data.customerQuery), {
    message: "Provide customerId or customerQuery (name/dbName, optionally with area)",
});
exports.SearchPurchasesArgsSchema = zod_1.z.object({
    statuses: zod_1.z.array(zod_1.z.enum(PURCHASE_STATUS_VALUES)).max(10).optional(),
    transporterName: zod_1.z.string().max(200).optional(),
    vehicleNumber: zod_1.z.string().max(80).optional(),
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    productId: zod_1.z.string().max(40).optional(),
    productName: zod_1.z.string().max(200).optional(),
    limit: LimitSchema,
});
exports.GetPurchaseArgsSchema = zod_1.z.object({
    purchaseId: zod_1.z.string().min(1).max(40),
});
const PurchaseStatusFilterSchema = zod_1.z.array(zod_1.z.enum(PURCHASE_STATUS_VALUES)).max(10).optional();
exports.PurchaseWorkspaceArgsSchema = zod_1.z.object({
    purchaseIds: zod_1.z.array(zod_1.z.string().max(40)).max(100).optional(),
    statuses: PurchaseStatusFilterSchema,
    unloadingFrom: zod_1.z.string().max(40).optional(),
    unloadingTo: zod_1.z.string().max(40).optional(),
    limit: LimitSchema,
});
exports.PurchaseAnalyticsArgsSchema = zod_1.z.object({
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    transporterName: zod_1.z.string().max(200).optional(),
    groupBy: zod_1.z.enum(["supplier", "month", "product", "status"]).optional(),
    limit: LimitSchema,
});
exports.SupplierPurchaseHistoryArgsSchema = zod_1.z
    .object({
    transporterId: zod_1.z.string().max(40).optional(),
    transporterQuery: zod_1.z.string().max(200).optional(),
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    limit: LimitSchema,
})
    .refine((data) => Boolean(data.transporterId || data.transporterQuery), {
    message: "Provide transporterId or transporterQuery (supplier name)",
});
exports.PurchasePriceHistoryArgsSchema = zod_1.z
    .object({
    productId: zod_1.z.string().max(40).optional(),
    productCode: zod_1.z.string().max(120).optional(),
    productName: zod_1.z.string().max(200).optional(),
    limit: LimitSchema,
})
    .refine((data) => Boolean(data.productId || data.productCode || data.productName), {
    message: "Provide productId, productCode, or productName",
});
exports.ReconcilePurchaseArgsSchema = zod_1.z.object({
    purchaseId: zod_1.z.string().max(80).optional(),
    grnNumber: zod_1.z.string().max(120).optional(),
    invoiceID: zod_1.z.string().max(120).optional(),
    vehicleNumber: zod_1.z.string().max(80).optional(),
});
exports.SearchProductsArgsSchema = zod_1.z.object({
    query: zod_1.z.string().max(200).optional(),
    queries: zod_1.z.array(zod_1.z.string().max(200)).max(10).optional(),
    productId: zod_1.z.string().max(40).optional(),
    productIds: zod_1.z.array(zod_1.z.string().max(40)).max(25).optional(),
    productCode: zod_1.z.string().max(80).optional(),
    productCodes: zod_1.z.array(zod_1.z.string().max(80)).max(25).optional(),
    includeBatches: zod_1.z.boolean().optional(),
    includeDiscontinued: zod_1.z.boolean().optional(),
    limit: LimitSchema,
});
exports.SearchCustomersArgsSchema = zod_1.z.object({
    query: zod_1.z.string().max(200).optional(),
    queries: zod_1.z.array(zod_1.z.string().max(200)).max(10).optional(),
    limit: LimitSchema,
});
exports.SearchTransportersArgsSchema = zod_1.z.object({
    query: zod_1.z.string().max(200).optional(),
    queries: zod_1.z.array(zod_1.z.string().max(200)).max(10).optional(),
    limit: LimitSchema,
});
exports.ListOrderStatusTypesArgsSchema = zod_1.z.object({});
exports.SalesSummaryArgsSchema = zod_1.z.object({
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    groupBy: zod_1.z.enum(["none", "day", "product", "customer"]).optional().default("none"),
    limit: LimitSchema,
});
exports.LowStockArgsSchema = zod_1.z.object({
    mode: zod_1.z.enum(["low_stock", "reorder", "slow_movers"]),
    threshold: zod_1.z.number().int().min(0).max(1000000).optional(),
    lookbackDays: zod_1.z.number().int().min(1).max(366).optional(),
    targetCoverDays: zod_1.z.number().int().min(1).max(365).optional(),
    limit: LimitSchema,
});
/** A product can be referenced by id, exact code, or name; the server resolves it. */
const ProductRefSchema = zod_1.z
    .object({
    productId: zod_1.z.string().max(40).optional(),
    productCode: zod_1.z.string().max(120).optional(),
    productName: zod_1.z.string().max(200).optional(),
    quantity: zod_1.z.number().int().min(1).max(100000),
})
    .refine((data) => Boolean(data.productId || data.productCode || data.productName), { message: "Provide productId, productCode, or productName" });
exports.ProposeCreateOrderDraftArgsSchema = zod_1.z
    .object({
    customerId: zod_1.z.string().max(40).optional(),
    customerQuery: zod_1.z.string().max(200).optional(),
    items: zod_1.z.array(ProductRefSchema).min(1).max(50),
    orderDate: zod_1.z.string().max(40).optional(),
    vehicleId: zod_1.z.string().max(40).optional(),
    driverId: zod_1.z.string().max(40).optional(),
    narration: zod_1.z.string().max(500).optional(),
})
    .refine((data) => Boolean(data.customerId || data.customerQuery), {
    message: "Provide customerId or customerQuery (name/dbName/email/phone)",
});
exports.ProposeUpdateOrderStatusArgsSchema = zod_1.z
    .object({
    orderId: zod_1.z.string().max(80).optional(),
    orderCode: zod_1.z.string().max(120).optional(),
    statusTypeId: zod_1.z.string().max(40).optional(),
    statusName: zod_1.z.string().max(80).optional(),
})
    .refine((data) => Boolean(data.orderId || data.orderCode), {
    message: "Provide orderId or orderCode",
})
    .refine((data) => Boolean(data.statusTypeId || data.statusName), {
    message: "Provide statusTypeId or statusName",
});
exports.ProposeVerifyOrderStockArgsSchema = zod_1.z
    .object({
    orderId: zod_1.z.string().max(80).optional(),
    orderCode: zod_1.z.string().max(120).optional(),
})
    .refine((data) => Boolean(data.orderId || data.orderCode), {
    message: "Provide orderId or orderCode",
});
const PurchaseInvoiceInputSchema = zod_1.z.object({
    invoiceID: zod_1.z.string().min(1).max(120),
    invoiceDate: zod_1.z.string().max(40).optional(),
    items: zod_1.z.array(ProductRefSchema).min(1).max(100),
});
exports.ProposeCreatePurchaseArgsSchema = zod_1.z
    .object({
    transporterId: zod_1.z.string().max(40).optional(),
    transporterQuery: zod_1.z.string().max(200).optional(),
    vehicleNumber: zod_1.z.string().max(80).optional(),
    driverContact: zod_1.z.string().max(80).optional(),
    purchaseTransportStatus: zod_1.z.enum(PURCHASE_STATUS_VALUES).optional(),
    markedArrivedAt: zod_1.z.string().max(40).optional(),
    invoices: zod_1.z.array(PurchaseInvoiceInputSchema).min(1).max(20),
})
    .refine((data) => Boolean(data.transporterId || data.transporterQuery), {
    message: "Provide transporterId or transporterQuery (name)",
});
const PurchaseIdentityFields = {
    purchaseId: zod_1.z.string().max(80).optional(),
    grnNumber: zod_1.z.string().max(120).optional(),
    invoiceID: zod_1.z.string().max(120).optional(),
    vehicleNumber: zod_1.z.string().max(80).optional(),
};
exports.ProposeUpdatePurchaseStatusArgsSchema = zod_1.z
    .object({
    ...PurchaseIdentityFields,
    purchaseTransportStatus: zod_1.z.enum(PURCHASE_STATUS_VALUES),
})
    .refine((data) => Boolean(data.purchaseId ||
    data.grnNumber ||
    data.invoiceID ||
    data.vehicleNumber), { message: "Provide purchaseId, grnNumber, invoiceID, or vehicleNumber" });
exports.ProposeAddPurchaseToStockArgsSchema = zod_1.z
    .object({
    ...PurchaseIdentityFields,
})
    .refine((data) => Boolean(data.purchaseId ||
    data.grnNumber ||
    data.invoiceID ||
    data.vehicleNumber), { message: "Provide purchaseId, grnNumber, invoiceID, or vehicleNumber" });
exports.ProposeUpdatePurchaseGrnArgsSchema = zod_1.z
    .object({
    purchaseId: zod_1.z.string().max(80).optional(),
    vehicleNumber: zod_1.z.string().max(80).optional(),
    invoiceID: zod_1.z.string().max(120).optional(),
    currentGrnNumber: zod_1.z.string().max(120).optional(),
    grnNumber: zod_1.z.string().trim().min(1).max(120),
})
    .refine((data) => Boolean(data.purchaseId ||
    data.vehicleNumber ||
    data.invoiceID ||
    data.currentGrnNumber), {
    message: "Provide purchaseId, vehicleNumber, invoiceID, or currentGrnNumber to identify the purchase",
});
exports.ProposeUpdatePurchaseDatetimesArgsSchema = zod_1.z
    .object({
    ...PurchaseIdentityFields,
    purchaseDate: zod_1.z.string().max(40).optional(),
    markedArrivedAt: zod_1.z.string().max(40).nullable().optional(),
    TargetUnloadingDate: zod_1.z.string().max(40).nullable().optional(),
    markedUnloadedAt: zod_1.z.string().max(40).nullable().optional(),
    VehicleExitedAt: zod_1.z.string().max(40).nullable().optional(),
})
    .refine((data) => Boolean(data.purchaseId ||
    data.grnNumber ||
    data.invoiceID ||
    data.vehicleNumber), { message: "Provide purchaseId, grnNumber, invoiceID, or vehicleNumber" })
    .refine((data) => data.purchaseDate !== undefined ||
    data.markedArrivedAt !== undefined ||
    data.TargetUnloadingDate !== undefined ||
    data.markedUnloadedAt !== undefined ||
    data.VehicleExitedAt !== undefined, { message: "Provide at least one datetime field to update" });
exports.BusinessOverviewArgsSchema = zod_1.z.object({
    dateFrom: zod_1.z.string().max(40).optional(),
    dateTo: zod_1.z.string().max(40).optional(),
    includeLowStock: zod_1.z.boolean().optional().default(true),
    includeReorder: zod_1.z.boolean().optional().default(true),
    includePendingOrders: zod_1.z.boolean().optional().default(true),
    includePurchasesInTransit: zod_1.z.boolean().optional().default(true),
    limit: LimitSchema,
});
//# sourceMappingURL=ai.schema.js.map