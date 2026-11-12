"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFulfillment = exports.updateFulfillment = exports.createFulfillment = exports.deleteProductAllocation = exports.updateProductAllocation = exports.createProductAllocation = exports.getProductAllocationById = exports.getDueAllocation = exports.getPartySheetPreview = exports.listProductAllocations = void 0;
const prisma_1 = require("../../lib/prisma");
const getCreatedByForStockRecord_1 = require("../../lib/getCreatedByForStockRecord");
const ALLOCATION_ORDER_WINDOW_DAYS = 60;
const batchInclude = {
    select: {
        id: true,
        stockBatchId: true,
        stockBatch: {
            select: {
                id: true,
                stockQuantity: true,
                arrivalDate: true,
                manufacturingDate: true,
                expiryDate: true,
                purchaseInvoiceId: true,
                PurchaseInvoice: {
                    select: { id: true, invoiceID: true, invoiceDate: true },
                },
            },
        },
    },
};
const detailInclude = {
    Product: {
        select: { id: true, name: true, productCode: true },
    },
    batches: batchInclude,
    CreatedByUser: {
        select: { id: true, name: true, email: true },
    },
    lines: {
        orderBy: { createdAt: "asc" },
    },
};
/** Same completed-status id used by order / orderItem controllers */
const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";
/** Sri Agrawal Enterprises — allocatedQty is auto-sum of tagged parties. */
const AUTO_AGGREGATED_ALLOCATION_CUSTOMER_ID = "696e47448186884e8bb58c32";
function allocationOrderWindow(allocationDate) {
    const start = new Date(allocationDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + ALLOCATION_ORDER_WINDOW_DAYS);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
function serializeStockBatch(batch) {
    return {
        id: batch.id,
        stockQuantity: batch.stockQuantity,
        arrivalDate: batch.arrivalDate.toISOString(),
        manufacturingDate: batch.manufacturingDate.toISOString(),
        expiryDate: batch.expiryDate.toISOString(),
        purchaseInvoiceId: batch.purchaseInvoiceId,
        invoice: batch.PurchaseInvoice
            ? {
                id: batch.PurchaseInvoice.id,
                invoiceID: batch.PurchaseInvoice.invoiceID,
                invoiceDate: batch.PurchaseInvoice.invoiceDate
                    ? batch.PurchaseInvoice.invoiceDate.toISOString()
                    : null,
            }
            : null,
    };
}
/**
 * Product IDs in scope for allocation: all products sharing the selected
 * product's productGroupId, or just the selected product when it has no group.
 */
async function getProductIdsForAllocationScope(productId) {
    const product = await prisma_1.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, productGroupId: true },
    });
    if (!product?.productGroupId) {
        return [productId];
    }
    const siblings = await prisma_1.prisma.product.findMany({
        where: { productGroupId: product.productGroupId },
        select: { id: true },
    });
    return siblings.map((p) => p.id);
}
/** Map each product id to its allocation-scope ids (group siblings, or itself). */
async function getScopedProductIdsForMany(productIds) {
    const result = new Map();
    const unique = [...new Set(productIds)];
    if (unique.length === 0)
        return result;
    const products = await prisma_1.prisma.product.findMany({
        where: { id: { in: unique } },
        select: { id: true, productGroupId: true },
    });
    const groupIds = [
        ...new Set(products
            .map((p) => p.productGroupId)
            .filter((id) => Boolean(id))),
    ];
    const siblings = groupIds.length === 0
        ? []
        : await prisma_1.prisma.product.findMany({
            where: { productGroupId: { in: groupIds } },
            select: { id: true, productGroupId: true },
        });
    const idsByGroup = new Map();
    for (const sibling of siblings) {
        if (!sibling.productGroupId)
            continue;
        const list = idsByGroup.get(sibling.productGroupId) ?? [];
        list.push(sibling.id);
        idsByGroup.set(sibling.productGroupId, list);
    }
    for (const product of products) {
        result.set(product.id, product.productGroupId
            ? (idsByGroup.get(product.productGroupId) ?? [product.id])
            : [product.id]);
    }
    for (const id of unique) {
        if (!result.has(id))
            result.set(id, [id]);
    }
    return result;
}
/**
 * Monthly average quantity sold of the product's group (all products sharing
 * productGroupId) to each customer over the rolling last 3 months, from
 * completed OrderItems. Falls back to the single product when it has no group.
 */
