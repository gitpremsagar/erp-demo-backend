"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchOrders = searchOrders;
exports.getOrder = getOrder;
exports.customerOrderHistory = customerOrderHistory;
exports.searchPurchases = searchPurchases;
exports.getPurchase = getPurchase;
exports.searchProducts = searchProducts;
exports.searchCustomers = searchCustomers;
exports.searchTransporters = searchTransporters;
exports.listOrderStatusTypes = listOrderStatusTypes;
exports.salesSummary = salesSummary;
exports.lowStockAndReorder = lowStockAndReorder;
exports.businessOverview = businessOverview;
exports.compactMoney = compactMoney;
exports.formatQuantity = formatQuantity;
exports.productLookup = productLookup;
exports.purchaseWorkspace = purchaseWorkspace;
exports.purchaseAnalytics = purchaseAnalytics;
exports.supplierPurchaseHistory = supplierPurchaseHistory;
exports.purchasePriceHistory = purchasePriceHistory;
exports.reconcilePurchase = reconcilePurchase;
const prisma_1 = require("../../lib/prisma");
const orderSaleAmount_1 = require("../../lib/orderSaleAmount");
const orderItemPriceSnapshot_1 = require("../../lib/orderItemPriceSnapshot");
const purchaseItemPriceSnapshot_1 = require("../../lib/purchaseItemPriceSnapshot");
const purchasePricing_1 = require("../purchase/purchasePricing");
const ai_catalogCache_1 = require("./ai.catalogCache");
const ai_matching_1 = require("./ai.matching");
const ai_resolve_1 = require("./ai.resolve");
const ai_utils_1 = require("./ai.utils");
const COMPLETED_STATUS_NAMES = ["COMPLETE", "COMPLETED"];
const distributorDraftVisibility = {
    NOT: {
        isFinalizedByDistributor: false,
        OrderCreator: { is: { userType: "CUSTOMER" } },
    },
};
const historyCustomerSelect = {
    id: true,
    name: true,
    CustomerDetail: {
        select: { dbName: true, dbCategory: true, area: true, state: true },
        take: 1,
    },
};
function rankHistoryCustomers(customers, name, raw, qualifier) {
    const normalizedQuery = (0, ai_utils_1.normalizeText)(name);
    const normalizedRawQuery = (0, ai_utils_1.normalizeText)(raw);
    return customers
        .map((customer) => {
        const detail = customer.CustomerDetail[0];
        const dbName = detail?.dbName ?? customer.name;
        const normalizedDbName = (0, ai_utils_1.normalizeText)(dbName);
        const normalizedContactName = (0, ai_utils_1.normalizeText)(customer.name);
        let score = Math.max((0, ai_utils_1.similarity)(name, dbName), (0, ai_utils_1.similarity)(name, customer.name));
        if (normalizedDbName === normalizedQuery || normalizedDbName === normalizedRawQuery) {
            score += 10;
        }
        if (normalizedContactName === normalizedQuery ||
            normalizedContactName === normalizedRawQuery) {
            score += 8;
        }
        else if (normalizedQuery.length >= 3 &&
            (normalizedDbName.includes(normalizedQuery) ||
                normalizedQuery.includes(normalizedDbName))) {
            score += 2;
        }
        if (qualifier) {
            const normalizedQualifier = (0, ai_utils_1.normalizeText)(qualifier);
            const area = (0, ai_utils_1.normalizeText)(detail?.area);
            const state = (0, ai_utils_1.normalizeText)(detail?.state);
            if (area &&
                (area.includes(normalizedQualifier) || normalizedQualifier.includes(area))) {
                score += 6;
            }
            else if (state &&
                (state.includes(normalizedQualifier) || normalizedQualifier.includes(state))) {
                score += 3;
            }
        }
        return { customer, dbName, score };
    })
        .sort((a, b) => b.score - a.score);
}
function isDecisiveCustomerMatch(scored) {
    const best = scored[0];
    const second = scored[1];
    if (!best)
        return false;
    return (scored.length === 1 ||
        (second ? best.score - second.score >= 4 : true) ||
        best.score >= 12);
}
function statusLabel(status) {
    if (!status)
        return "No status";
    return status.displayName?.trim() || status.name || "Unknown";
}
function compactProductMap(products) {
    return new Map(products.map((product) => [product.id, product]));
}
async function searchOrders(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 10, 25);
    const hasDateFilter = Boolean(args.dateFrom || args.dateTo);
    const hasOpenStatusFilter = Boolean(args.statusName || args.statusTypeId || args.includeCompleted === false);
    const range = (0, ai_utils_1.resolveDateRange)(args.dateFrom, args.dateTo, 30, 366);
    // Open-status searches should not be hidden by the default 30-day window.
    const applyDefaultDateWindow = !hasDateFilter && !hasOpenStatusFilter;
    const and = [distributorDraftVisibility];
    if (hasDateFilter || applyDefaultDateWindow) {
        and.push({ orderDate: { gte: range.fromDate, lte: range.toDate } });
    }
    if (args.customerId)
        and.push({ customerId: args.customerId });
    if (args.statusTypeId)
        and.push({ orderStatusTypeId: args.statusTypeId });
    if (args.statusName) {
        and.push({ OrderStatusType: { is: { name: args.statusName } } });
    }
    if (!args.includeCompleted) {
        and.push({
            NOT: {
                OrderStatusType: { is: { name: { in: COMPLETED_STATUS_NAMES } } },
            },
        });
    }
    if (args.customerName) {
        and.push({
            OR: [
                { Customer: { is: { name: { contains: args.customerName, mode: "insensitive" } } } },
                {
                    Customer: {
                        is: {
                            CustomerDetail: {
                                some: { dbName: { contains: args.customerName, mode: "insensitive" } },
                            },
                        },
                    },
                },
            ],
        });
    }
    const query = (0, ai_utils_1.pickString)(args.query);
    if (query) {
        and.push({
            OR: [
                { customeOrderId: { contains: query, mode: "insensitive" } },
                { Customer: { is: { name: { contains: query, mode: "insensitive" } } } },
                {
                    Customer: {
                        is: {
                            CustomerDetail: {
                                some: { dbName: { contains: query, mode: "insensitive" } },
                            },
                        },
                    },
                },
            ],
        });
    }
    const where = { AND: and };
    const orders = await prisma_1.prisma.order.findMany({
        where,
        take: limit + 1,
        orderBy: { orderDate: "desc" },
        select: {
            id: true,
            customeOrderId: true,
            orderDate: true,
            deliveryDate: true,
            isVerifiedByAdmin: true,
            isFinalizedByDistributor: true,
            receivingStatus: true,
            orderStatusTypeId: true,
            OrderStatusType: { select: { id: true, name: true, displayName: true } },
            Customer: {
                select: {
                    id: true,
                    name: true,
                    CustomerDetail: {
                        select: { dbName: true, dbCategory: true },
                        take: 1,
                    },
                },
            },
            OrderItem: {
                select: {
                    quantity: true,
                    Product: { select: { id: true, name: true, productCode: true, mrp: true } },
                },
            },
        },
    });
    const truncated = orders.length > limit;
    const rows = orders.slice(0, limit).map((order) => ({
        id: order.id,
        orderCode: order.customeOrderId,
        orderDate: (0, ai_utils_1.istDateString)(order.orderDate),
        deliveryDate: order.deliveryDate ? (0, ai_utils_1.istDateString)(order.deliveryDate) : null,
        status: statusLabel(order.OrderStatusType),
        statusTypeId: order.orderStatusTypeId,
        customer: order.Customer?.CustomerDetail?.[0]?.dbName || order.Customer?.name || "Unknown",
        category: order.Customer?.CustomerDetail?.[0]?.dbCategory ?? null,
        verified: Boolean(order.isVerifiedByAdmin),
        finalizedByDistributor: order.isFinalizedByDistributor,
        receivingStatus: order.receivingStatus,
        lines: order.OrderItem.length,
        cartons: order.OrderItem.reduce((sum, item) => sum + item.quantity, 0),
        products: order.OrderItem.slice(0, 8).map((item) => ({
            name: item.Product?.name,
            code: item.Product?.productCode,
            mrp: item.Product?.mrp ?? null,
            quantity: item.quantity,
        })),
    }));
    let statusSummary;
    if (args.includeStatusSummary) {
        const statusRows = await prisma_1.prisma.order.findMany({
            where,
            take: 5000,
            select: { orderStatusTypeId: true },
        });
        const counts = new Map();
        for (const row of statusRows) {
            const key = row.orderStatusTypeId ?? "";
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const catalog = await (0, ai_catalogCache_1.getCatalog)();
        const statusById = new Map(catalog.statusTypes.map((status) => [status.id, status]));
        statusSummary = [...counts.entries()]
            .map(([statusTypeId, count]) => ({
            status: statusLabel(statusById.get(statusTypeId) ?? null),
            count,
        }))
            .sort((a, b) => b.count - a.count);
    }
    return {
        from: hasDateFilter || applyDefaultDateWindow ? range.from : null,
        to: hasDateFilter || applyDefaultDateWindow ? range.to : null,
        count: rows.length,
        truncated,
        statusSummary,
        orders: rows,
    };
}
async function getOrder(args) {
    const key = (0, ai_utils_1.pickString)(args.orderId) ?? (0, ai_utils_1.pickString)(args.orderCode);
    if (!key)
        throw new Error("Provide orderId or orderCode");
    const order = await prisma_1.prisma.order.findFirst({
        where: /^[a-f\d]{24}$/i.test(key)
            ? { id: key }
            : { customeOrderId: key },
        select: {
            id: true,
            customeOrderId: true,
            orderDate: true,
            deliveryDate: true,
            completionDate: true,
            narration: true,
            isVerifiedByAdmin: true,
            verifiedAt: true,
            isFinalizedByDistributor: true,
            receivingStatus: true,
            orderStatusTypeId: true,
            OrderStatusType: { select: { id: true, name: true, displayName: true } },
            Customer: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    CustomerDetail: {
                        select: { dbName: true, dbCategory: true, area: true, state: true },
                        take: 1,
                    },
                },
            },
            OrderItem: {
                select: {
                    quantity: true,
                    schemeDiscountPercent: true,
                    itemDiscountPercent: true,
                    pricingTier: true,
                    gstPercentage: true,
                    packetsPerCarton: true,
                    costPricePerCarton: true,
                    costPricePerPacket: true,
                    sellingPricePerCartonForDb: true,
                    sellingPricePerPacketForDb: true,
                    sellingPricePerCartonForRss: true,
                    sellingPricePerPacketForRss: true,
                    Product: { select: { id: true, name: true, productCode: true, mrp: true } },
                },
            },
            _count: { select: { StockRecord: true } },
        },
    });
    if (!order)
        throw new Error("Order not found");
    const lines = order.OrderItem.map((item) => {
        const rates = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(item);
        return {
            product: item.Product?.name ?? "Unknown",
            code: item.Product?.productCode ?? null,
            mrp: item.Product?.mrp ?? null,
            quantity: item.quantity,
            ratePerCarton: rates?.carton ?? null,
            gstPercent: rates?.gstPercent ?? null,
            estimatedLineTotal: rates ? item.quantity * rates.carton * (1 + rates.gstPercent / 100) : null,
        };
    });
    return {
        id: order.id,
        orderCode: order.customeOrderId,
        status: statusLabel(order.OrderStatusType),
        statusTypeId: order.orderStatusTypeId,
        customer: order.Customer?.CustomerDetail?.[0]?.dbName || order.Customer?.name || "Unknown",
        customerName: order.Customer?.name,
        customerPhone: order.Customer?.phone ?? null,
        category: order.Customer?.CustomerDetail?.[0]?.dbCategory ?? null,
        area: order.Customer?.CustomerDetail?.[0]?.area ?? null,
        state: order.Customer?.CustomerDetail?.[0]?.state ?? null,
        orderDate: (0, ai_utils_1.istDateString)(order.orderDate),
        deliveryDate: order.deliveryDate ? (0, ai_utils_1.istDateString)(order.deliveryDate) : null,
        completionDate: order.completionDate ? (0, ai_utils_1.istDateString)(order.completionDate) : null,
        verified: Boolean(order.isVerifiedByAdmin),
        verifiedAt: order.verifiedAt ? (0, ai_utils_1.istDateString)(order.verifiedAt) : null,
        finalizedByDistributor: order.isFinalizedByDistributor,
        receivingStatus: order.receivingStatus,
        narration: order.narration ?? null,
        stockRecordCount: order._count.StockRecord,
        lines,
        totalCartons: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
}
function splitCustomerQuery(raw) {
    const parenthetical = raw.match(/^(.*?)\s*[\(\[]\s*([^)\]]+?)\s*[\)\]]\s*$/);
    if (parenthetical?.[1]?.trim() && parenthetical[2]?.trim()) {
        return { name: parenthetical[1].trim(), qualifier: parenthetical[2].trim() };
    }
    return { name: raw.trim(), qualifier: null };
}
function historyOrderScope(scope) {
    const completed = {
        OR: [
            { OrderStatusType: { is: { name: { in: COMPLETED_STATUS_NAMES } } } },
            { status: "COMPLETED" },
            { completionDate: { not: null } },
        ],
    };
    if (scope === "completed")
        return completed;
    if (scope === "verified")
        return { isVerifiedByAdmin: true };
    if (scope === "completed_or_verified") {
        return { OR: [completed, { isVerifiedByAdmin: true }] };
    }
    return null;
}
function isCompletedHistoryOrder(order) {
    return (Boolean(order.completionDate) ||
        order.status === "COMPLETED" ||
        COMPLETED_STATUS_NAMES.includes(order.OrderStatusType?.name ?? ""));
}
function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function round1(value) {
    return Math.round(value * 10) / 10;
}
async function resolveHistoryCustomer(args) {
    if (args.customerId) {
        const customer = await prisma_1.prisma.user.findFirst({
            where: { id: args.customerId, userType: "CUSTOMER" },
            select: historyCustomerSelect,
        });
        if (!customer)
            throw new Error("Customer not found for the supplied customerId");
        return { customer, candidates: [], needsDisambiguation: false };
    }
    const raw = (0, ai_utils_1.pickString)(args.customerQuery);
    if (!raw)
        throw new Error("Provide customerId or customerQuery");
    const { name, qualifier } = splitCustomerQuery(raw);
    if (!name)
        throw new Error("Customer name is empty");
    const customers = await prisma_1.prisma.user.findMany({
        where: {
            userType: "CUSTOMER",
            OR: [
                { name: { contains: name, mode: "insensitive" } },
                {
                    CustomerDetail: {
                        some: { dbName: { contains: name, mode: "insensitive" } },
                    },
                },
            ],
        },
        take: 30,
        select: historyCustomerSelect,
    });
    let scored = rankHistoryCustomers(customers, name, raw, qualifier);
    // The DB prefilter is only a shortcut. If it did not produce a clear winner,
    // do a bounded in-memory scan so casing, punctuation, or extra words do not
    // hide a real customer (e.g. "sri bajrang traders").
    if (!isDecisiveCustomerMatch(scored)) {
        const allCustomers = await prisma_1.prisma.user.findMany({
            where: { userType: "CUSTOMER" },
            take: 5000,
            select: historyCustomerSelect,
        });
        const rescored = rankHistoryCustomers(allCustomers, name, raw, qualifier).filter((entry) => entry.score >= 0.6);
        if (!scored.length || (rescored[0]?.score ?? 0) > (scored[0]?.score ?? 0)) {
            scored = rescored;
        }
    }
    if (scored.length === 0) {
        return { customer: null, candidates: [], needsDisambiguation: true };
    }
    const best = scored[0];
    const second = scored[1];
    const decisive = scored.length === 1 ||
        (second ? best.score - second.score >= 4 : true) ||
        best.score >= 12;
    if (!decisive) {
        return {
            customer: null,
            candidates: scored.slice(0, 5).map((entry) => {
                const detail = entry.customer.CustomerDetail[0];
                return {
                    id: entry.customer.id,
                    name: entry.dbName,
                    contactName: entry.customer.name,
                    area: detail?.area ?? null,
                    state: detail?.state ?? null,
                    category: detail?.dbCategory ?? null,
                };
            }),
            needsDisambiguation: true,
        };
    }
    return { customer: best.customer, candidates: [], needsDisambiguation: false };
}
/**
 * Deterministic reorder evaluation. Reads the customer's recent orders and returns
 * the evidence (orders + line items), per-product statistics, the suggestion under
 * the requested inclusion/quantity rules, and data-quality/anomaly notes.
 * The model must not invent any of these numbers; it reads them from this result.
 */
