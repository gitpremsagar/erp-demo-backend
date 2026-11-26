"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proposeCreateOrderDraft = proposeCreateOrderDraft;
exports.proposeUpdateOrderStatus = proposeUpdateOrderStatus;
exports.proposeVerifyOrderStock = proposeVerifyOrderStock;
exports.proposeCreatePurchase = proposeCreatePurchase;
exports.proposeUpdatePurchaseStatus = proposeUpdatePurchaseStatus;
exports.proposeAddPurchaseToStock = proposeAddPurchaseToStock;
const crypto_1 = require("crypto");
const prisma_1 = require("../../lib/prisma");
const orderItemPriceSnapshot_1 = require("../../lib/orderItemPriceSnapshot");
const purchaseItemPriceSnapshot_1 = require("../../lib/purchaseItemPriceSnapshot");
const purchasePricing_1 = require("../purchase/purchasePricing");
const ai_catalogCache_1 = require("./ai.catalogCache");
const ai_resolve_1 = require("./ai.resolve");
const ai_utils_1 = require("./ai.utils");
function buildProposal(input) {
    return {
        id: `prop_${(0, crypto_1.randomUUID)()}`,
        action: input.action,
        title: input.title,
        summary: input.summary,
        method: input.method,
        endpoint: input.endpoint,
        target: {
            type: input.action.includes("purchase") ? "purchase" : "order",
            id: input.targetId,
            label: input.targetLabel,
        },
        payload: input.payload,
        preview: input.preview,
        risk: input.risk,
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
    };
}
function orderDateToIso(value) {
    const dateOnly = (0, ai_utils_1.parseDateOnly)(value);
    if (!dateOnly)
        return undefined;
    return new Date(`${dateOnly}T00:00:00.000+05:30`).toISOString();
}
function dateToIso(value) {
    const dateOnly = (0, ai_utils_1.parseDateOnly)(value);
    if (!dateOnly)
        return null;
    return new Date(`${dateOnly}T00:00:00.000+05:30`).toISOString();
}
function orderStatusLabel(status) {
    return status?.displayName?.trim() || status?.name || "No status";
}
async function proposeCreateOrderDraft(args, actorId) {
    const customer = await (0, ai_resolve_1.resolveCustomer)({
        customerId: args.customerId,
        customerQuery: args.customerQuery,
    });
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    const products = (0, ai_resolve_1.resolveProducts)(args.items, catalog.products);
    if (new Set(products.map((product) => product.id)).size !== products.length) {
        throw new Error("Duplicate product lines are not allowed in one order.");
    }
    const pendingStatus = (await prisma_1.prisma.orderStatusType.findFirst({ where: { name: "PENDING" } })) ??
        (await prisma_1.prisma.orderStatusType.findFirst({ orderBy: { sortOrder: "asc" } }));
    if (!pendingStatus) {
        throw new Error("No order statuses are configured. Ask an admin to set up order status types.");
    }
    const dbCategory = (0, orderItemPriceSnapshot_1.resolveDbCategory)(customer);
    let estimatedTotal = 0;
    const tableRows = [];
    args.items.forEach((item, index) => {
        const product = products[index];
        const snapshot = (0, orderItemPriceSnapshot_1.buildOrderItemPriceSnapshot)(product, dbCategory);
        const rates = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(snapshot);
        const lineTotal = rates
            ? item.quantity * rates.carton * (1 + rates.gstPercent / 100)
            : 0;
        estimatedTotal += lineTotal;
        tableRows.push([
            product.name,
            product.productCode,
            (0, ai_utils_1.formatNumber)(item.quantity),
            rates ? (0, ai_utils_1.formatInr)(rates.carton) : "Pricing missing",
            rates ? (0, ai_utils_1.formatInr)(lineTotal) : "—",
        ]);
    });
    const payload = {
        customerId: customer.id,
        orderItems: args.items.map((item, index) => ({
            productId: products[index].id,
            quantity: item.quantity,
        })),
        orderGeneratorId: actorId,
        orderStatusTypeId: pendingStatus.id,
        isVerifiedByAdmin: false,
    };
    const orderDateIso = orderDateToIso(args.orderDate);
    if (orderDateIso)
        payload.orderDate = orderDateIso;
    if (args.vehicleId)
        payload.vehicleId = args.vehicleId;
    if (args.driverId)
        payload.driverId = args.driverId;
    if (args.narration?.trim())
        payload.narration = args.narration.trim();
    const totalCartons = args.items.reduce((sum, item) => sum + item.quantity, 0);
    const customerLabel = customer.CustomerDetail[0]?.dbName || customer.name;
    return buildProposal({
        action: "create_order_draft",
        title: `Create draft order for ${customerLabel}`,
        summary: `${args.items.length} product line(s), ${(0, ai_utils_1.formatNumber)(totalCartons)} cartons. Saves as an unverified PENDING draft; stock is not reserved.`,
        method: "POST",
        endpoint: "/api/orders",
        targetId: "",
        targetLabel: `Draft order for ${customerLabel}`,
        payload,
        preview: {
            sections: [
                {
                    title: "Order",
                    rows: [
                        { label: "Customer", value: customerLabel },
                        { label: "Category", value: dbCategory },
                        { label: "Status", value: "PENDING (unverified draft)" },
                        { label: "Order date", value: args.orderDate ?? (0, ai_utils_1.istDateString)() },
                    ],
                },
            ],
            table: {
                columns: ["Product", "Code", "Qty", "Rate/carton", "Est. line"],
                rows: tableRows,
            },
            totals: [
                { label: "Cartons", value: (0, ai_utils_1.formatNumber)(totalCartons) },
                { label: "Estimated amount (incl. GST)", value: (0, ai_utils_1.formatInr)(estimatedTotal) },
            ],
            warnings: [
                "Draft orders do not reserve or deduct stock.",
                "Verify stock separately when the order is ready; that action deducts FIFO stock and writes StockRecords.",
            ],
        },
        risk: "low",
    });
}
async function proposeUpdateOrderStatus(args) {
    const order = await (0, ai_resolve_1.resolveOrder)({
        orderId: args.orderId,
        orderCode: args.orderCode,
    });
    const targetStatus = args.statusTypeId
        ? await prisma_1.prisma.orderStatusType.findUnique({ where: { id: args.statusTypeId } })
        : await prisma_1.prisma.orderStatusType.findFirst({
            where: { name: args.statusName ?? "" },
        });
    if (!targetStatus) {
        throw new Error("Target order status not found. Use list_order_status_types to see valid statuses.");
    }
    const currentLabel = orderStatusLabel(order.OrderStatusType);
    const nextLabel = targetStatus.displayName || targetStatus.name;
    const customerLabel = order.Customer?.CustomerDetail?.[0]?.dbName || order.Customer?.name || "Unknown customer";
    const isCompletion = targetStatus.name === "COMPLETE" || targetStatus.name === "COMPLETED";
    const warnings = [
        "This changes only the order status. It does not verify, reserve, or release stock.",
    ];
    if (isCompletion) {
        warnings.push("COMPLETE marks all order lines completed in reporting. Confirm only after delivery/fulfilment is finished.");
    }
    if (!order.isVerifiedByAdmin) {
        warnings.push("This order is still unverified, so no stock has been reserved for it.");
    }
    return buildProposal({
        action: "update_order_status",
        title: `Update status for ${order.customeOrderId}`,
        summary: `${customerLabel}: ${currentLabel} → ${nextLabel}`,
        method: "PATCH",
        endpoint: `/api/orders/${order.id}/status`,
        targetId: order.id,
        targetLabel: order.customeOrderId,
        payload: { orderStatusTypeId: targetStatus.id },
        preview: {
            sections: [
                {
                    title: "Order",
                    rows: [
                        { label: "Order", value: order.customeOrderId },
                        { label: "Customer", value: customerLabel },
                        { label: "Current status", value: currentLabel },
                        { label: "New status", value: nextLabel },
                    ],
                },
            ],
            warnings,
        },
        risk: isCompletion ? "medium" : "low",
    });
}
async function proposeVerifyOrderStock(args) {
    const order = await (0, ai_resolve_1.resolveOrder)({
        orderId: args.orderId,
        orderCode: args.orderCode,
    });
    const statusName = order.OrderStatusType?.name ?? "";
    if (statusName === "COMPLETE" || statusName === "COMPLETED") {
        throw new Error("Completed orders cannot be verified for stock.");
    }
    if (order.isVerifiedByAdmin) {
        throw new Error("This order is already verified; its stock is already reserved.");
    }
    if (!order.OrderItem.length) {
        throw new Error("This order has no items to verify.");
    }
    const productIds = order.OrderItem.map((item) => item.productId);
    const stockGrouped = await prisma_1.prisma.stockBatch.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, stockQuantity: { gt: 0 } },
        _sum: { stockQuantity: true },
    });
    const stockByProduct = new Map(stockGrouped.map((row) => [row.productId, row._sum.stockQuantity ?? 0]));
    const tableRows = [];
    const shortages = [];
    let totalCartons = 0;
    for (const item of order.OrderItem) {
        totalCartons += item.quantity;
        const available = stockByProduct.get(item.productId) ?? 0;
        const ok = available >= item.quantity;
        if (!ok) {
            shortages.push(`${item.Product?.name ?? item.productId}: needs ${item.quantity}, available ${available}`);
        }
        tableRows.push([
            item.Product?.name ?? "Unknown",
            item.Product?.productCode ?? "—",
            (0, ai_utils_1.formatNumber)(item.quantity),
            (0, ai_utils_1.formatNumber)(available),
            ok ? "OK" : "SHORT",
        ]);
    }
    if (shortages.length) {
        throw new Error(`Insufficient stock to verify this order: ${shortages.join("; ")}. Do not verify until stock is available.`);
    }
    const customerLabel = order.Customer?.CustomerDetail?.[0]?.dbName || order.Customer?.name || "Unknown customer";
    return buildProposal({
        action: "verify_order_stock",
        title: `Verify stock for ${order.customeOrderId}`,
        summary: `${customerLabel}: reserve ${(0, ai_utils_1.formatNumber)(totalCartons)} cartons across ${order.OrderItem.length} line(s) using FIFO stock.`,
        method: "POST",
        endpoint: `/api/orders/${order.id}/verify-stock`,
        targetId: order.id,
        targetLabel: order.customeOrderId,
        payload: {},
        preview: {
            sections: [
                {
                    title: "Order",
                    rows: [
                        { label: "Order", value: order.customeOrderId },
                        { label: "Customer", value: customerLabel },
                        { label: "Cartons", value: (0, ai_utils_1.formatNumber)(totalCartons) },
                    ],
                },
            ],
            table: {
                columns: ["Product", "Code", "Required", "Available", "Check"],
                rows: tableRows,
            },
            warnings: [
                "This deducts stock FIFO from the oldest arrival batches.",
                "It creates ASSIGNED_TO_ORDER StockRecords and marks the order verified.",
                "This action cannot be undone by the assistant.",
            ],
        },
        risk: "high",
    });
}
async function proposeCreatePurchase(args) {
    const transporter = await (0, ai_resolve_1.resolveTransporter)({
        transporterId: args.transporterId,
        transporterQuery: args.transporterQuery,
    });
    // Resolve every invoice line in one in-memory pass over the cached catalog.
    const catalog = await (0, ai_catalogCache_1.getCatalog)();
    const flatItems = args.invoices.flatMap((invoice) => invoice.items);
    const resolvedProducts = (0, ai_resolve_1.resolveProducts)(flatItems, catalog.products);
    const tableRows = [];
    const payloadInvoices = [];
    let totalCartons = 0;
    let totalAmount = 0;
    let offset = 0;
    const warnings = [
        "Creates purchase staging batches only. On-hand stock is not added until the purchase is COMPLETED or Add to stock is used.",
        "Invoice amounts are recomputed by the backend from product cost snapshots.",
    ];
    for (const invoice of args.invoices) {
        if (!invoice.invoiceID.trim()) {
            throw new Error("Every invoice needs an invoiceID.");
        }
        if (!invoice.items.length) {
            throw new Error(`Invoice ${invoice.invoiceID} has no items.`);
        }
        const pricedItems = invoice.items.map((item, index) => {
            const product = resolvedProducts[offset + index];
            const snapshot = (0, purchaseItemPriceSnapshot_1.buildPurchaseItemPriceSnapshot)(product);
            totalCartons += item.quantity;
            tableRows.push([
                invoice.invoiceID,
                product.name,
                product.productCode,
                (0, ai_utils_1.formatNumber)(item.quantity),
                (0, ai_utils_1.formatInr)(snapshot.costPricePerCarton),
            ]);
            return { quantity: item.quantity, ...snapshot };
        });
        offset += invoice.items.length;
        const invoiceAmount = (0, purchaseItemPriceSnapshot_1.computePurchaseInvoiceAmountFromItems)(pricedItems);
        totalAmount += invoiceAmount;
        payloadInvoices.push({
            invoiceID: invoice.invoiceID.trim(),
            invoiceDate: dateToIso(invoice.invoiceDate),
            invoiceAmount,
            items: invoice.items.map((item, index) => ({
                productId: resolvedProducts[offset - invoice.items.length + index].id,
                quantity: item.quantity,
            })),
        });
    }
    const payload = {
        transporterId: transporter.id,
        vehicleNumber: args.vehicleNumber?.trim() || null,
        driverContact: args.driverContact?.trim() || null,
        purchaseTransportStatus: args.purchaseTransportStatus ?? "PENDING",
        invoices: payloadInvoices,
    };
    const markedArrivedAt = dateToIso(args.markedArrivedAt);
    if (markedArrivedAt)
        payload.markedArrivedAt = markedArrivedAt;
    return buildProposal({
        action: "create_purchase",
        title: `Create purchase from ${transporter.name}`,
        summary: `${args.invoices.length} invoice(s), ${(0, ai_utils_1.formatNumber)(totalCartons)} cartons, estimated ${(0, ai_utils_1.formatInr)(totalAmount)}.`,
        method: "POST",
        endpoint: "/api/purchases/bulk",
        targetId: "",
        targetLabel: `Purchase from ${transporter.name}`,
        payload,
        preview: {
            sections: [
                {
                    title: "Purchase",
                    rows: [
                        { label: "Transporter", value: transporter.name },
                        { label: "Vehicle", value: args.vehicleNumber?.trim() || "—" },
                        { label: "Driver contact", value: args.driverContact?.trim() || "—" },
                        { label: "Status", value: args.purchaseTransportStatus ?? "PENDING" },
                        { label: "Invoices", value: String(args.invoices.length) },
                    ],
                },
            ],
            table: {
                columns: ["Invoice", "Product", "Code", "Qty", "Cost/carton"],
                rows: tableRows,
            },
            totals: [
                { label: "Cartons", value: (0, ai_utils_1.formatNumber)(totalCartons) },
                { label: "Estimated invoice amount", value: (0, ai_utils_1.formatInr)(totalAmount) },
            ],
            warnings,
        },
        risk: "medium",
    });
}
async function proposeUpdatePurchaseStatus(args) {
    const purchase = await (0, ai_resolve_1.resolvePurchase)({
        purchaseId: args.purchaseId,
        grnNumber: args.grnNumber,
        invoiceID: args.invoiceID,
        vehicleNumber: args.vehicleNumber,
    });
    if (purchase.purchaseTransportStatus === "COMPLETED") {
        throw new Error("This purchase is already COMPLETED and cannot be changed.");
    }
    const nextStatus = args.purchaseTransportStatus;
    if (nextStatus === "COMPLETED" && !(0, purchasePricing_1.isPurchasePricingComplete)(purchase.PurchaseInvoice)) {
        throw new Error("Cannot complete this purchase: MRP, cost per packet, and cost per carton must be greater than zero for every line.");
    }
    const warnings = [
        "This updates the purchase transport status and its timestamp fields.",
    ];
    if (nextStatus === "COMPLETED") {
        warnings.push("CRITICAL: COMPLETED also transfers all planned purchase batches into live inventory and creates ARRIVAL_FROM_SUPPLIER StockRecords.");
    }
    if (nextStatus === "ARRIVED")
        warnings.push("Sets the arrival timestamp for this purchase.");
    if (nextStatus === "UNLOADED")
        warnings.push("Sets the unloaded timestamp for this purchase.");
    if (nextStatus === "EXITED")
        warnings.push("Sets the vehicle-exited timestamp for this purchase.");
    return buildProposal({
        action: "update_purchase_status",
        title: `Update purchase status to ${nextStatus}`,
        summary: `${purchase.Transporter?.name ?? "Unknown transporter"}: ${purchase.purchaseTransportStatus} → ${nextStatus}.`,
        method: "PATCH",
        endpoint: `/api/purchases/${purchase.id}/status`,
        targetId: purchase.id,
        targetLabel: purchase.grnNumber || purchase.vehicleNumber || purchase.id,
        payload: { purchaseTransportStatus: nextStatus },
        preview: {
            sections: [
                {
                    title: "Purchase",
                    rows: [
                        { label: "Transporter", value: purchase.Transporter?.name ?? "Unknown" },
                        { label: "Vehicle", value: purchase.vehicleNumber ?? "—" },
                        { label: "GRN", value: purchase.grnNumber ?? "—" },
                        { label: "Current status", value: purchase.purchaseTransportStatus },
                        { label: "New status", value: nextStatus },
                    ],
                },
            ],
            warnings,
        },
        risk: nextStatus === "COMPLETED" ? "high" : "medium",
    });
}
async function proposeAddPurchaseToStock(args) {
    const purchase = await (0, ai_resolve_1.resolvePurchase)({
        purchaseId: args.purchaseId,
        grnNumber: args.grnNumber,
        invoiceID: args.invoiceID,
        vehicleNumber: args.vehicleNumber,
    });
    if (purchase.stockBatches.length > 0) {
        throw new Error("Stock has already been added for this purchase.");
    }
    if (purchase.purchaseStockBatches.length === 0) {
        throw new Error("This purchase has no planned stock batches to transfer.");
    }
    const plannedByProduct = new Map();
    for (const batch of purchase.purchaseStockBatches) {
        const key = batch.productId;
        const existing = plannedByProduct.get(key) ?? {
            name: batch.product?.name ?? "Unknown",
            code: batch.product?.productCode ?? "—",
            quantity: 0,
        };
        existing.quantity += batch.stockQuantity;
        plannedByProduct.set(key, existing);
    }
    const rows = [...plannedByProduct.values()].map((entry) => [
        entry.name,
        entry.code,
        (0, ai_utils_1.formatNumber)(entry.quantity),
    ]);
    const totalCartons = [...plannedByProduct.values()].reduce((sum, entry) => sum + entry.quantity, 0);
    return buildProposal({
        action: "add_purchase_to_stock",
        title: "Add purchase stock to inventory",
        summary: `${purchase.Transporter?.name ?? "Purchase"}: transfer ${(0, ai_utils_1.formatNumber)(totalCartons)} cartons into live stock.`,
        method: "POST",
        endpoint: `/api/purchases/${purchase.id}/add-to-stock`,
        targetId: purchase.id,
        targetLabel: purchase.grnNumber || purchase.vehicleNumber || purchase.id,
        payload: {},
        preview: {
            sections: [
                {
                    title: "Purchase",
                    rows: [
                        { label: "Transporter", value: purchase.Transporter?.name ?? "Unknown" },
                        { label: "Vehicle", value: purchase.vehicleNumber ?? "—" },
                        { label: "Status", value: purchase.purchaseTransportStatus },
                        { label: "Planned batches", value: String(purchase.purchaseStockBatches.length) },
                    ],
                },
            ],
            table: {
                columns: ["Product", "Code", "Quantity"],
                rows,
            },
            totals: [{ label: "Total cartons", value: (0, ai_utils_1.formatNumber)(totalCartons) }],
            warnings: [
                "Creates live StockBatch rows and ARRIVAL_FROM_SUPPLIER StockRecords.",
                "On-hand stock increases immediately.",
                "This action cannot be undone by the assistant.",
            ],
        },
        risk: "high",
    });
}
//# sourceMappingURL=ai.proposals.js.map