async function getAvgSaleLast3MonthsFromOrderItems(productId, customerIds) {
    const result = new Map();
    for (const id of customerIds) {
        result.set(id, { avgSaleLast3Months: 0 });
    }
    if (customerIds.length === 0)
        return result;
    const productIds = await getProductIdsForAllocationScope(productId);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    const items = await prisma_1.prisma.orderItem.findMany({
        where: {
            productId: { in: productIds },
            customerId: { in: customerIds },
            OR: [
                { orderCompleted: true },
                { Order: { orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID } },
            ],
        },
        select: {
            customerId: true,
            quantity: true,
            orderDate: true,
            createdAt: true,
            Order: { select: { orderDate: true } },
        },
    });
    const totalByCustomer = new Map();
    for (const item of items) {
        const when = item.orderDate ?? item.Order?.orderDate ?? item.createdAt;
        if (when < start || when > end)
            continue;
        totalByCustomer.set(item.customerId, (totalByCustomer.get(item.customerId) ?? 0) + item.quantity);
    }
    for (const customerId of customerIds) {
        const total = totalByCustomer.get(customerId) ?? 0;
        const avg = total > 0 ? Math.round((total / 3) * 100) / 100 : 0;
        result.set(customerId, { avgSaleLast3Months: avg });
    }
    return result;
}
/**
 * Product-level orders for each customer in
 * [allocationDate, allocationDate + 60 days] (any stock batch).
 */
