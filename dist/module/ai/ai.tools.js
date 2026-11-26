"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_TOOLS = exports.PROPOSAL_TOOL_NAMES = void 0;
exports.isProposalTool = isProposalTool;
exports.toolLabel = toolLabel;
exports.executeReadTool = executeReadTool;
exports.executeProposalTool = executeProposalTool;
const ai_schema_1 = require("./ai.schema");
const ai_tools_read_1 = require("./ai.tools.read");
const ai_proposals_1 = require("./ai.proposals");
const ai_utils_1 = require("./ai.utils");
exports.PROPOSAL_TOOL_NAMES = new Set([
    "propose_create_order_draft",
    "propose_update_order_status",
    "propose_verify_order_stock",
    "propose_create_purchase",
    "propose_update_purchase_status",
    "propose_add_purchase_to_stock",
]);
function isProposalTool(name) {
    return exports.PROPOSAL_TOOL_NAMES.has(name);
}
const stringProp = (description) => ({ type: "string", description });
const numberProp = (description) => ({ type: "number", description });
const booleanProp = (description) => ({ type: "boolean", description });
exports.AI_TOOLS = [
    {
        type: "function",
        function: {
            name: "search_orders",
            description: "Search orders with filters. Returns compact order rows including status, customer, cartons, and product lines. Excludes unfinalized distributor drafts. Uses the last 30 days for general searches, but open-status searches (PENDING etc.) span all time unless dates are provided.",
            parameters: {
                type: "object",
                properties: {
                    query: stringProp("Free text: order code, customer name, or distributor name"),
                    customerId: stringProp("Customer (User) id"),
                    customerName: stringProp("Customer or distributor name"),
                    statusName: stringProp("Exact dynamic order status name, e.g. PENDING or FINALIZED"),
                    statusTypeId: stringProp("OrderStatusType id"),
                    dateFrom: stringProp("Start date YYYY-MM-DD"),
                    dateTo: stringProp("End date YYYY-MM-DD"),
                    includeCompleted: booleanProp("Include completed orders (default false)"),
                    includeStatusSummary: booleanProp("Also return counts grouped by status"),
                    limit: numberProp("Max rows (1-25, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_order",
            description: "Get one order by internal id or customer-facing order code. Returns customer, status, verification, dates, lines, cartons, and stock-record count.",
            parameters: {
                type: "object",
                properties: {
                    orderId: stringProp("Internal order id (24-char ObjectId)"),
                    orderCode: stringProp("Customer-facing order code (customeOrderId)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "customer_order_history",
            description: "REQUIRED before suggesting or drafting any repeat/reorder order from a customer's purchase history. Resolves the customer, reads their last N orders with line items (no 30-day cutoff, completed/verified orders included), and computes per-product frequency, cartons, averages, inclusion under the chosen rule, suggested quantities, and anomaly/data-quality notes. Returns real order codes, dates, statuses, line items, and totals. Never invent these numbers; call this tool and use its result.",
            parameters: {
                type: "object",
                properties: {
                    customerId: stringProp("Customer id if already known"),
                    customerQuery: stringProp('Customer name/dbName, optionally with area as the user says it, e.g. "Pasari Traders (Bankura)"'),
                    orderCount: numberProp("How many recent orders to evaluate (1-25, default 10)"),
                    statusScope: {
                        type: "string",
                        enum: ["completed", "verified", "completed_or_verified", "all"],
                        description: 'Which orders count as usable history. Default "completed_or_verified". Use "all" only if the default returns too few orders, and say so.',
                    },
                    inclusionRule: {
                        type: "string",
                        enum: ["any", "majority", "latest"],
                        description: 'Which products to include: "any" = appeared in any order, "majority" = appeared in at least half the orders (default), "latest" = only the most recent order.',
                    },
                    quantityRule: {
                        type: "string",
                        enum: ["average", "latest", "max", "min"],
                        description: 'How to set cartons: "average" across the orders where the product appeared, rounded (default); "latest" copies the most recent quantity; "max"; "min".',
                    },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_purchases",
            description: "Search purchases with status/transporter/vehicle/date/product filters. Returns invoices, line counts, cartons, invoice totals, and whether stock has been added.",
            parameters: {
                type: "object",
                properties: {
                    statuses: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: [
                                "PENDING",
                                "LOADING",
                                "LOADED",
                                "IN_TRANSIT",
                                "ARRIVED",
                                "UNLOADING",
                                "UNLOADED",
                                "EXITED",
                                "COMPLETED",
                            ],
                        },
                        description: "One or more transport statuses",
                    },
                    transporterName: stringProp("Transporter/supplier name"),
                    vehicleNumber: stringProp("Vehicle number fragment"),
                    dateFrom: stringProp("Invoice start date YYYY-MM-DD"),
                    dateTo: stringProp("Invoice end date YYYY-MM-DD"),
                    productId: stringProp("Product id to filter purchases containing it"),
                    productName: stringProp("Product name fragment to filter purchases"),
                    limit: numberProp("Max rows (1-25, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_purchase",
            description: "Get one purchase by id. Returns invoices/items, planned batches, stock-added state, pricing completeness, and lifecycle timestamps.",
            parameters: {
                type: "object",
                properties: {
                    purchaseId: stringProp("Purchase id (24-char ObjectId)"),
                },
                required: ["purchaseId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_products",
            description: "Search products by name, code, or id. Pass multiple values in queries/productCodes/productIds to resolve many products in ONE call. Returns current live stock, low-stock limit, pricing fields, and optionally FIFO batches.",
            parameters: {
                type: "object",
                properties: {
                    query: stringProp("Product name or code fragment"),
                    queries: {
                        type: "array",
                        items: { type: "string" },
                        description: "Multiple product name/code fragments, resolved in one query",
                    },
                    productId: stringProp("Product id"),
                    productIds: {
                        type: "array",
                        items: { type: "string" },
                        description: "Multiple product ids",
                    },
                    productCode: stringProp("Exact product code"),
                    productCodes: {
                        type: "array",
                        items: { type: "string" },
                        description: "Multiple exact product codes",
                    },
                    includeBatches: booleanProp("Include on-hand FIFO batches"),
                    includeDiscontinued: booleanProp("Include discontinued products (default false)"),
                    limit: numberProp("Max rows (1-50, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_customers",
            description: "Search distributor/customer accounts by name, email, phone, or dbName. Pass multiple values in queries to resolve several customers in ONE call.",
            parameters: {
                type: "object",
                properties: {
                    query: stringProp("Customer name, email, phone, or dbName fragment"),
                    queries: {
                        type: "array",
                        items: { type: "string" },
                        description: "Multiple customer name/email/phone/dbName fragments",
                    },
                    limit: numberProp("Max rows (1-25, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_transporters",
            description: "Search transporters/suppliers by name. Pass multiple values in queries to resolve several transporters in ONE call.",
            parameters: {
                type: "object",
                properties: {
                    query: stringProp("Transporter name fragment"),
                    queries: {
                        type: "array",
                        items: { type: "string" },
                        description: "Multiple transporter name fragments",
                    },
                    limit: numberProp("Max rows (1-25, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_order_status_types",
            description: "List all dynamic order status types with ids and display names. Use before changing an order status.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "sales_summary",
            description: "Sales totals for verified orders over a date range, with top products/customers and optional day/product/customer series. Max range 366 days, max 2000 orders.",
            parameters: {
                type: "object",
                properties: {
                    dateFrom: stringProp("Start date YYYY-MM-DD (default 30 days ago)"),
                    dateTo: stringProp("End date YYYY-MM-DD (default today)"),
                    groupBy: {
                        type: "string",
                        enum: ["none", "day", "product", "customer"],
                        description: "Optional series grouping",
                    },
                    limit: numberProp("Top rows per list (1-25, default 10)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "low_stock_and_reorder",
            description: "Stock insights. mode=low_stock lists products at/below threshold; mode=reorder suggests cartons to buy based on verified sales velocity; mode=slow_movers lists stocked products with no/low sales.",
            parameters: {
                type: "object",
                properties: {
                    mode: {
                        type: "string",
                        enum: ["low_stock", "reorder", "slow_movers"],
                    },
                    threshold: numberProp("Optional stock threshold, or sales threshold for slow_movers"),
                    lookbackDays: numberProp("Sales lookback in days (default 60)"),
                    targetCoverDays: numberProp("Target days of cover for reorder (default 30)"),
                    limit: numberProp("Max rows (1-25, default 15)"),
                },
                required: ["mode"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "business_overview",
            description: "One-call business snapshot: verified sales totals, low stock, reorder suggestions, pending orders, and purchases in transit. Runs these queries in parallel. The response is complete for the requested sections; do not also call sales_summary, low_stock_and_reorder, search_orders, or search_purchases unless you need different filters or more rows.",
            parameters: {
                type: "object",
                properties: {
                    dateFrom: stringProp("Sales start date YYYY-MM-DD (default 30 days ago)"),
                    dateTo: stringProp("Sales end date YYYY-MM-DD (default today)"),
                    includeLowStock: booleanProp("Include low-stock products (default true)"),
                    includeReorder: booleanProp("Include reorder suggestions (default true)"),
                    includePendingOrders: booleanProp("Include open orders (default true)"),
                    includePurchasesInTransit: booleanProp("Include in-transit purchases (default true)"),
                    limit: numberProp("Rows per section (1-25, default 15)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_create_order_draft",
            description: "Propose a new unverified PENDING order draft. This DOES NOT create anything; it returns a confirmation card. The server resolves the customer and every product from names/codes in ONE pass, so you can pass natural names or exact codes directly — no prior search tools are required.",
            parameters: {
                type: "object",
                properties: {
                    customerId: stringProp("Customer id, if already known"),
                    customerQuery: stringProp("Customer name/dbName/email/phone; resolved server-side with fuzzy matching"),
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: stringProp("Product id, if already known"),
                                productCode: stringProp("Exact product code; resolved server-side"),
                                productName: stringProp("Product name; resolved server-side with fuzzy matching"),
                                quantity: numberProp("Cartons (integer >= 1)"),
                            },
                        },
                        description: "Order lines (max 50); each line needs productId, productCode, or productName",
                    },
                    orderDate: stringProp("Order date YYYY-MM-DD (default today)"),
                    vehicleId: stringProp("Optional vehicle id"),
                    driverId: stringProp("Optional driver id"),
                    narration: stringProp("Optional note"),
                },
                required: ["items"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_update_order_status",
            description: "Propose a dynamic order status change. This DOES NOT change anything; it returns a confirmation card. Pass the order id or customer-facing order code and statusName/statusTypeId. The server resolves the order and status and returns the current status in the preview; no get_order or list_order_status_types pre-fetch is required.",
            parameters: {
                type: "object",
                properties: {
                    orderId: stringProp("Order id or order code"),
                    orderCode: stringProp("Customer-facing order code (customeOrderId)"),
                    statusTypeId: stringProp("OrderStatusType id"),
                    statusName: stringProp("OrderStatusType exact name, e.g. FINALIZED"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_verify_order_stock",
            description: "Propose verifying stock for an unverified order. This DOES NOT change anything; it returns a high-risk confirmation card. Pass the order id or order code; the server resolves and validates it, including the stock check, so no get_order pre-fetch is required. Verifying deducts FIFO stock and creates StockRecords.",
            parameters: {
                type: "object",
                properties: {
                    orderId: stringProp("Order id or order code"),
                    orderCode: stringProp("Customer-facing order code (customeOrderId)"),
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_create_purchase",
            description: "Propose a new purchase with one or more invoices. This DOES NOT create anything; it returns a confirmation card. The server resolves the transporter and all products from names/codes in one pass, so no prior search tools are required. Creates staging batches only (no on-hand stock).",
            parameters: {
                type: "object",
                properties: {
                    transporterId: stringProp("Transporter id, if already known"),
                    transporterQuery: stringProp("Transporter/supplier name; resolved server-side with fuzzy matching"),
                    vehicleNumber: stringProp("Optional vehicle number"),
                    driverContact: stringProp("Optional driver contact"),
                    purchaseTransportStatus: {
                        type: "string",
                        enum: [
                            "PENDING",
                            "LOADING",
                            "LOADED",
                            "IN_TRANSIT",
                            "ARRIVED",
                            "UNLOADING",
                            "UNLOADED",
                            "EXITED",
                            "COMPLETED",
                        ],
                    },
                    markedArrivedAt: stringProp("Optional arrival date YYYY-MM-DD"),
                    invoices: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                invoiceID: stringProp("Supplier invoice number"),
                                invoiceDate: stringProp("Invoice date YYYY-MM-DD"),
                                items: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            productId: stringProp("Product id, if already known"),
                                            productCode: stringProp("Exact product code; resolved server-side"),
                                            productName: stringProp("Product name; resolved server-side"),
                                            quantity: numberProp("Cartons (integer >= 1)"),
                                        },
                                        required: ["quantity"],
                                    },
                                },
                            },
                            required: ["invoiceID", "items"],
                        },
                    },
                },
                required: ["invoices"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_update_purchase_status",
            description: "Propose a purchase transport status change. This DOES NOT change anything; it returns a confirmation card. Pass purchase id, GRN, invoice number, or vehicle number; the server resolves and validates it, so no search_purchases pre-fetch is required. COMPLETED also transfers planned stock into inventory, and requires complete pricing.",
            parameters: {
                type: "object",
                properties: {
                    purchaseId: stringProp("Purchase id, or a GRN/invoice/vehicle fragment"),
                    grnNumber: stringProp("GRN number"),
                    invoiceID: stringProp("Supplier invoice number"),
                    vehicleNumber: stringProp("Vehicle number"),
                    purchaseTransportStatus: {
                        type: "string",
                        enum: [
                            "PENDING",
                            "LOADING",
                            "LOADED",
                            "IN_TRANSIT",
                            "ARRIVED",
                            "UNLOADING",
                            "UNLOADED",
                            "EXITED",
                            "COMPLETED",
                        ],
                    },
                },
                required: ["purchaseTransportStatus"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "propose_add_purchase_to_stock",
            description: "Propose transferring a purchase's planned batches into live stock. This DOES NOT change anything; it returns a high-risk confirmation card. Pass purchase id, GRN, invoice number, or vehicle number; the server resolves it. Fails if stock was already added.",
            parameters: {
                type: "object",
                properties: {
                    purchaseId: stringProp("Purchase id, or a GRN/invoice/vehicle fragment"),
                    grnNumber: stringProp("GRN number"),
                    invoiceID: stringProp("Supplier invoice number"),
                    vehicleNumber: stringProp("Vehicle number"),
                },
            },
        },
    },
];
const TOOL_LABELS = {
    search_orders: "Searching orders",
    get_order: "Opening order",
    customer_order_history: "Evaluating customer order history",
    search_purchases: "Searching purchases",
    get_purchase: "Opening purchase",
    search_products: "Searching products",
    search_customers: "Searching customers",
    search_transporters: "Searching transporters",
    list_order_status_types: "Listing order statuses",
    sales_summary: "Summarizing sales",
    low_stock_and_reorder: "Checking stock and reorder needs",
    business_overview: "Building business overview",
    propose_create_order_draft: "Preparing draft order",
    propose_update_order_status: "Preparing status change",
    propose_verify_order_stock: "Preparing stock verification",
    propose_create_purchase: "Preparing purchase",
    propose_update_purchase_status: "Preparing purchase status change",
    propose_add_purchase_to_stock: "Preparing add-to-stock",
};
function toolLabel(name) {
    return TOOL_LABELS[name] ?? "Working";
}
function parseArgs(rawArgs) {
    if (!rawArgs || !rawArgs.trim())
        return {};
    const parsed = (0, ai_utils_1.safeJsonParse)(rawArgs);
    if (parsed === null) {
        throw new Error("Tool arguments must be valid JSON.");
    }
    return parsed;
}
function formatZodError(error) {
    return error.issues
        .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
        .join("; ");
}
function validate(schema, rawArgs) {
    const parsed = schema.safeParse(parseArgs(rawArgs));
    if (!parsed.success) {
        throw new Error(`Invalid arguments: ${formatZodError(parsed.error)}`);
    }
    return parsed.data;
}
function summarizeReadResult(tool, result) {
    const value = result;
    switch (tool) {
        case "search_orders":
            return `${value.count ?? 0} order(s) found${value.truncated ? " (truncated)" : ""}`;
        case "get_order":
            return `Order ${String(value.orderCode ?? value.id ?? "")}`;
        case "customer_order_history":
            if (value.needsCustomer) {
                return `Customer needs disambiguation (${(value.candidates?.length ?? 0)} candidate(s))`;
            }
            return `${value.ordersUsed ?? 0} order(s) evaluated, ${String(value.suggestion?.lineCount ?? 0)} suggested line(s)`;
        case "search_purchases":
            return `${value.count ?? 0} purchase(s) found${value.truncated ? " (truncated)" : ""}`;
        case "get_purchase":
            return `Purchase ${String(value.id ?? "")}`;
        case "search_products":
            return `${value.count ?? 0} product(s) found${value.truncated ? " (truncated)" : ""}`;
        case "search_customers":
            return `${value.count ?? 0} customer(s) found${value.truncated ? " (truncated)" : ""}`;
        case "search_transporters":
            return `${value.count ?? 0} transporter(s) found${value.truncated ? " (truncated)" : ""}`;
        case "list_order_status_types":
            return `${value.statusTypes?.length ?? 0} status type(s)`;
        case "sales_summary":
            return `${value.orderCount ?? 0} order(s), total ${String(value.totalSaleFormatted ?? "")}`;
        case "low_stock_and_reorder":
            return `${value.count ?? 0} product(s) in ${String(value.mode ?? "result")}`;
        case "business_overview":
            return "Business snapshot ready";
        default:
            return "Tool completed";
    }
}
async function withTimeout(promise, timeoutMs, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
async function executeReadTool(name, rawArgs) {
    const timeoutMs = Number(process.env.AI_TOOL_TIMEOUT_MS) || 10000;
    try {
        let result;
        switch (name) {
            case "search_orders":
                result = await withTimeout((0, ai_tools_read_1.searchOrders)(validate(ai_schema_1.SearchOrdersArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "get_order":
                result = await withTimeout((0, ai_tools_read_1.getOrder)(validate(ai_schema_1.GetOrderArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "customer_order_history":
                result = await withTimeout((0, ai_tools_read_1.customerOrderHistory)(validate(ai_schema_1.CustomerOrderHistoryArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "search_purchases":
                result = await withTimeout((0, ai_tools_read_1.searchPurchases)(validate(ai_schema_1.SearchPurchasesArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "get_purchase":
                result = await withTimeout((0, ai_tools_read_1.getPurchase)(validate(ai_schema_1.GetPurchaseArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "search_products":
                result = await withTimeout((0, ai_tools_read_1.searchProducts)(validate(ai_schema_1.SearchProductsArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "search_customers":
                result = await withTimeout((0, ai_tools_read_1.searchCustomers)(validate(ai_schema_1.SearchCustomersArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "search_transporters":
                result = await withTimeout((0, ai_tools_read_1.searchTransporters)(validate(ai_schema_1.SearchTransportersArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "list_order_status_types":
                validate(ai_schema_1.ListOrderStatusTypesArgsSchema, rawArgs);
                result = await withTimeout((0, ai_tools_read_1.listOrderStatusTypes)(), timeoutMs, name);
                break;
            case "sales_summary":
                result = await withTimeout((0, ai_tools_read_1.salesSummary)(validate(ai_schema_1.SalesSummaryArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "low_stock_and_reorder":
                result = await withTimeout((0, ai_tools_read_1.lowStockAndReorder)(validate(ai_schema_1.LowStockArgsSchema, rawArgs)), timeoutMs, name);
                break;
            case "business_overview":
                result = await withTimeout((0, ai_tools_read_1.businessOverview)(validate(ai_schema_1.BusinessOverviewArgsSchema, rawArgs)), timeoutMs, name);
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        // Order-history evidence (orders + lines + aggregates + suggestion) is
        // intentionally larger than a normal list result; keep all of it so the
        // model never sees a half-truncated suggestion.
        const contentLimit = name === "customer_order_history" ? 48000 : 24000;
        return {
            ok: true,
            content: (0, ai_utils_1.truncateText)(JSON.stringify(result), contentLimit),
            summary: summarizeReadResult(name, result),
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Tool failed";
        return {
            ok: false,
            content: (0, ai_utils_1.summaryJson)({ error: message }),
            summary: message,
        };
    }
}
async function executeProposalTool(name, rawArgs, actorId) {
    switch (name) {
        case "propose_create_order_draft":
            return (0, ai_proposals_1.proposeCreateOrderDraft)(validate(ai_schema_1.ProposeCreateOrderDraftArgsSchema, rawArgs), actorId);
        case "propose_update_order_status":
            return (0, ai_proposals_1.proposeUpdateOrderStatus)(validate(ai_schema_1.ProposeUpdateOrderStatusArgsSchema, rawArgs));
        case "propose_verify_order_stock":
            return (0, ai_proposals_1.proposeVerifyOrderStock)(validate(ai_schema_1.ProposeVerifyOrderStockArgsSchema, rawArgs));
        case "propose_create_purchase":
            return (0, ai_proposals_1.proposeCreatePurchase)(validate(ai_schema_1.ProposeCreatePurchaseArgsSchema, rawArgs));
        case "propose_update_purchase_status":
            return (0, ai_proposals_1.proposeUpdatePurchaseStatus)(validate(ai_schema_1.ProposeUpdatePurchaseStatusArgsSchema, rawArgs));
        case "propose_add_purchase_to_stock":
            return (0, ai_proposals_1.proposeAddPurchaseToStock)(validate(ai_schema_1.ProposeAddPurchaseToStockArgsSchema, rawArgs));
        default:
            throw new Error(`Unknown proposal tool: ${name}`);
    }
}
//# sourceMappingURL=ai.tools.js.map