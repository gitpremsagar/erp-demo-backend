"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCustomer = resolveCustomer;
exports.resolveProducts = resolveProducts;
exports.resolveTransporter = resolveTransporter;
exports.resolveOrder = resolveOrder;
exports.resolvePurchase = resolvePurchase;
const prisma_1 = require("../../lib/prisma");
const ai_catalogCache_1 = require("./ai.catalogCache");
const ai_matching_1 = require("./ai.matching");
const ai_utils_1 = require("./ai.utils");
const customerSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    CustomerDetail: {
        select: { dbName: true, dbCategory: true },
        take: 1,
    },
};
function customerLabel(customer) {
    return customer.CustomerDetail[0]?.dbName || customer.name;
}
function candidateList(customers) {
    return customers
        .slice(0, 8)
        .map((customer) => `${customerLabel(customer)} (${customer.id})`)
        .join("; ");
}
async function resolveCustomer(input) {
    if (input.customerId) {
        const customer = await prisma_1.prisma.user.findFirst({
            where: { id: input.customerId, userType: "CUSTOMER" },
            select: customerSelect,
        });
        if (!customer) {
            throw new Error(`Customer id ${input.customerId} was not found.`);
        }
        return customer;
    }
    const query = (input.customerQuery ?? "").trim();
    if (!query) {
        throw new Error("Provide customerId or customerQuery (name/dbName/email/phone).");
    }
    const matches = await prisma_1.prisma.user.findMany({
        where: {
            userType: "CUSTOMER",
            OR: [
                ...((0, ai_utils_1.isObjectId)(query) ? [{ id: query }] : []),
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query } },
                { CustomerDetail: { some: { dbName: { contains: query, mode: "insensitive" } } } },
            ],
        },
        take: 10,
        select: customerSelect,
    });
    const pickFrom = (candidates) => {
        if (!candidates.length)
            return null;
        const normalizedQuery = (0, ai_utils_1.normalizeText)(query);
        const scored = candidates
            .map((customer) => {
            const label = customerLabel(customer);
            const exact = (0, ai_utils_1.normalizeText)(label) === normalizedQuery ||
                (0, ai_utils_1.normalizeText)(customer.name) === normalizedQuery ||
                (0, ai_utils_1.normalizeText)(customer.email) === normalizedQuery ||
                (0, ai_utils_1.normalizeText)(customer.phone ?? "") === normalizedQuery;
            const score = Math.max((0, ai_utils_1.similarity)(query, label), (0, ai_utils_1.similarity)(query, customer.name), (0, ai_utils_1.similarity)(query, customer.email), customer.phone ? (0, ai_utils_1.similarity)(query, customer.phone) : 0);
            return { customer, exact, score };
        })
            .sort((a, b) => {
            if (a.exact !== b.exact)
                return a.exact ? -1 : 1;
            return b.score - a.score;
        });
        const best = scored[0];
        const second = scored[1];
        if (best.exact || (best.score >= 0.86 && best.score - (second?.score ?? 0) >= 0.05)) {
            return best.customer;
        }
        return null;
    };
    const direct = pickFrom(matches);
    if (direct)
        return direct;
    // Case-insensitive fallback: one bounded read, then match in memory.
    const allCustomers = await prisma_1.prisma.user.findMany({
        where: { userType: "CUSTOMER" },
        take: 5000,
        select: customerSelect,
    });
    const fallback = pickFrom(allCustomers);
    if (fallback)
        return fallback;
    if (matches.length > 1) {
        throw new Error(`Customer "${query}" is ambiguous. Candidates: ${candidateList(matches)}. Ask the user which one to use.`);
    }
    if (matches.length === 1) {
        throw new Error(`Customer "${query}" did not match closely enough. Did you mean ${candidateList(matches)}?`);
    }
    throw new Error(`Customer "${query}" was not found. Try a different name or use search_customers.`);
}
function productMatchError(item, candidates) {
    const raw = item.productName ?? item.productCode ?? item.productId ?? "unknown product";
    const list = candidates
        .slice(0, 6)
        .map((candidate) => `${candidate.name} (${candidate.productCode})`)
        .join("; ");
    return new Error(`Product "${raw}" ${list ? `is ambiguous. Candidates: ${list}` : "was not found"}. ` +
        "Ask the user which product they mean, or pass an exact product code.");
}
/** Resolve every line against the cached product catalog. No per-line DB queries. */
function resolveProducts(items, catalogProducts) {
    return items.map((item) => {
        if (item.productId) {
            const byId = catalogProducts.find((product) => product.id === item.productId);
            if (byId)
                return byId;
        }
        if (item.productCode) {
            const code = (0, ai_utils_1.normalizeCode)(item.productCode);
            const codeMatches = catalogProducts.filter((product) => (0, ai_utils_1.normalizeCode)(product.productCode) === code);
            if (codeMatches.length === 1)
                return codeMatches[0];
            if (codeMatches.length > 1)
                throw productMatchError(item, codeMatches);
        }
        if (item.productName) {
            const match = (0, ai_matching_1.matchCandidate)(item.productName, catalogProducts);
            if (match.match) {
                const resolved = catalogProducts.find((product) => product.id === match.match.id);
                if (resolved)
                    return resolved;
            }
            throw productMatchError(item, match.candidates);
        }
        throw productMatchError(item, []);
    });
}
async function resolveTransporter(input) {
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    if (input.transporterId) {
        const cached = catalog.transporters.find((transporter) => transporter.id === input.transporterId);
        if (cached)
            return cached;
        const dbMatch = await prisma_1.prisma.transporter.findUnique({
            where: { id: input.transporterId },
            select: { id: true, name: true },
        });
        if (dbMatch)
            return dbMatch;
        throw new Error(`Transporter id ${input.transporterId} was not found.`);
    }
    const query = (input.transporterQuery ?? "").trim();
    if (!query) {
        throw new Error("Provide transporterId or transporterQuery (name).");
    }
    const catalogMatch = (0, ai_matching_1.matchCandidate)(query, catalog.transporters);
    if (catalogMatch.match)
        return catalogMatch.match;
    const candidates = await prisma_1.prisma.transporter.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        take: 8,
        select: { id: true, name: true },
    });
    if (candidates.length === 1)
        return candidates[0];
    if (candidates.length > 1) {
        throw new Error(`Transporter "${query}" is ambiguous. Candidates: ${candidates
            .map((candidate) => `${candidate.name} (${candidate.id})`)
            .join("; ")}. Ask the user which one to use.`);
    }
    throw new Error(`Transporter "${query}" was not found. Try a different name or use search_transporters.`);
}
const orderSelect = {
    id: true,
    customeOrderId: true,
    isVerifiedByAdmin: true,
    customerId: true,
    OrderStatusType: { select: { id: true, name: true, displayName: true } },
    Customer: {
        select: {
            name: true,
            CustomerDetail: { select: { dbName: true, dbCategory: true }, take: 1 },
        },
    },
    OrderItem: {
        select: {
            productId: true,
            quantity: true,
            Product: { select: { name: true, productCode: true } },
        },
    },
    _count: { select: { StockRecord: true } },
};
async function resolveOrder(input) {
    const rawId = input.orderId?.trim();
    const code = input.orderCode?.trim();
    const where = rawId
        ? (0, ai_utils_1.isObjectId)(rawId)
            ? { id: rawId }
            : { customeOrderId: rawId }
        : code
            ? { customeOrderId: code }
            : null;
    if (!where) {
        throw new Error("Provide orderId or orderCode.");
    }
    const order = await prisma_1.prisma.order.findFirst({ where, select: orderSelect });
    if (!order) {
        const key = rawId ?? code;
        throw new Error(`Order "${key}" was not found.`);
    }
    return order;
}
const purchaseSelect = {
    id: true,
    transporterId: true,
    vehicleNumber: true,
    driverContact: true,
    grnNumber: true,
    purchaseTransportStatus: true,
    purchaseDate: true,
    markedArrivedAt: true,
    TargetUnloadingDate: true,
    markedUnloadingAt: true,
    markedUnloadedAt: true,
    VehicleExitedAt: true,
    markedCompletedAt: true,
    stockAddedAt: true,
    Transporter: { select: { id: true, name: true } },
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
        include: { product: { select: { name: true, productCode: true } } },
    },
    stockBatches: { select: { id: true } },
};
function purchaseLabel(purchase) {
    const invoices = purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
    return [
        purchase.vehicleNumber ? `vehicle ${purchase.vehicleNumber}` : null,
        purchase.grnNumber ? `GRN ${purchase.grnNumber}` : null,
        invoices ? `invoice ${invoices}` : null,
        `id ${purchase.id}`,
    ]
        .filter(Boolean)
        .join(" / ");
}
async function resolvePurchase(input) {
    const purchaseId = input.purchaseId?.trim();
    if (purchaseId && (0, ai_utils_1.isObjectId)(purchaseId)) {
        const purchase = await prisma_1.prisma.purchase.findUnique({
            where: { id: purchaseId },
            select: purchaseSelect,
        });
        if (!purchase)
            throw new Error(`Purchase id ${purchaseId} was not found.`);
        return purchase;
    }
    const or = [];
    if (purchaseId) {
        or.push({ grnNumber: { contains: purchaseId } }, { vehicleNumber: { contains: purchaseId } }, { PurchaseInvoice: { some: { invoiceID: { contains: purchaseId } } } });
    }
    if (input.grnNumber)
        or.push({ grnNumber: { contains: input.grnNumber } });
    if (input.vehicleNumber) {
        or.push({ vehicleNumber: { contains: input.vehicleNumber } });
    }
    if (input.invoiceID) {
        or.push({ PurchaseInvoice: { some: { invoiceID: { contains: input.invoiceID } } } });
    }
    if (!or.length) {
        throw new Error("Provide purchaseId, grnNumber, invoiceID, or vehicleNumber.");
    }
    const matches = await prisma_1.prisma.purchase.findMany({
        where: { OR: or },
        take: 6,
        orderBy: { createdAt: "desc" },
        select: purchaseSelect,
    });
    if (!matches.length) {
        throw new Error("No purchase matched those details. Try search_purchases.");
    }
    if (matches.length > 1) {
        throw new Error(`Multiple purchases match. Candidates: ${matches
            .map(purchaseLabel)
            .join("; ")}. Ask the user which one to use.`);
    }
    return matches[0];
}
//# sourceMappingURL=ai.resolve.js.map