async function getProductOrdersByCustomerInWindow(productId, customerIds, allocationDate) {
    const result = new Map();
    if (customerIds.length === 0)
        return result;
    const { start, end } = allocationOrderWindow(allocationDate);
    const items = await prisma_1.prisma.orderItem.findMany({
        where: {
            productId,
            customerId: { in: customerIds },
            Order: {
                orderDate: { gte: start, lte: end },
            },
        },
        select: {
            customerId: true,
            quantity: true,
            Order: { select: { orderDate: true } },
        },
    });
    const annotated = [];
    for (const item of items) {
        if (!item.Order)
            continue;
        annotated.push({
            customerId: item.customerId,
            billDate: item.Order.orderDate,
            billQty: item.quantity,
        });
    }
    annotated.sort((a, b) => a.billDate.getTime() - b.billDate.getTime());
    for (const row of annotated) {
        if (!result.has(row.customerId))
            result.set(row.customerId, []);
        result.get(row.customerId).push({
            billDate: row.billDate.toISOString(),
            billQty: row.billQty,
        });
    }
    return result;
}
async function getBilledQtyByCustomerInWindow(productId, customerIds, allocationDate) {
    const bills = await getProductOrdersByCustomerInWindow(productId, customerIds, allocationDate);
    const map = new Map();
    for (const [customerId, list] of bills) {
        map.set(customerId, list.reduce((s, b) => s + b.billQty, 0));
    }
    return map;
}
async function buildPartySheet(args) {
    const { productId, allocationDate, linesByCustomerId } = args;
    const customers = await prisma_1.prisma.user.findMany({
        where: { userType: "CUSTOMER" },
        select: {
            id: true,
            name: true,
            email: true,
            CustomerDetail: {
                select: {
                    dbName: true,
                    dbCategory: true,
                    PartyReportTag: { select: { id: true, name: true } },
                },
                take: 1,
            },
        },
    });
    const customerIds = customers.map((c) => c.id);
    const [saleHelpers, orderBills] = await Promise.all([
        getAvgSaleLast3MonthsFromOrderItems(productId, customerIds),
        getProductOrdersByCustomerInWindow(productId, customerIds, allocationDate),
    ]);
    const parties = customers.map((c) => {
        const detail = c.CustomerDetail[0];
        const line = linesByCustomerId.get(c.id);
        const allocatedQty = line?.allocatedQty ?? 0;
        const bills = orderBills.get(c.id) ?? [];
        const billedQty = bills.reduce((s, b) => s + b.billQty, 0);
        const helpers = saleHelpers.get(c.id);
        const lastBillDate = bills.length > 0 ? bills[bills.length - 1].billDate : null;
        return {
            customerId: c.id,
            dbName: detail?.dbName ?? c.name,
            name: c.name,
            email: c.email,
            dbCategory: detail?.dbCategory ?? null,
            partyReportTag: detail?.PartyReportTag ?? null,
            lineId: line?.id ?? null,
            allocatedQty,
            avgSaleLast3Months: helpers?.avgSaleLast3Months ?? 0,
            lastBillDate,
            bills,
            billedQty,
            balanceQty: allocatedQty - billedQty,
        };
    });
    parties.sort((a, b) => {
        const tagA = a.partyReportTag?.name ?? "Haldiram parties";
        const tagB = b.partyReportTag?.name ?? "Haldiram parties";
        const isHaldiram = (tag) => /haldiram/i.test(tag);
        if (isHaldiram(tagA) !== isHaldiram(tagB)) {
            return isHaldiram(tagA) ? -1 : 1;
        }
        const tagCmp = tagA.localeCompare(tagB);
        if (tagCmp !== 0)
            return tagCmp;
        return a.dbName.localeCompare(b.dbName);
    });
    return parties;
}
function serializeAllocationHeader(allocation) {
    const allocatedTotal = allocation.lines.reduce((s, l) => s + l.allocatedQty, 0);
    const stockBatches = allocation.batches.map((b) => serializeStockBatch(b.stockBatch));
    return {
        id: allocation.id,
        productId: allocation.productId,
        stockBatchIds: allocation.batches.map((b) => b.stockBatchId),
        allocationDate: allocation.allocationDate.toISOString(),
        receivedQty: allocation.receivedQty,
        notes: allocation.notes,
        createdByUserId: allocation.createdByUserId,
        createdAt: allocation.createdAt.toISOString(),
        updatedAt: allocation.updatedAt.toISOString(),
        product: allocation.Product,
        stockBatches,
        createdBy: allocation.CreatedByUser,
        allocatedTotal,
        remainingToAllocate: allocation.receivedQty - allocatedTotal,
        partyCount: allocation.lines.filter((l) => l.allocatedQty > 0).length,
    };
}
async function serializeAllocationFull(allocation) {
    const linesByCustomerId = new Map(allocation.lines.map((l) => [
        l.customerId,
        { id: l.id, allocatedQty: l.allocatedQty },
    ]));
    const parties = await buildPartySheet({
        productId: allocation.productId,
        allocationDate: allocation.allocationDate,
        linesByCustomerId,
    });
    const billedTotal = parties.reduce((s, p) => s + p.billedQty, 0);
    const header = serializeAllocationHeader(allocation);
    return {
        ...header,
        billedTotal,
        parties,
    };
}
function validateLinesAgainstReceived(lines, receivedQty) {
    const seen = new Set();
    let sum = 0;
    for (const line of lines) {
        if (seen.has(line.customerId)) {
            return { ok: false, message: "Duplicate customer in allocation lines" };
        }
        seen.add(line.customerId);
        sum += line.allocatedQty;
    }
    if (sum > receivedQty) {
        return {
            ok: false,
            message: `Total allocated quantity (${sum}) exceeds received quantity (${receivedQty})`,
        };
    }
    return { ok: true };
}
/** Overwrite Sri Agrawal line with sum of tagged parties' allocatedQty. */
function applyAutoAggregatedLine(lines, customersWithTagIds) {
    const withoutAuto = lines.filter((l) => l.customerId !== AUTO_AGGREGATED_ALLOCATION_CUSTOMER_ID);
    const sum = withoutAuto
        .filter((l) => customersWithTagIds.has(l.customerId))
        .reduce((s, l) => s + l.allocatedQty, 0);
    if (sum > 0) {
        return [
            ...withoutAuto,
            {
                customerId: AUTO_AGGREGATED_ALLOCATION_CUSTOMER_ID,
                allocatedQty: sum,
            },
        ];
    }
    return withoutAuto;
}
async function resolveAutoAggregatedLines(lines) {
    const candidateIds = lines
        .map((l) => l.customerId)
        .filter((id) => id !== AUTO_AGGREGATED_ALLOCATION_CUSTOMER_ID);
    if (candidateIds.length === 0) {
        return applyAutoAggregatedLine(lines, new Set());
    }
    const details = await prisma_1.prisma.customerDetail.findMany({
        where: {
            dbUserId: { in: candidateIds },
            partyReportTagId: { not: null },
        },
        select: { dbUserId: true },
    });
    const customersWithTagIds = new Set(details.map((d) => d.dbUserId));
    return applyAutoAggregatedLine(lines, customersWithTagIds);
}
function parseStockBatchIdsQuery(raw) {
    if (Array.isArray(raw)) {
        return raw
            .flatMap((v) => String(v).split(","))
            .map((s) => s.trim())
            .filter(Boolean);
    }
    if (typeof raw === "string" && raw.trim()) {
        return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}
const listProductAllocations = async (req, res) => {
    try {
        const query = req.allocationQuery ?? {
            page: 1,
            limit: 50,
        };
        const where = {};
        if (query.productId)
            where.productId = query.productId;
        if (query.startDate || query.endDate) {
            where.allocationDate = {};
            if (query.startDate)
                where.allocationDate.gte = new Date(query.startDate);
            if (query.endDate)
                where.allocationDate.lte = new Date(query.endDate);
        }
        const page = query.page || 1;
        const limit = Math.min(query.limit || 50, 200);
        const skip = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            prisma_1.prisma.productAllocation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { allocationDate: "desc" },
                include: detailInclude,
            }),
            prisma_1.prisma.productAllocation.count({ where }),
        ]);
        const allocations = await Promise.all(rows.map(async (r) => {
            const header = serializeAllocationHeader(r);
            const customerIds = r.lines.map((l) => l.customerId);
            const billedMap = await getBilledQtyByCustomerInWindow(r.productId, customerIds, r.allocationDate);
            let billedTotal = 0;
            for (const line of r.lines) {
                billedTotal += billedMap.get(line.customerId) ?? 0;
            }
            return { ...header, billedTotal, parties: undefined };
        }));
        res.json({
            allocations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        console.error("Error listing product allocations:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.listProductAllocations = listProductAllocations;
/** Preview party sheet before/without an allocation (create flow) */
const getPartySheetPreview = async (req, res) => {
    try {
        const productId = String(req.query.productId || "");
        const stockBatchIds = [...new Set(parseStockBatchIdsQuery(req.query.stockBatchIds))];
        const allocationDateRaw = String(req.query.allocationDate || "");
        if (!productId || productId.length !== 24) {
            return res.status(400).json({ message: "productId is required" });
        }
        if (stockBatchIds.length === 0) {
            return res.status(400).json({ message: "stockBatchIds is required" });
        }
        if (stockBatchIds.some((id) => id.length !== 24)) {
            return res.status(400).json({ message: "Invalid stockBatchIds" });
        }
        if (!allocationDateRaw) {
            return res.status(400).json({ message: "allocationDate is required" });
        }
        const allocationDate = new Date(allocationDateRaw);
        if (Number.isNaN(allocationDate.getTime())) {
            return res.status(400).json({ message: "Invalid allocationDate" });
        }
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, productCode: true },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const batches = await prisma_1.prisma.stockBatch.findMany({
            where: { id: { in: stockBatchIds } },
            select: {
                id: true,
                productId: true,
                stockQuantity: true,
                arrivalDate: true,
                manufacturingDate: true,
                expiryDate: true,
                purchaseInvoiceId: true,
                PurchaseInvoice: {
                    select: { id: true, invoiceID: true, invoiceDate: true },
                },
            },
        });
        if (batches.length !== stockBatchIds.length) {
            return res.status(404).json({ message: "One or more stock batches not found" });
        }
        const scopedProductIds = await getProductIdsForAllocationScope(productId);
        const scopedSet = new Set(scopedProductIds);
        if (batches.some((b) => !scopedSet.has(b.productId))) {
            return res.status(400).json({
                message: "One or more stock batches do not belong to the selected product or its product group",
            });
        }
        const existingLinks = await prisma_1.prisma.productAllocationBatch.findMany({
            where: { stockBatchId: { in: stockBatchIds } },
            select: { stockBatchId: true, allocationId: true },
        });
        if (existingLinks.length > 0) {
            return res.status(409).json({
                message: "An allocation already exists for one or more selected stock batches",
                allocationId: existingLinks[0].allocationId,
                stockBatchIds: existingLinks.map((l) => l.stockBatchId),
            });
        }
        const receivedQty = batches.reduce((s, b) => s + b.stockQuantity, 0);
        const parties = await buildPartySheet({
            productId,
            allocationDate,
            linesByCustomerId: new Map(),
        });
        res.json({
            product,
            stockBatches: batches.map((b) => serializeStockBatch(b)),
            receivedQty,
            parties,
        });
    }
    catch (error) {
        console.error("Error building party sheet preview:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPartySheetPreview = getPartySheetPreview;
/**
 * GET /api/product-allocations/due?customerId=
 * Returns remaining allocation balance per product for a distributor.
 *
 * Per product group: sum allocatedQty across lines; billed = order item qty
 * of any product in the group that falls in the union of each line's
 * [allocationDate, +60d] window (each order item counted at most once);
 * balanceQty = max(0, allocated - billed). Remaining is returned for every
 * product in the group so the order grid can show due on sibling SKUs.
 */
const getDueAllocation = async (req, res) => {
    try {
        const customerId = String(req.query.customerId || "");
        if (!customerId || customerId.length !== 24) {
            return res.status(400).json({ message: "customerId is required" });
        }
        const customer = await prisma_1.prisma.user.findUnique({
            where: { id: customerId },
            select: { id: true, userType: true },
        });
        if (!customer || customer.userType !== "CUSTOMER") {
            return res.status(404).json({ message: "Customer not found" });
        }
        const lines = await prisma_1.prisma.productAllocationLine.findMany({
            where: { customerId },
            select: {
                allocatedQty: true,
                allocation: {
                    select: {
                        productId: true,
                        allocationDate: true,
                    },
                },
            },
        });
        const byProduct = new Map();
        for (const line of lines) {
            const { productId, allocationDate } = line.allocation;
            const window = allocationOrderWindow(allocationDate);
            let agg = byProduct.get(productId);
            if (!agg) {
                agg = { totalAllocated: 0, windows: [] };
                byProduct.set(productId, agg);
            }
            agg.totalAllocated += line.allocatedQty;
            agg.windows.push(window);
        }
        const scopedByProduct = await getScopedProductIdsForMany([
            ...byProduct.keys(),
        ]);
        const byGroup = new Map();
        for (const [productId, agg] of byProduct) {
            const productIds = scopedByProduct.get(productId) ?? [productId];
            const key = [...productIds].sort().join(",") || productId;
            let group = byGroup.get(key);
            if (!group) {
                group = {
                    totalAllocated: 0,
                    windows: [],
                    productIds: [...productIds],
                };
                byGroup.set(key, group);
            }
            group.totalAllocated += agg.totalAllocated;
            group.windows.push(...agg.windows);
        }
        const due = [];
        await Promise.all(Array.from(byGroup.values()).map(async (agg) => {
            if (agg.totalAllocated <= 0)
                return;
            let minStart = agg.windows[0].start;
            let maxEnd = agg.windows[0].end;
            for (const w of agg.windows) {
                if (w.start < minStart)
                    minStart = w.start;
                if (w.end > maxEnd)
                    maxEnd = w.end;
            }
            const items = await prisma_1.prisma.orderItem.findMany({
                where: {
                    productId: { in: agg.productIds },
                    customerId,
                    Order: {
                        orderDate: { gte: minStart, lte: maxEnd },
                    },
                },
                select: {
                    id: true,
                    quantity: true,
                    Order: { select: { orderDate: true } },
                },
            });
            let billed = 0;
            for (const item of items) {
                const orderDate = item.Order?.orderDate;
                if (!orderDate)
                    continue;
                const inAnyWindow = agg.windows.some((w) => orderDate >= w.start && orderDate <= w.end);
                if (inAnyWindow)
                    billed += item.quantity;
            }
            const balanceQty = Math.max(0, agg.totalAllocated - billed);
            if (balanceQty > 0) {
                for (const productId of agg.productIds) {
                    due.push({ productId, balanceQty });
                }
            }
        }));
        res.json({ customerId, due });
    }
    catch (error) {
        console.error("Error fetching due allocation:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getDueAllocation = getDueAllocation;
const getProductAllocationById = async (req, res) => {
    try {
        const { id } = req.params;
        const allocation = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: detailInclude,
        });
        if (!allocation) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        const full = await serializeAllocationFull(allocation);
        res.json({ allocation: full });
    }
    catch (error) {
        console.error("Error fetching product allocation:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductAllocationById = getProductAllocationById;
const createProductAllocation = async (req, res) => {
    try {
        const { productId, stockBatchIds, allocationDate, notes, lines } = req.body;
        const uniqueBatchIds = [...new Set(stockBatchIds ?? [])];
        if (uniqueBatchIds.length === 0) {
            return res.status(400).json({ message: "At least one stock batch is required" });
        }
        const product = await prisma_1.prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const batches = await prisma_1.prisma.stockBatch.findMany({
            where: { id: { in: uniqueBatchIds } },
        });
        if (batches.length !== uniqueBatchIds.length) {
            return res.status(404).json({ message: "One or more stock batches not found" });
        }
        const scopedProductIds = await getProductIdsForAllocationScope(productId);
        const scopedSet = new Set(scopedProductIds);
        if (batches.some((b) => !scopedSet.has(b.productId))) {
            return res.status(400).json({
                message: "One or more stock batches do not belong to the selected product or its product group",
            });
        }
        const existingLinks = await prisma_1.prisma.productAllocationBatch.findMany({
            where: { stockBatchId: { in: uniqueBatchIds } },
            select: { stockBatchId: true, allocationId: true },
        });
        if (existingLinks.length > 0) {
            return res.status(409).json({
                message: "An allocation already exists for one or more selected stock batches",
                allocationId: existingLinks[0].allocationId,
                stockBatchIds: existingLinks.map((l) => l.stockBatchId),
            });
        }
        const receivedQty = batches.reduce((s, b) => s + b.stockQuantity, 0);
        const persistedLines = await resolveAutoAggregatedLines((lines ?? []).filter((l) => l.allocatedQty > 0));
        const lineCheck = validateLinesAgainstReceived(persistedLines, receivedQty);
        if (!lineCheck.ok) {
            return res.status(400).json({ message: lineCheck.message });
        }
        if (persistedLines.length > 0) {
            const customerIds = persistedLines.map((l) => l.customerId);
            const customers = await prisma_1.prisma.user.findMany({
                where: { id: { in: customerIds }, userType: "CUSTOMER" },
                select: { id: true },
            });
            if (customers.length !== customerIds.length) {
                return res
                    .status(400)
                    .json({ message: "One or more customers are invalid" });
            }
        }
        const allocDate = new Date(allocationDate);
        const billedMap = await getBilledQtyByCustomerInWindow(productId, persistedLines.map((l) => l.customerId), allocDate);
        for (const line of persistedLines) {
            const billed = billedMap.get(line.customerId) ?? 0;
            if (line.allocatedQty < billed) {
                return res.status(400).json({
                    message: `Allocated quantity cannot be less than already billed quantity (${billed}) for a customer`,
                });
            }
        }
        const createdByUserId = await (0, getCreatedByForStockRecord_1.getCreatedByForStockRecord)(req);
        const allocation = await prisma_1.prisma.productAllocation.create({
            data: {
                productId,
                allocationDate: allocDate,
                receivedQty,
                notes: notes ?? null,
                createdByUserId,
                batches: {
                    create: uniqueBatchIds.map((stockBatchId) => ({ stockBatchId })),
                },
                lines: {
                    create: persistedLines.map((l) => ({
                        customerId: l.customerId,
                        allocatedQty: l.allocatedQty,
                    })),
                },
            },
            include: detailInclude,
        });
        const full = await serializeAllocationFull(allocation);
        res.status(201).json({ allocation: full });
    }
    catch (error) {
        console.error("Error creating product allocation:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createProductAllocation = createProductAllocation;
const updateProductAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { allocationDate, notes, lines } = req.body;
        const existing = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!existing) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        const effectiveAllocationDate = allocationDate !== undefined
            ? new Date(allocationDate)
            : existing.allocationDate;
        if (lines !== undefined) {
            const persistedLines = await resolveAutoAggregatedLines(lines.filter((l) => l.allocatedQty > 0));
            const lineCheck = validateLinesAgainstReceived(persistedLines, existing.receivedQty);
            if (!lineCheck.ok) {
                return res.status(400).json({ message: lineCheck.message });
            }
            const customerIds = persistedLines.map((l) => l.customerId);
            if (customerIds.length > 0) {
                const customers = await prisma_1.prisma.user.findMany({
                    where: { id: { in: customerIds }, userType: "CUSTOMER" },
                    select: { id: true },
                });
                if (customers.length !== customerIds.length) {
                    return res
                        .status(400)
                        .json({ message: "One or more customers are invalid" });
                }
            }
            const allCustomerIds = [
                ...new Set([
                    ...persistedLines.map((l) => l.customerId),
                    ...existing.lines.map((l) => l.customerId),
                ]),
            ];
            const billedMap = await getBilledQtyByCustomerInWindow(existing.productId, allCustomerIds, effectiveAllocationDate);
            for (const line of persistedLines) {
                const billed = billedMap.get(line.customerId) ?? 0;
                if (line.allocatedQty < billed) {
                    return res.status(400).json({
                        message: `Allocated quantity for a customer cannot be less than already billed quantity (${billed})`,
                    });
                }
            }
            const newCustomerSet = new Set(persistedLines.map((l) => l.customerId));
            for (const [customerId, billed] of billedMap) {
                if (billed > 0 && !newCustomerSet.has(customerId)) {
                    return res.status(400).json({
                        message: "Cannot remove a party that already has orders in the allocation window",
                    });
                }
            }
            await prisma_1.prisma.$transaction(async (tx) => {
                const existingByCustomer = new Map(existing.lines.map((l) => [l.customerId, l]));
                const keepIds = new Set();
                for (const line of persistedLines) {
                    const prev = existingByCustomer.get(line.customerId);
                    if (prev) {
                        await tx.productAllocationLine.update({
                            where: { id: prev.id },
                            data: { allocatedQty: line.allocatedQty },
                        });
                        keepIds.add(prev.id);
                    }
                    else {
                        const created = await tx.productAllocationLine.create({
                            data: {
                                allocationId: id,
                                customerId: line.customerId,
                                allocatedQty: line.allocatedQty,
                            },
                        });
                        keepIds.add(created.id);
                    }
                }
                const toDelete = existing.lines.filter((l) => !keepIds.has(l.id));
                if (toDelete.length > 0) {
                    const deleteIds = toDelete.map((l) => l.id);
                    await tx.productAllocationFulfillment.deleteMany({
                        where: { allocationLineId: { in: deleteIds } },
                    });
                    await tx.productAllocationLine.deleteMany({
                        where: { id: { in: deleteIds } },
                    });
                }
                await tx.productAllocation.update({
                    where: { id },
                    data: {
                        ...(allocationDate !== undefined
                            ? { allocationDate: new Date(allocationDate) }
                            : {}),
                        ...(notes !== undefined ? { notes } : {}),
                    },
                });
            });
        }
        else {
            await prisma_1.prisma.productAllocation.update({
                where: { id },
                data: {
                    ...(allocationDate !== undefined
                        ? { allocationDate: new Date(allocationDate) }
                        : {}),
                    ...(notes !== undefined ? { notes } : {}),
                },
            });
        }
        const updated = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: detailInclude,
        });
        if (!updated) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        const full = await serializeAllocationFull(updated);
        res.json({ allocation: full });
    }
    catch (error) {
        console.error("Error updating product allocation:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProductAllocation = updateProductAllocation;
const deleteProductAllocation = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: { lines: { select: { id: true } } },
        });
        if (!existing) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        const lineIds = existing.lines.map((l) => l.id);
        await prisma_1.prisma.$transaction(async (tx) => {
            if (lineIds.length > 0) {
                await tx.productAllocationFulfillment.deleteMany({
                    where: { allocationLineId: { in: lineIds } },
                });
                await tx.productAllocationLine.deleteMany({
                    where: { allocationId: id },
                });
            }
            await tx.productAllocationBatch.deleteMany({
                where: { allocationId: id },
            });
            await tx.productAllocation.delete({ where: { id } });
        });
        res.json({ message: "Allocation deleted" });
    }
    catch (error) {
        console.error("Error deleting product allocation:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteProductAllocation = deleteProductAllocation;
// Fulfillment endpoints retained but unused by the Excel sheet UI
const createFulfillment = async (req, res) => {
    try {
        const { id, lineId } = req.params;
        const { billDate, billQty } = req.body;
        const allocation = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!allocation) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        const line = allocation.lines.find((l) => l.id === lineId);
        if (!line) {
            return res.status(404).json({ message: "Allocation line not found" });
        }
        const billedMap = await getBilledQtyByCustomerInWindow(allocation.productId, [line.customerId], allocation.allocationDate);
        const billed = billedMap.get(line.customerId) ?? 0;
        const balance = line.allocatedQty - billed;
        if (billQty > balance) {
            return res.status(400).json({
                message: `Bill quantity (${billQty}) exceeds remaining balance (${balance})`,
            });
        }
        const fulfillment = await prisma_1.prisma.productAllocationFulfillment.create({
            data: {
                allocationLineId: lineId,
                billDate: new Date(billDate),
                billQty,
            },
        });
        const refreshed = await prisma_1.prisma.productAllocation.findUnique({
            where: { id },
            include: detailInclude,
        });
        if (!refreshed) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        res.status(201).json({
            fulfillment: {
                id: fulfillment.id,
                allocationLineId: fulfillment.allocationLineId,
                billDate: fulfillment.billDate.toISOString(),
                billQty: fulfillment.billQty,
                createdAt: fulfillment.createdAt.toISOString(),
                updatedAt: fulfillment.updatedAt.toISOString(),
            },
            allocation: await serializeAllocationFull(refreshed),
        });
    }
    catch (error) {
        console.error("Error creating fulfillment:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createFulfillment = createFulfillment;
const updateFulfillment = async (req, res) => {
    try {
        const { fulfillmentId } = req.params;
        const { billDate, billQty } = req.body;
        const existing = await prisma_1.prisma.productAllocationFulfillment.findUnique({
            where: { id: fulfillmentId },
            include: { line: true },
        });
        if (!existing) {
            return res.status(404).json({ message: "Fulfillment not found" });
        }
        await prisma_1.prisma.productAllocationFulfillment.update({
            where: { id: fulfillmentId },
            data: {
                ...(billDate !== undefined ? { billDate: new Date(billDate) } : {}),
                ...(billQty !== undefined ? { billQty } : {}),
            },
        });
        const allocation = await prisma_1.prisma.productAllocation.findUnique({
            where: { id: existing.line.allocationId },
            include: detailInclude,
        });
        if (!allocation) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        res.json({ allocation: await serializeAllocationFull(allocation) });
    }
    catch (error) {
        console.error("Error updating fulfillment:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateFulfillment = updateFulfillment;
const deleteFulfillment = async (req, res) => {
    try {
        const { fulfillmentId } = req.params;
        const existing = await prisma_1.prisma.productAllocationFulfillment.findUnique({
            where: { id: fulfillmentId },
            include: { line: true },
        });
        if (!existing) {
            return res.status(404).json({ message: "Fulfillment not found" });
        }
        const allocationId = existing.line.allocationId;
        await prisma_1.prisma.productAllocationFulfillment.delete({
            where: { id: fulfillmentId },
        });
        const allocation = await prisma_1.prisma.productAllocation.findUnique({
            where: { id: allocationId },
            include: detailInclude,
        });
        if (!allocation) {
            return res.status(404).json({ message: "Allocation not found" });
        }
        res.json({
            message: "Fulfillment deleted",
            allocation: await serializeAllocationFull(allocation),
        });
    }
    catch (error) {
        console.error("Error deleting fulfillment:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteFulfillment = deleteFulfillment;
//# sourceMappingURL=product-allocation.controller.js.map