async function customerOrderHistory(args) {
    const orderCount = (0, ai_utils_1.toPositiveInt)(args.orderCount, 10, 25);
    const statusScope = args.statusScope ?? "completed_or_verified";
    const inclusionRule = args.inclusionRule ?? "any";
    const quantityRule = args.quantityRule ?? "average";
    const resolved = await resolveHistoryCustomer(args);
    if (!resolved.customer) {
        const query = (0, ai_utils_1.pickString)(args.customerQuery) ?? "";
        return {
            needsCustomer: true,
            customerQuery: query,
            candidates: resolved.candidates,
            guidance: resolved.candidates.length
                ? "The customer name is ambiguous or not an exact match. Ask the user which account they mean, then call this tool again with that customerId or the exact dbName plus area. Do not guess."
                : "No customer matched that name. Ask the user for the exact account name/dbName plus area. Do not proceed with invented data.",
        };
    }
    const customer = resolved.customer;
    const detail = customer.CustomerDetail[0];
    const customerInfo = {
        id: customer.id,
        name: detail?.dbName ?? customer.name,
        contactName: customer.name,
        area: detail?.area ?? null,
        state: detail?.state ?? null,
        category: detail?.dbCategory ?? null,
    };
    const baseWhere = {
        AND: [distributorDraftVisibility, { customerId: customer.id }],
    };
    const completedScope = historyOrderScope("completed");
    const [completedCount, verifiedCount, allCount] = await Promise.all([
        prisma_1.prisma.order.count({ where: { AND: [baseWhere, completedScope] } }),
        prisma_1.prisma.order.count({ where: { AND: [baseWhere, { isVerifiedByAdmin: true }] } }),
        prisma_1.prisma.order.count({ where: baseWhere }),
    ]);
    const scopeWhere = historyOrderScope(statusScope);
    const orders = await prisma_1.prisma.order.findMany({
        where: scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere,
        orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
        take: orderCount,
        select: {
            id: true,
            customeOrderId: true,
            orderDate: true,
            completionDate: true,
            status: true,
            isVerifiedByAdmin: true,
            OrderStatusType: { select: { name: true, displayName: true } },
            OrderItem: {
                select: {
                    quantity: true,
                    Product: {
                        select: {
                            id: true,
                            name: true,
                            productCode: true,
                            mrp: true,
                            isDiscontinued: true,
                        },
                    },
                },
            },
        },
    });
    const availableCounts = {
        completed: completedCount,
        verified: verifiedCount,
        all: allCount,
    };
    if (orders.length === 0) {
        return {
            customer: customerInfo,
            statusScope,
            requestedOrderCount: orderCount,
            ordersUsed: 0,
            availableCounts,
            orders: [],
            products: [],
            suggestion: {
                inclusionRule,
                quantityRule,
                lineCount: 0,
                totalCartons: 0,
                lines: [],
            },
            anomalies: [],
            dataQuality: [
                `No orders matched statusScope="${statusScope}". Completed: ${completedCount}, verified: ${verifiedCount}, all non-draft orders: ${allCount}.`,
            ],
            guidance: "Do not invent order history or item quantities. If a broader scope has orders, say which scope you are switching to and call this tool again. Otherwise tell the user there is no usable history for this account.",
        };
    }
    const orderRecords = orders.map((order) => {
        const perProduct = new Map();
        for (const item of order.OrderItem) {
            const existing = perProduct.get(item.Product.id);
            if (existing)
                existing.quantity += item.quantity;
            else
                perProduct.set(item.Product.id, { product: item.Product, quantity: item.quantity });
        }
        const cartons = [...perProduct.values()].reduce((sum, entry) => sum + entry.quantity, 0);
        return { order, perProduct, cartons };
    });
    const aggregates = new Map();
    orderRecords.forEach((record, index) => {
        for (const entry of record.perProduct.values()) {
            let aggregate = aggregates.get(entry.product.id);
            if (!aggregate) {
                aggregate = {
                    id: entry.product.id,
                    code: entry.product.productCode,
                    name: entry.product.name,
                    mrp: entry.product.mrp,
                    isDiscontinued: Boolean(entry.product.isDiscontinued),
                    appearances: 0,
                    totalQuantity: 0,
                    quantities: [],
                    latestQuantity: null,
                    lastOrderDate: null,
                };
                aggregates.set(entry.product.id, aggregate);
            }
            aggregate.appearances += 1;
            aggregate.totalQuantity += entry.quantity;
            aggregate.quantities.push(entry.quantity);
            if (!aggregate.lastOrderDate) {
                aggregate.lastOrderDate = (0, ai_utils_1.istDateString)(record.order.orderDate);
            }
            if (index === 0)
                aggregate.latestQuantity = entry.quantity;
        }
    });
    const majorityThreshold = Math.ceil(orders.length / 2);
    const products = [...aggregates.values()]
        .map((aggregate) => {
        const averageQuantity = aggregate.totalQuantity / aggregate.appearances;
        const minQuantity = Math.min(...aggregate.quantities);
        const maxQuantity = Math.max(...aggregate.quantities);
        const included = inclusionRule === "any"
            ? aggregate.appearances >= 1
            : inclusionRule === "latest"
                ? aggregate.latestQuantity !== null
                : aggregate.appearances >= majorityThreshold;
        let suggestedCartons;
        let quantityBasis;
        if (quantityRule === "latest") {
            suggestedCartons = aggregate.latestQuantity ?? Math.round(averageQuantity);
            quantityBasis = aggregate.latestQuantity !== null ? "latest order" : "average";
        }
        else if (quantityRule === "max") {
            suggestedCartons = maxQuantity;
            quantityBasis = "max";
        }
        else if (quantityRule === "min") {
            suggestedCartons = minQuantity;
            quantityBasis = "min";
        }
        else {
            suggestedCartons = Math.round(averageQuantity);
            quantityBasis = "average";
        }
        suggestedCartons = Math.max(1, suggestedCartons);
        const flags = [];
        if (aggregate.appearances === 1)
            flags.push("appeared in only one order");
        if (maxQuantity >= minQuantity * 2 && aggregate.appearances >= 3) {
            flags.push(`quantity varies ${minQuantity}-${maxQuantity} cartons`);
        }
        if (aggregate.latestQuantity === null)
            flags.push("not in the latest order");
        if (quantityRule === "latest" && aggregate.latestQuantity === null) {
            flags.push("latest quantity unavailable; used average");
        }
        if (aggregate.isDiscontinued)
            flags.push("product is discontinued");
        return {
            id: aggregate.id,
            code: aggregate.code,
            name: aggregate.name,
            mrp: aggregate.mrp,
            appearances: aggregate.appearances,
            ordersUsed: orders.length,
            frequency: round1(aggregate.appearances / orders.length),
            totalCartons: aggregate.totalQuantity,
            averageCartons: round1(averageQuantity),
            minCartons: minQuantity,
            maxCartons: maxQuantity,
            lastCartons: aggregate.latestQuantity,
            lastOrderDate: aggregate.lastOrderDate,
            included,
            includedInSuggestion: included && !aggregate.isDiscontinued,
            suggestedCartons,
            quantityBasis,
            isDiscontinued: aggregate.isDiscontinued,
            flags,
            evidence: `in ${aggregate.appearances}/${orders.length} orders; avg ${round1(averageQuantity)}; last ${aggregate.latestQuantity ?? "-"}`,
        };
    })
        .sort((a, b) => {
        if (a.includedInSuggestion !== b.includedInSuggestion) {
            return a.includedInSuggestion ? -1 : 1;
        }
        if (a.appearances !== b.appearances)
            return b.appearances - a.appearances;
        return b.totalCartons - a.totalCartons;
    });
    const maxProducts = 60;
    const productsTruncated = products.length > maxProducts;
    const visibleProducts = products.slice(0, maxProducts);
    const suggestionLines = visibleProducts
        .filter((product) => product.includedInSuggestion)
        .map((product) => ({
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        mrp: product.mrp,
        quantity: product.suggestedCartons,
        quantityBasis: product.quantityBasis,
        evidence: product.evidence,
    }));
    const orderSummaries = orderRecords.map((record) => ({
        id: record.order.id,
        code: record.order.customeOrderId,
        date: (0, ai_utils_1.istDateString)(record.order.orderDate),
        status: statusLabel(record.order.OrderStatusType),
        verified: Boolean(record.order.isVerifiedByAdmin),
        completed: isCompletedHistoryOrder(record.order),
        cartons: record.cartons,
        lineCount: record.perProduct.size,
        lines: [...record.perProduct.values()].map((entry) => ({
            code: entry.product.productCode,
            name: entry.product.name,
            mrp: entry.product.mrp,
            qty: entry.quantity,
        })),
    }));
    const anomalies = [];
    const dataQuality = [];
    if (orders.length < orderCount) {
        dataQuality.push(`Only ${orders.length} order(s) matched statusScope="${statusScope}"; requested ${orderCount}. Available counts: ${completedCount} completed, ${verifiedCount} verified, ${allCount} total.`);
    }
    if (orders.length < 3) {
        dataQuality.push(`Only ${orders.length} order(s) used. Averages from fewer than 3 orders are unstable; prefer showing the individual orders and asking the user.`);
    }
    const unverifiedOpen = orderSummaries.filter((order) => !order.verified && !order.completed).length;
    if (unverifiedOpen > 0) {
        dataQuality.push(`${unverifiedOpen} of ${orders.length} order(s) are neither verified nor completed. Confirm with the user whether they belong in the history.`);
    }
    const latest = orderRecords[0];
    const older = orderRecords.slice(1);
    if (older.length >= 2) {
        const olderAverage = mean(older.map((record) => record.cartons));
        if (latest.cartons > 0 && latest.cartons < olderAverage * 0.5) {
            anomalies.push(`Latest order ${latest.order.customeOrderId} (${(0, ai_utils_1.istDateString)(latest.order.orderDate)}) has ${latest.cartons} cartons, less than half the average of the previous ${older.length} orders (${Math.round(olderAverage)}). Averages may overstate the next order.`);
        }
        if (latest.cartons > olderAverage * 2) {
            anomalies.push(`Latest order ${latest.order.customeOrderId} (${(0, ai_utils_1.istDateString)(latest.order.orderDate)}) has ${latest.cartons} cartons, more than double the average of the previous ${older.length} orders (${Math.round(olderAverage)}). Averages may understate the next order.`);
        }
    }
    const latestAgeDays = Math.floor((Date.now() - latest.order.orderDate.getTime()) / 86400000);
    if (latestAgeDays > 180) {
        anomalies.push(`The most recent usable order is ${latestAgeDays} days old (${(0, ai_utils_1.istDateString)(latest.order.orderDate)}). Confirm the pattern is still relevant.`);
    }
    const oneOffProducts = products.filter((product) => product.appearances === 1);
    if (inclusionRule !== "any" && oneOffProducts.length) {
        anomalies.push(`${oneOffProducts.length} product(s) appeared only once and are excluded by the "${inclusionRule}" rule: ${oneOffProducts
            .slice(0, 5)
            .map((product) => product.name)
            .join(", ")}${oneOffProducts.length > 5 ? ", ..." : ""}.`);
    }
    const variableProducts = products.filter((product) => product.appearances >= 3 &&
        product.maxCartons >= product.minCartons * 2);
    if (variableProducts.length) {
        anomalies.push(`${variableProducts.length} product(s) have 2x-or-more quantity swings: ${variableProducts
            .slice(0, 5)
            .map((product) => `${product.name} (${product.minCartons}-${product.maxCartons})`)
            .join(", ")}${variableProducts.length > 5 ? ", ..." : ""}. Consider whether to use min/max instead of average for these.`);
    }
    const discontinuedProducts = products.filter((product) => product.isDiscontinued);
    if (discontinuedProducts.length) {
        anomalies.push(`${discontinuedProducts.length} discontinued product(s) appeared in history and were left out of the suggestion: ${discontinuedProducts
            .slice(0, 5)
            .map((product) => product.name)
            .join(", ")}${discontinuedProducts.length > 5 ? ", ..." : ""}.`);
    }
    if (productsTruncated) {
        dataQuality.push(`Product list truncated to ${maxProducts} of ${products.length} products; the suggestion uses only the visible products.`);
    }
    return {
        customer: customerInfo,
        statusScope,
        requestedOrderCount: orderCount,
        ordersUsed: orders.length,
        ordersDateRange: {
            from: (0, ai_utils_1.istDateString)(orders[orders.length - 1].orderDate),
            to: (0, ai_utils_1.istDateString)(orders[0].orderDate),
        },
        availableCounts,
        rules: {
            inclusionRule,
            quantityRule,
            includeIf: inclusionRule === "any"
                ? `appeared in at least one of the last ${orders.length} evaluated orders`
                : inclusionRule === "latest"
                    ? "present in the most recent evaluated order"
                    : `appeared in at least ${majorityThreshold} of ${orders.length} evaluated orders`,
        },
        orders: orderSummaries,
        products: visibleProducts,
        suggestion: {
            inclusionRule,
            quantityRule,
            lineCount: suggestionLines.length,
            totalCartons: suggestionLines.reduce((sum, line) => sum + line.quantity, 0),
            lines: suggestionLines,
        },
        anomalies,
        dataQuality,
        guidance: "Use only this result for the draft. Show the user the orders used and the suggestion lines with the rule labels. Mention any anomalies/dataQuality notes and ask whether to use the default rules before preparing the draft. If the user explicitly asked to prepare it immediately, you may call propose_create_order_draft with exactly these suggestion lines and quantities, but still state the evidence and rules in your message. Never invent or estimate a quantity.",
    };
}
async function searchPurchases(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 10, 25);
    const range = (0, ai_utils_1.resolveDateRange)(args.dateFrom, args.dateTo, 30, 366);
    const and = [];
    if (args.statuses?.length) {
        and.push({ purchaseTransportStatus: { in: args.statuses } });
    }
    if (args.transporterName) {
        and.push({ Transporter: { is: { name: { contains: args.transporterName } } } });
    }
    if (args.vehicleNumber) {
        and.push({ vehicleNumber: { contains: args.vehicleNumber } });
    }
    const hasDateFilter = Boolean(args.dateFrom || args.dateTo);
    if (hasDateFilter) {
        and.push({
            PurchaseInvoice: {
                some: { invoiceDate: { gte: range.fromDate, lte: range.toDate } },
            },
        });
    }
    if (args.productId || args.productName) {
        and.push({
            PurchaseInvoice: {
                some: {
                    PurchaseInvoiceItem: {
                        some: {
                            ...(args.productId ? { productId: args.productId } : {}),
                            ...(args.productName
                                ? { product: { is: { name: { contains: args.productName } } } }
                                : {}),
                        },
                    },
                },
            },
        });
    }
    const purchases = await prisma_1.prisma.purchase.findMany({
        where: { AND: and },
        take: limit + 1,
        orderBy: { createdAt: "desc" },
        include: {
            Transporter: { select: { id: true, name: true } },
            PurchaseInvoice: {
                select: {
                    id: true,
                    invoiceID: true,
                    invoiceDate: true,
                    invoiceAmount: true,
                    PurchaseInvoiceItem: {
                        select: {
                            productId: true,
                            quantity: true,
                            product: { select: { name: true, productCode: true } },
                        },
                    },
                },
            },
            purchaseStockBatches: { select: { productId: true, stockQuantity: true } },
            _count: { select: { stockBatches: true } },
        },
    });
    const truncated = purchases.length > limit;
    const rows = purchases.slice(0, limit).map((purchase) => {
        const items = purchase.PurchaseInvoice.flatMap((invoice) => invoice.PurchaseInvoiceItem);
        return {
            id: purchase.id,
            status: purchase.purchaseTransportStatus,
            transporter: purchase.Transporter?.name ?? "Unknown",
            vehicleNumber: purchase.vehicleNumber ?? null,
            driverContact: purchase.driverContact ?? null,
            grnNumber: purchase.grnNumber ?? null,
            createdAt: (0, ai_utils_1.istDateString)(purchase.createdAt),
            invoices: purchase.PurchaseInvoice.length,
            invoiceIDs: purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID).filter(Boolean),
            lines: items.length,
            cartons: items.reduce((sum, item) => sum + item.quantity, 0),
            invoiceTotal: purchase.PurchaseInvoice.reduce((sum, invoice) => sum + (invoice.invoiceAmount ?? 0), 0),
            stockAdded: purchase._count.stockBatches > 0,
            products: items.slice(0, 8).map((item) => ({
                name: item.product?.name,
                code: item.product?.productCode,
                quantity: item.quantity,
            })),
        };
    });
    return {
        from: hasDateFilter ? range.from : null,
        to: hasDateFilter ? range.to : null,
        count: rows.length,
        truncated,
        purchases: rows,
    };
}
async function getPurchase(args) {
    const purchase = await prisma_1.prisma.purchase.findUnique({
        where: { id: args.purchaseId },
        include: {
            Transporter: { select: { id: true, name: true, transporterContact: true } },
            PurchaseInvoice: {
                include: {
                    PurchaseInvoiceItem: {
                        include: {
                            product: { select: { id: true, name: true, productCode: true } },
                        },
                    },
                },
            },
            purchaseStockBatches: {
                include: { product: { select: { id: true, name: true, productCode: true } } },
            },
            stockBatches: { select: { id: true } },
        },
    });
    if (!purchase)
        throw new Error("Purchase not found");
    return {
        id: purchase.id,
        status: purchase.purchaseTransportStatus,
        transporter: purchase.Transporter?.name ?? "Unknown",
        transporterId: purchase.transporterId,
        vehicleNumber: purchase.vehicleNumber ?? null,
        driverContact: purchase.driverContact ?? null,
        grnNumber: purchase.grnNumber ?? null,
        createdAt: (0, ai_utils_1.istDateString)(purchase.createdAt),
        markedArrivedAt: purchase.markedArrivedAt ? (0, ai_utils_1.istDateString)(purchase.markedArrivedAt) : null,
        markedUnloadedAt: purchase.markedUnloadedAt ? (0, ai_utils_1.istDateString)(purchase.markedUnloadedAt) : null,
        markedCompletedAt: purchase.markedCompletedAt ? (0, ai_utils_1.istDateString)(purchase.markedCompletedAt) : null,
        stockAdded: purchase.stockBatches.length > 0,
        stockAddedAt: purchase.stockAddedAt ? (0, ai_utils_1.istDateString)(purchase.stockAddedAt) : null,
        pricingComplete: (0, purchasePricing_1.isPurchasePricingComplete)(purchase.PurchaseInvoice),
        invoices: purchase.PurchaseInvoice.map((invoice) => ({
            invoiceID: invoice.invoiceID,
            invoiceDate: invoice.invoiceDate ? (0, ai_utils_1.istDateString)(invoice.invoiceDate) : null,
            invoiceAmount: invoice.invoiceAmount ?? 0,
            items: invoice.PurchaseInvoiceItem.map((item) => ({
                product: item.product?.name ?? "Unknown",
                code: item.product?.productCode ?? null,
                quantity: item.quantity,
                mrp: item.mrp,
                costPricePerCarton: item.costPricePerCarton,
                costPricePerPacket: item.costPricePerPacket,
            })),
        })),
        plannedBatches: purchase.purchaseStockBatches.map((batch) => ({
            product: batch.product?.name ?? "Unknown",
            code: batch.product?.productCode ?? null,
            quantity: batch.stockQuantity,
            arrivalDate: (0, ai_utils_1.istDateString)(batch.arrivalDate),
            expiryDate: (0, ai_utils_1.istDateString)(batch.expiryDate),
        })),
    };
}
async function searchProducts(args) {
    const queries = [
        ...new Set([(0, ai_utils_1.pickString)(args.query), ...(args.queries ?? [])].filter((value) => Boolean(value))),
    ];
    const codes = [
        ...new Set([(0, ai_utils_1.pickString)(args.productCode), ...(args.productCodes ?? [])].filter((value) => Boolean(value))),
    ];
    const ids = [
        ...new Set([(0, ai_utils_1.pickString)(args.productId), ...(args.productIds ?? [])].filter((value) => Boolean(value))),
    ];
    const batchCount = queries.length + codes.length + ids.length;
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, batchCount > 1 ? Math.min(50, Math.max(10, batchCount * 3)) : 10, 50);
    const or = [];
    if (ids.length)
        or.push({ id: { in: ids } });
    if (codes.length)
        or.push({ productCode: { in: codes } });
    for (const query of queries) {
        or.push({ name: { contains: query } }, { productCode: { contains: query } });
    }
    const and = [];
    if (!args.includeDiscontinued) {
        and.push({ OR: [{ isDiscontinued: false }, { isDiscontinued: null }] });
    }
    if (or.length)
        and.push({ OR: or });
    const products = await prisma_1.prisma.product.findMany({
        where: and.length ? { AND: and } : {},
        take: limit + 1,
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            productCode: true,
            mrp: true,
            lowStockLimit: true,
            isDiscontinued: true,
            packetsPerCarton: true,
            gstPercentage: true,
            costPricePerCarton: true,
            costPricePerPacket: true,
        },
    });
    const truncated = products.length > limit;
    const rows = products.slice(0, limit);
    const productIds = rows.map((product) => product.id);
    const stockGrouped = productIds.length
        ? await prisma_1.prisma.stockBatch.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds }, stockQuantity: { gt: 0 } },
            _sum: { stockQuantity: true },
        })
        : [];
    const stockByProduct = new Map(stockGrouped.map((row) => [row.productId, row._sum.stockQuantity ?? 0]));
    let batchesByProduct;
    if (args.includeBatches && productIds.length) {
        const batches = await prisma_1.prisma.stockBatch.findMany({
            where: { productId: { in: productIds }, stockQuantity: { gt: 0 } },
            orderBy: { arrivalDate: "asc" },
            select: {
                id: true,
                productId: true,
                stockQuantity: true,
                arrivalDate: true,
                expiryDate: true,
            },
        });
        batchesByProduct = new Map();
        for (const batch of batches) {
            const list = batchesByProduct.get(batch.productId) ?? [];
            list.push({
                id: batch.id,
                quantity: batch.stockQuantity,
                arrivalDate: (0, ai_utils_1.istDateString)(batch.arrivalDate),
                expiryDate: (0, ai_utils_1.istDateString)(batch.expiryDate),
            });
            batchesByProduct.set(batch.productId, list);
        }
    }
    const mapped = rows.map((product) => ({
        id: product.id,
        name: product.name,
        code: product.productCode,
        mrp: product.mrp,
        currentStock: stockByProduct.get(product.id) ?? 0,
        lowStockLimit: product.lowStockLimit,
        discontinued: product.isDiscontinued === true,
        packetsPerCarton: product.packetsPerCarton,
        gstPercent: product.gstPercentage,
        costPricePerCarton: product.costPricePerCarton,
        costPricePerPacket: product.costPricePerPacket,
        batches: batchesByProduct?.get(product.id),
    }));
    const queryMatches = queries.map((query) => {
        const match = (0, ai_matching_1.matchCandidate)(query, mapped.map((product) => ({
            id: product.id,
            name: product.name,
            productCode: product.code,
        })));
        return {
            query,
            productId: match.match?.id ?? null,
            candidates: match.candidates.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                code: candidate.productCode ?? null,
            })),
        };
    });
    const codeMatches = codes.map((code) => ({
        code,
        productId: mapped.find((product) => (0, ai_utils_1.normalizeCode)(product.code) === (0, ai_utils_1.normalizeCode)(code))?.id ?? null,
    }));
    return {
        count: mapped.length,
        truncated,
        products: mapped,
        queryMatches: queries.length ? queryMatches : undefined,
        codeMatches: codes.length ? codeMatches : undefined,
    };
}
async function searchCustomers(args) {
    const queries = [
        ...new Set([(0, ai_utils_1.pickString)(args.query), ...(args.queries ?? [])].filter((value) => Boolean(value))),
    ];
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, queries.length > 1 ? Math.min(25, Math.max(10, queries.length * 3)) : 10, 25);
    const where = { userType: "CUSTOMER" };
    if (queries.length) {
        where.OR = queries.flatMap((query) => [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { CustomerDetail: { some: { dbName: { contains: query, mode: "insensitive" } } } },
        ]);
    }
    const customers = await prisma_1.prisma.user.findMany({
        where,
        take: limit + 1,
        orderBy: { name: "asc" },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            CustomerDetail: {
                select: {
                    dbName: true,
                    dbCategory: true,
                    area: true,
                    state: true,
                    creditLimit: true,
                    paymentTerms: true,
                },
                take: 1,
            },
        },
    });
    const truncated = customers.length > limit;
    const mapped = customers.slice(0, limit).map((customer) => {
        const detail = customer.CustomerDetail[0];
        return {
            id: customer.id,
            dbName: detail?.dbName ?? customer.name,
            contactName: customer.name,
            email: customer.email,
            phone: customer.phone,
            category: detail?.dbCategory ?? null,
            area: detail?.area ?? null,
            state: detail?.state ?? null,
            creditLimit: detail?.creditLimit ?? null,
            paymentTerms: detail?.paymentTerms ?? null,
        };
    });
    const queryMatches = queries.map((query) => {
        const match = (0, ai_matching_1.matchCandidate)(query, mapped.map((customer) => ({ id: customer.id, name: customer.dbName })));
        return {
            query,
            customerId: match.match?.id ?? null,
            candidates: match.candidates.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
            })),
        };
    });
    return {
        count: mapped.length,
        truncated,
        customers: mapped,
        queryMatches: queries.length ? queryMatches : undefined,
    };
}
async function searchTransporters(args) {
    const queries = [
        ...new Set([(0, ai_utils_1.pickString)(args.query), ...(args.queries ?? [])].filter((value) => Boolean(value))),
    ];
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, queries.length > 1 ? Math.min(25, Math.max(10, queries.length * 3)) : 10, 25);
    const transporters = await prisma_1.prisma.transporter.findMany({
        where: queries.length
            ? { OR: queries.map((query) => ({ name: { contains: query, mode: "insensitive" } })) }
            : {},
        take: limit + 1,
        orderBy: { name: "asc" },
        select: { id: true, name: true, transporterContact: true, area: true },
    });
    const mapped = transporters.slice(0, limit);
    const queryMatches = queries.map((query) => {
        const match = (0, ai_matching_1.matchCandidate)(query, mapped);
        return {
            query,
            transporterId: match.match?.id ?? null,
            candidates: match.candidates.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
            })),
        };
    });
    return {
        count: mapped.length,
        truncated: transporters.length > limit,
        transporters: mapped,
        queryMatches: queries.length ? queryMatches : undefined,
    };
}
async function listOrderStatusTypes() {
    const statusTypes = await prisma_1.prisma.orderStatusType.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, displayName: true, sortOrder: true },
    });
    return { statusTypes };
}
function productLineRevenue(item, dbCategory) {
    const qty = item.quantity ?? 0;
    const schemePercent = item.schemeDiscountPercent ?? 0;
    const itemDiscountPercent = item.itemDiscountPercent ?? 0;
    const rates = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(item);
    if (rates && rates.carton > 0) {
        const base = qty * rates.carton;
        const taxable = base - base * (schemePercent / 100) - base * (itemDiscountPercent / 100);
        return taxable * (1 + rates.gstPercent / 100);
    }
    const product = item.Product;
    if (!product)
        return 0;
    const rate = dbCategory === "RSS"
        ? product.sellingPricePerCartonForRssWithGst ?? product.sellingPricePerCartonForRss ?? 0
        : dbCategory === "SS"
            ? product.costPricePerCartonWithGst ?? product.costPricePerCarton ?? 0
            : product.sellingPricePerCartonForDbWithGst ?? product.sellingPricePerCartonForDb ?? 0;
    if (rate <= 0)
        return 0;
    const base = qty * rate;
    return base - base * (schemePercent / 100) - base * (itemDiscountPercent / 100);
}
async function salesSummary(args) {
    const range = (0, ai_utils_1.resolveDateRange)(args.dateFrom, args.dateTo, 30, 366);
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 10, 25);
    const groupBy = args.groupBy ?? "none";
    const salesOrderSelect = {
        ...orderSaleAmount_1.REPORT_ORDER_SELECT,
        id: true,
        OrderItem: {
            select: {
                ...orderSaleAmount_1.REPORT_ORDER_SELECT.OrderItem.select,
                productId: true,
            },
        },
    };
    const orders = await prisma_1.prisma.order.findMany({
        where: {
            AND: [
                distributorDraftVisibility,
                { orderDate: { gte: range.fromDate, lte: range.toDate } },
                { isVerifiedByAdmin: true },
            ],
        },
        take: 2000,
        orderBy: { orderDate: "desc" },
        select: salesOrderSelect,
    });
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    const productById = new Map(catalog.products.map((product) => [product.id, product]));
    const productSales = new Map();
    const customerSales = new Map();
    const daySales = new Map();
    let totalSale = 0;
    let totalCartons = 0;
    for (const order of orders) {
        const reportOrder = order;
        const sale = (0, orderSaleAmount_1.computeOrderSaleForReport)(reportOrder);
        const dbCategory = reportOrder.Customer?.CustomerDetail?.[0]?.dbCategory ?? "DISTRIBUTOR";
        const cartons = order.OrderItem.reduce((sum, item) => sum + item.quantity, 0);
        totalSale += sale;
        totalCartons += cartons;
        const day = (0, ai_utils_1.istDateString)(order.orderDate);
        const dayEntry = daySales.get(day) ?? { orders: 0, sale: 0, cartons: 0 };
        dayEntry.orders += 1;
        dayEntry.sale += sale;
        dayEntry.cartons += cartons;
        daySales.set(day, dayEntry);
        const customerEntry = customerSales.get(order.customerId) ?? {
            orders: 0,
            sale: 0,
            cartons: 0,
        };
        customerEntry.orders += 1;
        customerEntry.sale += sale;
        customerEntry.cartons += cartons;
        customerSales.set(order.customerId, customerEntry);
        for (const item of order.OrderItem) {
            const productId = item.productId;
            const productEntry = productSales.get(productId) ?? { quantity: 0, sale: 0 };
            productEntry.quantity += item.quantity;
            productEntry.sale += productLineRevenue(item, dbCategory);
            productSales.set(productId, productEntry);
        }
    }
    const topProducts = [...productSales.entries()]
        .map(([productId, entry]) => ({
        productId,
        name: productById.get(productId)?.name ?? productId,
        code: productById.get(productId)?.productCode ?? null,
        cartons: entry.quantity,
        sale: Math.round(entry.sale * 100) / 100,
        saleFormatted: (0, ai_utils_1.formatInr)(entry.sale),
    }))
        .sort((a, b) => b.sale - a.sale)
        .slice(0, limit);
    const topCustomerIds = [...customerSales.entries()]
        .sort((a, b) => b[1].sale - a[1].sale)
        .slice(0, limit)
        .map(([customerId]) => customerId);
    const customerRows = topCustomerIds.length
        ? await prisma_1.prisma.user.findMany({
            where: { id: { in: topCustomerIds } },
            select: {
                id: true,
                name: true,
                CustomerDetail: { select: { dbName: true }, take: 1 },
            },
        })
        : [];
    const customerNameById = new Map(customerRows.map((customer) => [
        customer.id,
        customer.CustomerDetail[0]?.dbName || customer.name,
    ]));
    const topCustomers = topCustomerIds.map((customerId) => {
        const entry = customerSales.get(customerId);
        return {
            customerId,
            name: customerNameById.get(customerId) ?? customerId,
            orders: entry.orders,
            cartons: entry.cartons,
            sale: Math.round(entry.sale * 100) / 100,
            saleFormatted: (0, ai_utils_1.formatInr)(entry.sale),
        };
    });
    let series;
    if (groupBy === "day") {
        series = [...daySales.entries()]
            .map(([day, entry]) => ({
            bucket: day,
            orders: entry.orders,
            cartons: entry.cartons,
            sale: Math.round(entry.sale * 100) / 100,
        }))
            .sort((a, b) => a.bucket.localeCompare(b.bucket));
    }
    else if (groupBy === "product") {
        series = topProducts.map((product) => ({
            bucket: product.name,
            orders: 0,
            cartons: product.cartons,
            sale: product.sale,
        }));
    }
    else if (groupBy === "customer") {
        series = topCustomers.map((customer) => ({
            bucket: customer.name,
            orders: customer.orders,
            cartons: customer.cartons,
            sale: customer.sale,
        }));
    }
    return {
        from: range.from,
        to: range.to,
        groupBy,
        orderCount: orders.length,
        totalCartons,
        totalSale: Math.round(totalSale * 100) / 100,
        totalSaleFormatted: (0, ai_utils_1.formatInr)(totalSale),
        truncated: orders.length >= 2000,
        topProducts,
        topCustomers,
        series,
    };
}
async function lowStockAndReorder(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 15, 25);
    const mode = args.mode;
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    const productIds = catalog.products.map((product) => product.id);
    const products = productIds.length
        ? await prisma_1.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                productCode: true,
                lowStockLimit: true,
                isDiscontinued: true,
            },
        })
        : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const stockGrouped = productIds.length
        ? await prisma_1.prisma.stockBatch.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds }, stockQuantity: { gt: 0 } },
            _sum: { stockQuantity: true },
        })
        : [];
    const stockByProduct = new Map(stockGrouped.map((row) => [row.productId, row._sum.stockQuantity ?? 0]));
    if (mode === "low_stock") {
        const rows = products
            .filter((product) => product.isDiscontinued !== true)
            .map((product) => {
            const stock = stockByProduct.get(product.id) ?? 0;
            const threshold = args.threshold ?? product.lowStockLimit ?? 0;
            return {
                productId: product.id,
                name: product.name,
                code: product.productCode,
                currentStock: stock,
                lowStockLimit: threshold,
                shortfall: Math.max(0, threshold - stock),
            };
        })
            .filter((row) => row.currentStock <= row.lowStockLimit)
            .sort((a, b) => a.currentStock - b.currentStock || b.shortfall - a.shortfall)
            .slice(0, limit);
        return { mode, count: rows.length, products: rows };
    }
    const lookbackDays = args.lookbackDays ?? 60;
    const targetCoverDays = args.targetCoverDays ?? 30;
    const salesEnd = new Date();
    const salesStart = new Date(salesEnd.getTime() - lookbackDays * 86400 * 1000);
    // Resolve the matching orders first, then aggregate order items by the
    // indexed orderId. A direct relation-filter groupBy on OrderItem is ~30x
    // slower against this MongoDB dataset.
    const matchingOrders = await prisma_1.prisma.order.findMany({
        where: {
            orderDate: { gte: salesStart, lte: salesEnd },
            isVerifiedByAdmin: true,
            NOT: {
                isFinalizedByDistributor: false,
                OrderCreator: { is: { userType: "CUSTOMER" } },
            },
        },
        select: { id: true },
        take: 10000,
    });
    const matchingOrderIds = matchingOrders.map((order) => order.id);
    const soldGrouped = matchingOrderIds.length
        ? await prisma_1.prisma.orderItem.groupBy({
            by: ["productId"],
            where: { orderId: { in: matchingOrderIds } },
            _sum: { quantity: true },
        })
        : [];
    const soldByProduct = new Map(soldGrouped.map((row) => [row.productId, row._sum.quantity ?? 0]));
    if (mode === "reorder") {
        const rows = products
            .filter((product) => product.isDiscontinued !== true)
            .map((product) => {
            const stock = stockByProduct.get(product.id) ?? 0;
            const sold = soldByProduct.get(product.id) ?? 0;
            const avgDailySales = sold / lookbackDays;
            const suggestedCartons = Math.ceil(avgDailySales * targetCoverDays - stock);
            return {
                productId: product.id,
                name: product.name,
                code: product.productCode,
                currentStock: stock,
                soldInLookback: sold,
                avgDailySales: Math.round(avgDailySales * 100) / 100,
                targetCoverDays,
                suggestedCartons: Math.max(0, suggestedCartons),
                daysOfCover: avgDailySales > 0 ? Math.round((stock / avgDailySales) * 10) / 10 : null,
            };
        })
            .filter((row) => row.suggestedCartons > 0)
            .sort((a, b) => b.suggestedCartons - a.suggestedCartons)
            .slice(0, limit);
        return {
            mode,
            lookbackDays,
            targetCoverDays,
            count: rows.length,
            products: rows,
        };
    }
    // slow_movers
    const salesThreshold = args.threshold ?? 0;
    const rows = products
        .filter((product) => product.isDiscontinued !== true)
        .map((product) => ({
        productId: product.id,
        name: product.name,
        code: product.productCode,
        currentStock: stockByProduct.get(product.id) ?? 0,
        soldInLookback: soldByProduct.get(product.id) ?? 0,
        lowStockLimit: product.lowStockLimit,
    }))
        .filter((row) => row.currentStock > 0 && row.soldInLookback <= salesThreshold)
        .sort((a, b) => b.currentStock - a.currentStock)
        .slice(0, limit);
    return {
        mode,
        lookbackDays,
        salesThreshold,
        count: rows.length,
        products: rows,
    };
}
async function businessOverview(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 15, 25);
    const includeWideSales = !args.dateFrom && !args.dateTo;
    const wideFrom = (0, ai_utils_1.istDateString)(new Date(Date.now() - 90 * 86400 * 1000));
    const wideTo = (0, ai_utils_1.istDateString)();
    const [sales, wideSales, lowStock, reorder, pendingOrders, purchasesInTransit] = await Promise.all([
        salesSummary({
            dateFrom: args.dateFrom,
            dateTo: args.dateTo,
            groupBy: "none",
            limit,
        }),
        includeWideSales
            ? salesSummary({
                dateFrom: wideFrom,
                dateTo: wideTo,
                groupBy: "none",
                limit: 5,
            })
            : Promise.resolve(null),
        args.includeLowStock === false
            ? Promise.resolve(null)
            : lowStockAndReorder({ mode: "low_stock", limit }),
        args.includeReorder === false
            ? Promise.resolve(null)
            : lowStockAndReorder({
                mode: "reorder",
                lookbackDays: 60,
                targetCoverDays: 30,
                limit,
            }),
        args.includePendingOrders === false
            ? Promise.resolve(null)
            : searchOrders({
                dateFrom: args.dateFrom,
                dateTo: args.dateTo,
                includeCompleted: false,
                includeStatusSummary: true,
                limit,
            }),
        args.includePurchasesInTransit === false
            ? Promise.resolve(null)
            : searchPurchases({
                statuses: [
                    "PENDING",
                    "LOADING",
                    "LOADED",
                    "IN_TRANSIT",
                    "ARRIVED",
                    "UNLOADING",
                    "UNLOADED",
                ],
                dateFrom: args.dateFrom,
                dateTo: args.dateTo,
                limit,
            }),
    ]);
    return {
        from: sales.from,
        to: sales.to,
        note: "Complete snapshot for the requested sections. Do not call sales_summary, low_stock_and_reorder, search_orders, or search_purchases unless you need a specific record, a different filter/date range, or more rows than returned here.",
        salesLast90Days: wideSales
            ? {
                from: wideSales.from,
                to: wideSales.to,
                orderCount: wideSales.orderCount,
                totalSale: wideSales.totalSale,
                totalSaleFormatted: wideSales.totalSaleFormatted,
                totalCartons: wideSales.totalCartons,
                topProducts: wideSales.topProducts.slice(0, 3).map((product) => ({
                    name: product.name,
                    code: product.code,
                    cartons: product.cartons,
                    sale: product.sale,
                })),
                truncated: wideSales.truncated,
            }
            : null,
        sales: {
            orderCount: sales.orderCount,
            totalSale: sales.totalSale,
            totalSaleFormatted: sales.totalSaleFormatted,
            totalCartons: sales.totalCartons,
            topProducts: sales.topProducts
                .slice(0, 5)
                .map((product) => ({
                name: product.name,
                code: product.code,
                cartons: product.cartons,
                sale: product.sale,
            })),
            topCustomers: sales.topCustomers
                .slice(0, 5)
                .map((customer) => ({
                name: customer.name,
                orders: customer.orders,
                cartons: customer.cartons,
                sale: customer.sale,
            })),
            truncated: sales.truncated,
        },
        lowStock: (lowStock?.products ?? []).map((product) => {
            const row = product;
            return {
                productId: row.productId,
                name: row.name,
                code: row.code,
                currentStock: row.currentStock,
                lowStockLimit: row.lowStockLimit,
                shortfall: row.shortfall,
            };
        }),
        reorderSuggestions: (reorder?.products ?? []).map((product) => {
            const row = product;
            return {
                productId: row.productId,
                name: row.name,
                code: row.code,
                currentStock: row.currentStock,
                avgDailySales: row.avgDailySales,
                suggestedCartons: row.suggestedCartons,
                daysOfCover: row.daysOfCover,
            };
        }),
        pendingOrders: pendingOrders
            ? {
                count: pendingOrders.count,
                truncated: pendingOrders.truncated,
                statusSummary: pendingOrders.statusSummary,
                orders: pendingOrders.orders.map((order) => ({
                    id: order.id,
                    orderCode: order.orderCode,
                    orderDate: order.orderDate,
                    customer: order.customer,
                    status: order.status,
                    lines: order.lines,
                    cartons: order.cartons,
                })),
            }
            : null,
        purchasesInTransit: purchasesInTransit
            ? {
                count: purchasesInTransit.count,
                truncated: purchasesInTransit.truncated,
                purchases: purchasesInTransit.purchases.map((purchase) => ({
                    id: purchase.id,
                    status: purchase.status,
                    transporter: purchase.transporter,
                    vehicleNumber: purchase.vehicleNumber,
                    invoiceIDs: purchase.invoiceIDs,
                    cartons: purchase.cartons,
                    invoiceTotal: purchase.invoiceTotal,
                    stockAdded: purchase.stockAdded,
                })),
            }
            : null,
    };
}
function compactMoney(value) {
    return Math.round(value * 100) / 100;
}
function formatQuantity(value) {
    return (0, ai_utils_1.formatNumber)(value);
}
function productLookup(products) {
    return compactProductMap(products);
}
const PURCHASE_SEGMENTS = {
    PENDING: "loading",
    LOADING: "loading",
    LOADED: "loading",
    IN_TRANSIT: "in_transit",
    ARRIVED: "in_transit",
    UNLOADING: "in_transit",
    UNLOADED: "unloaded",
    EXITED: "unloaded",
};
function purchaseSegment(status) {
    return PURCHASE_SEGMENTS[status] ?? "other";
}
function wholeDaysSince(date, now = new Date()) {
    if (!date)
        return null;
    const millis = now.getTime() - date.getTime();
    if (!Number.isFinite(millis))
        return null;
    return Math.max(0, Math.floor(millis / 86400000));
}
function purchaseWorkspaceAttention(input) {
    const attention = [];
    const status = input.status;
    const arrived = ["ARRIVED", "UNLOADING", "UNLOADED", "EXITED"].includes(status);
    if (arrived && !input.grnNumber)
        attention.push("missing_grn");
    if (!input.pricingComplete)
        attention.push("pricing_incomplete");
    if (["UNLOADED", "EXITED"].includes(status) && !input.stockAdded) {
        attention.push("stock_not_added");
    }
    if (!input.TargetUnloadingDate)
        attention.push("missing_target_unloading");
    if (status === "IN_TRANSIT" && (wholeDaysSince(input.purchaseDate) ?? 0) > 7) {
        attention.push("long_transit");
    }
    if (input.markedArrivedAt &&
        !input.markedUnloadedAt &&
        (wholeDaysSince(input.markedArrivedAt) ?? 0) >= 2) {
        attention.push("awaiting_unloading");
    }
    return attention;
}
const workspaceInvoiceSelect = {
    id: true,
    invoiceID: true,
    invoiceDate: true,
    invoiceAmount: true,
    PurchaseInvoiceItem: {
        select: {
            productId: true,
            quantity: true,
            mrp: true,
            gstPercentage: true,
            packetsPerCarton: true,
            costPricePerPacket: true,
            costPricePerCarton: true,
            product: { select: { id: true, name: true, productCode: true } },
        },
    },
};
async function purchaseWorkspace(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 50, 100);
    const now = new Date();
    const where = {
        purchaseTransportStatus: { not: "COMPLETED" },
    };
    if (args.statuses?.length) {
        const activeStatuses = args.statuses.filter((status) => status !== "COMPLETED");
        where.purchaseTransportStatus = activeStatuses.length
            ? { in: activeStatuses }
            : { not: "COMPLETED" };
    }
    if (args.purchaseIds?.length) {
        where.id = { in: args.purchaseIds };
    }
    const hasUnloadingFilter = Boolean(args.unloadingFrom || args.unloadingTo);
    let unloadingRange = null;
    if (hasUnloadingFilter) {
        const range = (0, ai_utils_1.resolveDateRange)(args.unloadingFrom, args.unloadingTo, 30, 366);
        unloadingRange = { from: range.from, to: range.to };
        where.TargetUnloadingDate = { gte: range.fromDate, lte: range.toDate };
    }
    const purchases = await prisma_1.prisma.purchase.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: "desc" },
        include: {
            Transporter: { select: { id: true, name: true } },
            PurchaseInvoice: { select: workspaceInvoiceSelect },
            purchaseStockBatches: { select: { id: true, stockQuantity: true } },
            stockBatches: { select: { id: true } },
        },
    });
    const truncated = purchases.length > limit;
    const rows = purchases.slice(0, limit).map((purchase) => {
        const items = purchase.PurchaseInvoice.flatMap((invoice) => invoice.PurchaseInvoiceItem);
        const cartons = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        const invoiceValue = purchase.PurchaseInvoice.reduce((sum, invoice) => sum +
            (invoice.invoiceAmount ??
                (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceAmountFromItems)(invoice.PurchaseInvoiceItem)), 0);
        const pricingComplete = (0, purchasePricing_1.isPurchasePricingComplete)(purchase.PurchaseInvoice);
        const stockAdded = purchase.stockBatches.length > 0;
        const attention = purchaseWorkspaceAttention({
            status: purchase.purchaseTransportStatus,
            grnNumber: purchase.grnNumber,
            pricingComplete,
            stockAdded,
            TargetUnloadingDate: purchase.TargetUnloadingDate,
            markedArrivedAt: purchase.markedArrivedAt,
            markedUnloadedAt: purchase.markedUnloadedAt,
            purchaseDate: purchase.purchaseDate,
        });
        return {
            id: purchase.id,
            label: purchase.vehicleNumber ||
                purchase.grnNumber ||
                purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", ") ||
                purchase.id,
            status: purchase.purchaseTransportStatus,
            segment: purchaseSegment(purchase.purchaseTransportStatus),
            transporter: purchase.Transporter?.name ?? "Unknown",
            vehicleNumber: purchase.vehicleNumber,
            grnNumber: purchase.grnNumber,
            purchaseDate: (0, ai_utils_1.istDateString)(purchase.purchaseDate),
            ageDays: wholeDaysSince(purchase.purchaseDate, now),
            targetUnloadingDate: purchase.TargetUnloadingDate
                ? (0, ai_utils_1.istDateString)(purchase.TargetUnloadingDate)
                : null,
            markedArrivedAt: purchase.markedArrivedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedArrivedAt)
                : null,
            markedUnloadedAt: purchase.markedUnloadedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedUnloadedAt)
                : null,
            vehicleExitedAt: purchase.VehicleExitedAt
                ? (0, ai_utils_1.istDateString)(purchase.VehicleExitedAt)
                : null,
            daysSinceArrival: wholeDaysSince(purchase.markedArrivedAt, now),
            invoiceCount: purchase.PurchaseInvoice.length,
            invoiceIDs: purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID)
                .filter(Boolean)
                .slice(0, 5),
            lineCount: items.length,
            cartons,
            invoiceValue,
            invoiceValueFormatted: (0, ai_utils_1.formatInr)(invoiceValue),
            plannedBatches: purchase.purchaseStockBatches.length,
            plannedCartons: purchase.purchaseStockBatches.reduce((sum, batch) => sum + (batch.stockQuantity ?? 0), 0),
            stockAdded,
            pricingComplete,
            attention,
        };
    });
    const counts = {
        total: rows.length,
        loading: rows.filter((row) => row.segment === "loading").length,
        inTransit: rows.filter((row) => row.segment === "in_transit").length,
        unloaded: rows.filter((row) => row.segment === "unloaded").length,
    };
    const attentionCounts = {};
    for (const row of rows) {
        for (const code of row.attention) {
            attentionCounts[code] = (attentionCounts[code] ?? 0) + 1;
        }
    }
    const attentionLabels = {
        missing_grn: "Missing GRN",
        pricing_incomplete: "Pricing incomplete",
        stock_not_added: "Stock not added",
        missing_target_unloading: "Missing target unloading date",
        long_transit: "Long transit (IN_TRANSIT over 7 days)",
        awaiting_unloading: "Arrived but not unloaded (2+ days)",
    };
    return {
        scope: "active purchases (status not COMPLETED)",
        filters: {
            unloadingFrom: unloadingRange?.from ?? null,
            unloadingTo: unloadingRange?.to ?? null,
            statuses: args.statuses ?? null,
            purchaseIds: args.purchaseIds?.length ? args.purchaseIds.length : null,
        },
        counts,
        totals: {
            cartons: rows.reduce((sum, row) => sum + row.cartons, 0),
            invoiceValue: rows.reduce((sum, row) => sum + row.invoiceValue, 0),
            invoiceValueFormatted: (0, ai_utils_1.formatInr)(rows.reduce((sum, row) => sum + row.invoiceValue, 0)),
            vehiclesWithAttention: rows.filter((row) => row.attention.length > 0).length,
            stockAdded: rows.filter((row) => row.stockAdded).length,
            stockNotAdded: rows.filter((row) => !row.stockAdded).length,
            pricingIncomplete: rows.filter((row) => !row.pricingComplete).length,
            missingGrn: rows.filter((row) => !row.grnNumber).length,
            missingTargetUnloading: rows.filter((row) => !row.targetUnloadingDate).length,
        },
        attentionCounts,
        attentionSummary: Object.entries(attentionCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => ({
            code,
            label: attentionLabels[code] ?? code,
            count,
        })),
        truncated,
        purchases: rows,
        guidance: "Use this for what needs attention, vehicle status, aging, GRN gaps, pricing gaps, and stock-not-added checks. If the user asks about a single vehicle, use get_purchase for line-level detail. Values use invoice amounts where present, otherwise computed snapshots.",
        notes: [
            "Only active purchases are included; COMPLETED purchases are excluded.",
            "invoiceValue is the invoice amount when set, otherwise the computed line amount with GST.",
        ],
    };
}
function addToBucket(bucketMap, key, amount, cartons, lines, invoiceId, purchaseId) {
    const existing = bucketMap.get(key) ?? {
        key,
        invoiceIds: new Set(),
        purchaseIds: new Set(),
        amount: 0,
        cartons: 0,
        lines: 0,
    };
    existing.invoiceIds.add(invoiceId);
    existing.purchaseIds.add(purchaseId);
    existing.amount += amount;
    existing.cartons += cartons;
    existing.lines += lines;
    bucketMap.set(key, existing);
}
function bucketRows(bucketMap, limit, totalAmount) {
    return [...bucketMap.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit)
        .map((bucket) => ({
        key: bucket.key,
        invoiceCount: bucket.invoiceIds.size,
        purchaseCount: bucket.purchaseIds.size,
        lineCount: bucket.lines,
        amount: Math.round(bucket.amount * 100) / 100,
        amountFormatted: (0, ai_utils_1.formatInr)(bucket.amount),
        cartons: bucket.cartons,
        sharePct: totalAmount > 0
            ? Math.round((bucket.amount / totalAmount) * 1000) / 10
            : 0,
    }));
}
async function purchaseAnalytics(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 12, 25);
    const range = (0, ai_utils_1.resolveDateRange)(args.dateFrom, args.dateTo, 30, 366);
    const groupBy = args.groupBy ?? "supplier";
    const where = {
        invoiceDate: { gte: range.fromDate, lte: range.toDate },
    };
    if (args.transporterName) {
        where.purchase = {
            is: {
                Transporter: {
                    is: { name: { contains: args.transporterName, mode: "insensitive" } },
                },
            },
        };
    }
    const invoices = await prisma_1.prisma.purchaseInvoice.findMany({
        where,
        take: 2001,
        orderBy: { invoiceDate: "desc" },
        select: {
            id: true,
            invoiceID: true,
            invoiceDate: true,
            invoiceAmount: true,
            purchaseId: true,
            purchase: {
                select: {
                    id: true,
                    purchaseTransportStatus: true,
                    vehicleNumber: true,
                    grnNumber: true,
                    Transporter: { select: { name: true } },
                },
            },
            PurchaseInvoiceItem: {
                select: {
                    productId: true,
                    quantity: true,
                    mrp: true,
                    gstPercentage: true,
                    packetsPerCarton: true,
                    costPricePerPacket: true,
                    costPricePerCarton: true,
                    product: { select: { id: true, name: true, productCode: true } },
                },
            },
        },
    });
    const truncated = invoices.length > 2000;
    const rows = invoices.slice(0, 2000);
    const supplierBuckets = new Map();
    const monthBuckets = new Map();
    const productBuckets = new Map();
    const statusBuckets = new Map();
    const purchaseIds = new Set();
    let totalAmount = 0;
    let totalCartons = 0;
    let totalLines = 0;
    let invoiceAmountTotal = 0;
    let computedAmountTotal = 0;
    for (const invoice of rows) {
        const purchaseId = invoice.purchaseId;
        const supplier = invoice.purchase?.Transporter?.name ?? "Unknown supplier";
        const status = invoice.purchase?.purchaseTransportStatus ?? "UNKNOWN";
        const month = invoice.invoiceDate
            ? (0, ai_utils_1.istDateString)(invoice.invoiceDate).slice(0, 7)
            : "unknown";
        const computedAmount = (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceAmountFromItems)(invoice.PurchaseInvoiceItem);
        const amount = invoice.invoiceAmount ?? computedAmount;
        const cartons = invoice.PurchaseInvoiceItem.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        const lineCount = invoice.PurchaseInvoiceItem.length;
        purchaseIds.add(purchaseId);
        totalAmount += amount;
        totalCartons += cartons;
        totalLines += lineCount;
        if (invoice.invoiceAmount !== null && invoice.invoiceAmount !== undefined) {
            invoiceAmountTotal += invoice.invoiceAmount;
        }
        computedAmountTotal += computedAmount;
        addToBucket(supplierBuckets, supplier, amount, cartons, lineCount, invoice.id, purchaseId);
        addToBucket(monthBuckets, month, amount, cartons, lineCount, invoice.id, purchaseId);
        addToBucket(statusBuckets, status, amount, cartons, lineCount, invoice.id, purchaseId);
        for (const item of invoice.PurchaseInvoiceItem) {
            const lineAmount = item.quantity *
                (0, purchaseItemPriceSnapshot_1.resolvePurchaseItemSnapshotRates)(item).carton *
                (1 + (item.gstPercentage ?? 0) / 100);
            const key = item.product?.name ?? item.productId;
            addToBucket(productBuckets, key, lineAmount, item.quantity ?? 0, 1, invoice.id, purchaseId);
        }
    }
    const groupBuckets = groupBy === "month"
        ? monthBuckets
        : groupBy === "product"
            ? productBuckets
            : groupBy === "status"
                ? statusBuckets
                : supplierBuckets;
    const supplierRows = bucketRows(supplierBuckets, limit, totalAmount);
    const productRows = bucketRows(productBuckets, limit, totalAmount);
    const monthlyRows = [...monthBuckets.values()]
        .sort((a, b) => b.key.localeCompare(a.key))
        .slice(0, 18)
        .map((bucket) => ({
        month: bucket.key,
        invoiceCount: bucket.invoiceIds.size,
        amount: Math.round(bucket.amount * 100) / 100,
        amountFormatted: (0, ai_utils_1.formatInr)(bucket.amount),
        cartons: bucket.cartons,
    }));
    return {
        range: { from: range.from, to: range.to },
        groupBy,
        supplierFilter: args.transporterName ?? null,
        invoiceCount: rows.length,
        purchaseCount: purchaseIds.size,
        truncated,
        totals: {
            amount: Math.round(totalAmount * 100) / 100,
            amountFormatted: (0, ai_utils_1.formatInr)(totalAmount),
            cartons: totalCartons,
            lines: totalLines,
            averageInvoiceAmount: rows.length > 0 ? Math.round((totalAmount / rows.length) * 100) / 100 : 0,
            invoiceAmountTotal: Math.round(invoiceAmountTotal * 100) / 100,
            computedAmountTotal: Math.round(computedAmountTotal * 100) / 100,
        },
        groups: bucketRows(groupBuckets, limit, totalAmount),
        topSuppliers: supplierRows,
        topProducts: productRows,
        monthly: monthlyRows,
        statusBreakdown: bucketRows(statusBuckets, 20, totalAmount),
        notes: [
            "Date range is based on supplier invoice date; invoices without an invoice date are excluded.",
            "The maximum scan window is 366 days; the requested dates are clamped to that window.",
            truncated
                ? "Only the most recent 2,000 invoices in the range were scanned; narrow the date range for exact totals."
                : null,
            "amount uses invoiceAmount when set, otherwise the snapshot line amount with GST.",
            "Status breakdown is the current status of each purchase, not the status at invoice time.",
        ].filter(Boolean),
    };
}
async function supplierPurchaseHistory(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 10, 25);
    const transporter = await (0, ai_resolve_1.resolveTransporter)({
        transporterId: args.transporterId,
        transporterQuery: args.transporterQuery,
    });
    const hasDateFilter = Boolean(args.dateFrom || args.dateTo);
    const range = hasDateFilter
        ? (0, ai_utils_1.resolveDateRange)(args.dateFrom, args.dateTo, 90, 366)
        : null;
    const purchases = await prisma_1.prisma.purchase.findMany({
        where: {
            transporterId: transporter.id,
            ...(range
                ? {
                    PurchaseInvoice: {
                        some: { invoiceDate: { gte: range.fromDate, lte: range.toDate } },
                    },
                }
                : {}),
        },
        take: limit + 1,
        orderBy: { purchaseDate: "desc" },
        include: {
            Transporter: { select: { id: true, name: true } },
            PurchaseInvoice: { select: workspaceInvoiceSelect },
            stockBatches: { select: { id: true } },
            purchaseStockBatches: { select: { id: true, stockQuantity: true } },
        },
    });
    const truncated = purchases.length > limit;
    const rows = purchases.slice(0, limit);
    const productMix = new Map();
    let totalCartons = 0;
    let totalAmount = 0;
    let invoiceCount = 0;
    const purchaseRows = rows.map((purchase) => {
        const items = purchase.PurchaseInvoice.flatMap((invoice) => invoice.PurchaseInvoiceItem);
        const cartons = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        const amount = purchase.PurchaseInvoice.reduce((sum, invoice) => sum +
            (invoice.invoiceAmount ??
                (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceAmountFromItems)(invoice.PurchaseInvoiceItem)), 0);
        const pricingComplete = (0, purchasePricing_1.isPurchasePricingComplete)(purchase.PurchaseInvoice);
        const stockAdded = purchase.stockBatches.length > 0;
        totalCartons += cartons;
        totalAmount += amount;
        invoiceCount += purchase.PurchaseInvoice.length;
        for (const invoice of purchase.PurchaseInvoice) {
            for (const item of invoice.PurchaseInvoiceItem) {
                if (!item.product)
                    continue;
                const key = item.product.id;
                const rates = (0, purchaseItemPriceSnapshot_1.resolvePurchaseItemSnapshotRates)(item);
                const lineAmount = (item.quantity ?? 0) * rates.carton * (1 + (item.gstPercentage ?? 0) / 100);
                const existing = productMix.get(key) ?? {
                    name: item.product.name,
                    code: item.product.productCode,
                    cartons: 0,
                    amount: 0,
                    purchases: new Set(),
                    lastCostPerCarton: 0,
                    lastDate: null,
                };
                existing.cartons += item.quantity ?? 0;
                existing.amount += lineAmount;
                existing.purchases.add(purchase.id);
                existing.lastCostPerCarton = rates.carton;
                existing.lastDate = invoice.invoiceDate
                    ? (0, ai_utils_1.istDateString)(invoice.invoiceDate)
                    : existing.lastDate;
                productMix.set(key, existing);
            }
        }
        return {
            id: purchase.id,
            label: purchase.vehicleNumber || purchase.grnNumber || purchase.id,
            status: purchase.purchaseTransportStatus,
            vehicleNumber: purchase.vehicleNumber,
            grnNumber: purchase.grnNumber,
            purchaseDate: (0, ai_utils_1.istDateString)(purchase.purchaseDate),
            targetUnloadingDate: purchase.TargetUnloadingDate
                ? (0, ai_utils_1.istDateString)(purchase.TargetUnloadingDate)
                : null,
            markedArrivedAt: purchase.markedArrivedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedArrivedAt)
                : null,
            markedUnloadedAt: purchase.markedUnloadedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedUnloadedAt)
                : null,
            invoiceIDs: purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID)
                .filter(Boolean)
                .slice(0, 5),
            invoiceCount: purchase.PurchaseInvoice.length,
            lineCount: items.length,
            cartons,
            amount,
            amountFormatted: (0, ai_utils_1.formatInr)(amount),
            pricingComplete,
            stockAdded,
            attention: purchaseWorkspaceAttention({
                status: purchase.purchaseTransportStatus,
                grnNumber: purchase.grnNumber,
                pricingComplete,
                stockAdded,
                TargetUnloadingDate: purchase.TargetUnloadingDate,
                markedArrivedAt: purchase.markedArrivedAt,
                markedUnloadedAt: purchase.markedUnloadedAt,
                purchaseDate: purchase.purchaseDate,
            }),
        };
    });
    return {
        supplier: { id: transporter.id, name: transporter.name },
        range: range ? { from: range.from, to: range.to } : null,
        purchaseCount: rows.length,
        truncated,
        invoiceCount,
        totals: {
            cartons: totalCartons,
            amount: Math.round(totalAmount * 100) / 100,
            amountFormatted: (0, ai_utils_1.formatInr)(totalAmount),
            averagePurchaseAmount: rows.length > 0 ? Math.round((totalAmount / rows.length) * 100) / 100 : 0,
            lastPurchaseDate: purchaseRows[0]?.purchaseDate ?? null,
        },
        purchases: purchaseRows,
        productMix: [...productMix.values()]
            .sort((a, b) => b.cartons - a.cartons)
            .slice(0, 15)
            .map((entry) => ({
            name: entry.name,
            code: entry.code,
            cartons: entry.cartons,
            amount: Math.round(entry.amount * 100) / 100,
            amountFormatted: (0, ai_utils_1.formatInr)(entry.amount),
            purchaseCount: entry.purchases.size,
            lastCostPerCarton: entry.lastCostPerCarton,
            lastInvoiceDate: entry.lastDate,
        })),
        notes: [
            range
                ? `Date range is based on supplier invoice date (${range.from} to ${range.to}); purchases without an invoice in the range are excluded.`
                : "No date filter was supplied, so the most recent purchases for this supplier are shown.",
            "avg cost is not weighted by quantity; lastCostPerCarton is the latest snapshot in the selected purchases.",
            "COMPLETED purchases are included when they are among the selected purchases.",
        ],
    };
}
async function purchasePriceHistory(args) {
    const limit = (0, ai_utils_1.toPositiveInt)(args.limit, 15, 30);
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    const product = (0, ai_resolve_1.resolveProducts)([
        {
            productId: args.productId,
            productCode: args.productCode,
            productName: args.productName,
            quantity: 1,
        },
    ], catalog.products)[0];
    const items = await prisma_1.prisma.purchaseInvoiceItem.findMany({
        where: { productId: product.id },
        take: limit + 1,
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            quantity: true,
            mrp: true,
            gstPercentage: true,
            packetsPerCarton: true,
            costPricePerPacket: true,
            costPricePerCarton: true,
            createdAt: true,
            PurchaseInvoice: {
                select: {
                    id: true,
                    invoiceID: true,
                    invoiceDate: true,
                    purchase: {
                        select: {
                            id: true,
                            vehicleNumber: true,
                            grnNumber: true,
                            purchaseTransportStatus: true,
                            Transporter: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });
    const truncated = items.length > limit;
    const lines = items
        .slice(0, limit)
        .map((item) => {
        const rates = (0, purchaseItemPriceSnapshot_1.resolvePurchaseItemSnapshotRates)(item);
        return {
            invoiceDate: item.PurchaseInvoice?.invoiceDate
                ? (0, ai_utils_1.istDateString)(item.PurchaseInvoice.invoiceDate)
                : null,
            invoiceID: item.PurchaseInvoice?.invoiceID ?? null,
            purchaseId: item.PurchaseInvoice?.purchase?.id ?? null,
            transporter: item.PurchaseInvoice?.purchase?.Transporter?.name ?? null,
            vehicleNumber: item.PurchaseInvoice?.purchase?.vehicleNumber ?? null,
            grnNumber: item.PurchaseInvoice?.purchase?.grnNumber ?? null,
            purchaseStatus: item.PurchaseInvoice?.purchase?.purchaseTransportStatus ?? null,
            quantity: item.quantity,
            costPricePerCarton: rates.carton,
            costPricePerPacket: rates.packet,
            gstPercentage: rates.gstPercent,
            mrp: item.mrp ?? null,
        };
    })
        .sort((a, b) => {
        const left = a.invoiceDate ?? "";
        const right = b.invoiceDate ?? "";
        return left.localeCompare(right);
    });
    const priced = lines.filter((line) => line.costPricePerCarton > 0);
    const costs = priced.map((line) => line.costPricePerCarton);
    const first = priced[0];
    const last = priced[priced.length - 1];
    const average = costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) / costs.length : null;
    const changePct = first && last && first.costPricePerCarton > 0
        ? Math.round(((last.costPricePerCarton - first.costPricePerCarton) /
            first.costPricePerCarton) *
            1000) / 10
        : null;
    return {
        product: {
            id: product.id,
            name: product.name,
            code: product.productCode,
            mrp: product.mrp,
            packetsPerCarton: product.packetsPerCarton,
            currentCostPerPacket: product.costPricePerPacket,
            currentCostPerCarton: product.costPricePerCarton,
            isDiscontinued: product.isDiscontinued,
        },
        stats: {
            purchaseCount: new Set(lines.map((line) => line.purchaseId).filter(Boolean)).size,
            lineCount: lines.length,
            minCostPerCarton: costs.length ? Math.min(...costs) : null,
            maxCostPerCarton: costs.length ? Math.max(...costs) : null,
            averageCostPerCarton: average !== null ? Math.round(average * 100) / 100 : null,
            firstCostPerCarton: first?.costPricePerCarton ?? null,
            lastCostPerCarton: last?.costPricePerCarton ?? null,
            changePct,
        },
        lines,
        truncated,
        notes: [
            "Costs are purchase-invoice snapshots, not the current product master.",
            "Carton rate is derived from the packet rate when packetsPerCarton is greater than zero.",
            "Lines are ordered oldest to newest; the most recent snapshot is last.",
        ],
    };
}
async function reconcilePurchase(args) {
    const hasIdentity = Boolean(args.purchaseId || args.grnNumber || args.invoiceID || args.vehicleNumber);
    if (!hasIdentity) {
        const workspace = await purchaseWorkspace({ limit: 50 });
        const issues = workspace.purchases.filter((row) => row.attention.length > 0);
        return {
            scope: "workspace",
            counts: workspace.counts,
            attentionCounts: workspace.attentionCounts,
            totals: workspace.totals,
            invoicesWithoutAmounts: null,
            purchasesWithIssues: issues.slice(0, 25),
            notes: [
                "No purchase identifier was supplied, so this is a workspace audit of active purchases.",
                "To check one purchase in detail, pass purchaseId, GRN, invoice number, or vehicle number.",
            ],
        };
    }
    const purchase = await (0, ai_resolve_1.resolvePurchase)({
        purchaseId: args.purchaseId,
        grnNumber: args.grnNumber,
        invoiceID: args.invoiceID,
        vehicleNumber: args.vehicleNumber,
    });
    const invoices = purchase.PurchaseInvoice;
    const items = invoices.flatMap((invoice) => invoice.PurchaseInvoiceItem);
    const cartons = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const invoiceAmountTotal = invoices.reduce((sum, invoice) => sum + (invoice.invoiceAmount ?? 0), 0);
    const computedAmountTotal = invoices.reduce((sum, invoice) => sum + (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceAmountFromItems)(invoice.PurchaseInvoiceItem), 0);
    const variance = invoiceAmountTotal - computedAmountTotal;
    const pricingComplete = (0, purchasePricing_1.isPurchasePricingComplete)(invoices);
    const stockAdded = purchase.stockBatches.length > 0;
    const invoiceIDs = invoices.map((invoice) => invoice.invoiceID).filter(Boolean);
    const duplicateInvoiceIDs = invoiceIDs.filter((id, index) => invoiceIDs.indexOf(id) !== index);
    const missingInvoiceDates = invoices
        .filter((invoice) => !invoice.invoiceDate)
        .map((invoice) => invoice.invoiceID ?? invoice.id);
    const missingPricing = items
        .filter((item) => !item.mrp ||
        !item.costPricePerPacket ||
        !item.costPricePerCarton)
        .map((item) => ({
        product: item.product?.name ?? item.productId,
        code: item.product?.productCode ?? null,
        mrp: item.mrp ?? 0,
        costPricePerPacket: item.costPricePerPacket ?? 0,
        costPricePerCarton: item.costPricePerCarton ?? 0,
    }));
    const status = purchase.purchaseTransportStatus;
    const checks = [
        {
            code: "invoices_present",
            ok: invoices.length > 0,
            severity: invoices.length > 0 ? "info" : "error",
            message: invoices.length > 0 ? `${invoices.length} invoice(s).` : "No invoices.",
        },
        {
            code: "invoice_dates",
            ok: missingInvoiceDates.length === 0,
            severity: missingInvoiceDates.length === 0 ? "info" : "warning",
            message: missingInvoiceDates.length === 0
                ? "Every invoice has a date."
                : `Missing invoice date: ${missingInvoiceDates.join(", ")}.`,
        },
        {
            code: "pricing_complete",
            ok: pricingComplete,
            severity: pricingComplete ? "info" : "error",
            message: pricingComplete
                ? "MRP and both cost rates are set on every line."
                : `${missingPricing.length} line(s) have missing MRP/cost pricing.`,
        },
        {
            code: "invoice_amount_variance",
            ok: Math.abs(variance) <= 1,
            severity: Math.abs(variance) <= 1 ? "info" : "warning",
            message: Math.abs(variance) <= 1
                ? "Invoice amounts match the line snapshots."
                : `Invoice amount total differs from computed lines by ${(0, ai_utils_1.formatInr)(variance)}.`,
        },
        {
            code: "grn_present",
            ok: !["ARRIVED", "UNLOADING", "UNLOADED", "EXITED"].includes(status) ||
                Boolean(purchase.grnNumber?.trim()),
            severity: "warning",
            message: purchase.grnNumber
                ? `GRN ${purchase.grnNumber}.`
                : "No GRN number is set.",
        },
        {
            code: "arrival_timestamp",
            ok: !["ARRIVED", "UNLOADING", "UNLOADED", "EXITED"].includes(status) ||
                Boolean(purchase.markedArrivedAt),
            severity: "warning",
            message: purchase.markedArrivedAt
                ? "Arrival timestamp is set."
                : "Arrival timestamp is not set.",
        },
        {
            code: "unload_timestamp",
            ok: !["UNLOADED", "EXITED"].includes(status) || Boolean(purchase.markedUnloadedAt),
            severity: "warning",
            message: purchase.markedUnloadedAt
                ? "Unload timestamp is set."
                : "Unload timestamp is not set.",
        },
        {
            code: "stock_added",
            ok: !["UNLOADED", "EXITED"].includes(status) || stockAdded || purchase.purchaseStockBatches.length === 0,
            severity: "warning",
            message: stockAdded
                ? "Live stock exists for this purchase."
                : purchase.purchaseStockBatches.length === 0
                    ? "No planned batches to transfer."
                    : "Planned batches exist but live stock has not been added.",
        },
        {
            code: "stock_timestamp",
            ok: !stockAdded || Boolean(purchase.stockAddedAt),
            severity: "info",
            message: purchase.stockAddedAt
                ? "Stock added timestamp is set."
                : "Stock added timestamp is missing.",
        },
        {
            code: "duplicate_invoice_ids",
            ok: duplicateInvoiceIDs.length === 0,
            severity: "warning",
            message: duplicateInvoiceIDs.length === 0
                ? "No duplicate invoice numbers."
                : `Duplicate invoice numbers: ${[...new Set(duplicateInvoiceIDs)].join(", ")}.`,
        },
    ];
    const nextActions = [];
    if (!purchase.grnNumber && ["ARRIVED", "UNLOADING", "UNLOADED", "EXITED"].includes(status)) {
        nextActions.push("Set the GRN number.");
    }
    if (!pricingComplete)
        nextActions.push("Complete MRP and cost pricing before COMPLETED.");
    if (!stockAdded &&
        purchase.purchaseStockBatches.length > 0 &&
        ["UNLOADED", "EXITED"].includes(status)) {
        nextActions.push("Add the purchase to stock (or mark COMPLETED).");
    }
    if (!purchase.TargetUnloadingDate)
        nextActions.push("Set a target unloading date.");
    if (invoices.length === 0)
        nextActions.push("Add at least one supplier invoice.");
    return {
        scope: "purchase",
        purchase: {
            id: purchase.id,
            label: purchase.vehicleNumber || purchase.grnNumber || invoiceIDs[0] || purchase.id,
            transporter: purchase.Transporter?.name ?? "Unknown",
            vehicleNumber: purchase.vehicleNumber,
            grnNumber: purchase.grnNumber,
            status,
            purchaseDate: (0, ai_utils_1.istDateString)(purchase.purchaseDate),
            targetUnloadingDate: purchase.TargetUnloadingDate
                ? (0, ai_utils_1.istDateString)(purchase.TargetUnloadingDate)
                : null,
            markedArrivedAt: purchase.markedArrivedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedArrivedAt)
                : null,
            markedUnloadedAt: purchase.markedUnloadedAt
                ? (0, ai_utils_1.istDateString)(purchase.markedUnloadedAt)
                : null,
            vehicleExitedAt: purchase.VehicleExitedAt
                ? (0, ai_utils_1.istDateString)(purchase.VehicleExitedAt)
                : null,
            stockAddedAt: purchase.stockAddedAt
                ? (0, ai_utils_1.istDateString)(purchase.stockAddedAt)
                : null,
        },
        summary: {
            invoiceCount: invoices.length,
            lineCount: items.length,
            cartons,
            invoiceAmountTotal: Math.round(invoiceAmountTotal * 100) / 100,
            computedAmountTotal: Math.round(computedAmountTotal * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            pricingComplete,
            stockAdded,
            plannedBatches: purchase.purchaseStockBatches.length,
            liveBatches: purchase.stockBatches.length,
        },
        checks,
        missingPricing,
        nextActions,
        notes: [
            "Variance is invoiceAmount total minus computed snapshot line total with GST.",
            "Pricing must be complete before a purchase can be marked COMPLETED.",
            "COMPLETED also transfers planned batches into live stock.",
            "This is a read-only reconciliation; use the propose_* tools to prepare fixes.",
        ],
    };
}
//# sourceMappingURL=ai.tools.read.js.map