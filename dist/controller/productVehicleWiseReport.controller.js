"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductVehicleWiseReport = void 0;
const prisma_1 = require("../lib/prisma");
const productVehicleWiseReport_schema_1 = require("../libs/schemas/productVehicleWiseReport.schema");
function getIstOrderDateBounds(dateStr) {
    return {
        gte: new Date(`${dateStr}T00:00:00.000+05:30`),
        lte: new Date(`${dateStr}T23:59:59.999+05:30`),
    };
}
function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const day = String(d).padStart(2, "0");
    const month = date.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
    const weekday = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return `${day}-${month} ${weekday}`;
}
function buildVehicleLabel(vehicle, fallbackId) {
    if (!vehicle)
        return fallbackId;
    const label = [vehicle.vehicleName?.trim(), vehicle.vehicleNumber?.trim()]
        .filter(Boolean)
        .join(" ");
    return label || fallbackId;
}
function columnIdForOrder(vehicleId, customerId) {
    return `${vehicleId}:${customerId}`;
}
const getProductVehicleWiseReport = async (req, res) => {
    try {
        const parsed = productVehicleWiseReport_schema_1.ProductVehicleWiseReportQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({
                message: parsed.error.issues[0]?.message ?? "Invalid query parameters",
            });
        }
        const { date, includeZeroProducts } = parsed.data;
        const orderDateBounds = getIstOrderDateBounds(date);
        const orders = await prisma_1.prisma.order.findMany({
            where: {
                orderDate: orderDateBounds,
                vehicleId: { not: null },
                isFinalizedByDistributor: { not: false },
            },
            select: {
                id: true,
                vehicleId: true,
                customerId: true,
                driverId: true,
                Vehicle: {
                    select: { id: true, vehicleName: true, vehicleNumber: true },
                },
                Customer: {
                    select: {
                        id: true,
                        name: true,
                        CustomerDetail: { select: { dbName: true }, take: 1 },
                    },
                },
                OrderItem: {
                    select: {
                        productId: true,
                        quantity: true,
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                mrp: true,
                                productCode: true,
                            },
                        },
                    },
                },
            },
        });
        const driverIds = [
            ...new Set(orders.map((o) => o.driverId).filter((id) => Boolean(id))),
        ];
        const drivers = driverIds.length > 0
            ? await prisma_1.prisma.user.findMany({
                where: { id: { in: driverIds } },
                select: { id: true, name: true },
            })
            : [];
        const driverNameById = new Map(drivers.map((d) => [d.id, d.name]));
        const columnMeta = new Map();
        for (const order of orders) {
            if (!order.vehicleId)
                continue;
            const id = columnIdForOrder(order.vehicleId, order.customerId);
            if (columnMeta.has(id))
                continue;
            const distributorDbName = order.Customer?.CustomerDetail?.[0]?.dbName?.trim() || null;
            const customerName = order.Customer?.name?.trim() || null;
            const driverName = order.driverId
                ? driverNameById.get(order.driverId)?.trim() || null
                : null;
            const subtitle = distributorDbName ?? customerName ?? driverName ?? "";
            columnMeta.set(id, {
                vehicleId: order.vehicleId,
                customerId: order.customerId,
                vehicleLabel: buildVehicleLabel(order.Vehicle, order.vehicleId),
                subtitle,
            });
        }
        const columns = Array.from(columnMeta.entries())
            .map(([id, meta]) => ({ id, ...meta }))
            .sort((a, b) => {
            const byVehicle = a.vehicleLabel.localeCompare(b.vehicleLabel);
            if (byVehicle !== 0)
                return byVehicle;
            return a.subtitle.localeCompare(b.subtitle);
        });
        const qtyByProductColumn = new Map();
        const orderIdsByProductColumn = new Map();
        const productMeta = new Map();
        const columnTotals = {};
        let grandTotal = 0;
        for (const order of orders) {
            if (!order.vehicleId)
                continue;
            const columnId = columnIdForOrder(order.vehicleId, order.customerId);
            for (const item of order.OrderItem) {
                const productId = item.productId;
                const qty = item.quantity;
                if (!productMeta.has(productId)) {
                    productMeta.set(productId, {
                        productId,
                        mrp: item.Product.mrp,
                        name: item.Product.name,
                        productCode: item.Product.productCode,
                    });
                }
                let productCols = qtyByProductColumn.get(productId);
                if (!productCols) {
                    productCols = new Map();
                    qtyByProductColumn.set(productId, productCols);
                }
                productCols.set(columnId, (productCols.get(columnId) ?? 0) + qty);
                let productOrderIds = orderIdsByProductColumn.get(productId);
                if (!productOrderIds) {
                    productOrderIds = new Map();
                    orderIdsByProductColumn.set(productId, productOrderIds);
                }
                let cellOrderIds = productOrderIds.get(columnId);
                if (!cellOrderIds) {
                    cellOrderIds = new Set();
                    productOrderIds.set(columnId, cellOrderIds);
                }
                cellOrderIds.add(order.id);
                columnTotals[columnId] = (columnTotals[columnId] ?? 0) + qty;
                grandTotal += qty;
            }
        }
        let products = Array.from(productMeta.values())
            .map((meta) => {
            const colMap = qtyByProductColumn.get(meta.productId) ?? new Map();
            const orderIdMap = orderIdsByProductColumn.get(meta.productId) ?? new Map();
            const quantities = {};
            const orderIds = {};
            for (const [colId, qty] of colMap) {
                quantities[colId] = qty;
                orderIds[colId] = [...(orderIdMap.get(colId) ?? [])];
            }
            const rowTotal = Object.values(quantities).reduce((sum, q) => sum + q, 0);
            return {
                productId: meta.productId,
                mrp: meta.mrp,
                name: meta.name,
                productCode: meta.productCode,
                quantities,
                orderIds,
                rowTotal,
            };
        })
            .sort((a, b) => {
            if (a.mrp !== b.mrp)
                return a.mrp - b.mrp;
            return a.name.localeCompare(b.name);
        });
        if (!includeZeroProducts) {
            products = products.filter((p) => Object.values(p.quantities).some((q) => q > 0));
        }
        res.json({
            date,
            dateLabel: formatDateLabel(date),
            columns,
            products,
            columnTotals,
            grandTotal,
        });
    }
    catch (error) {
        console.error("Error fetching product vehicle-wise report:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductVehicleWiseReport = getProductVehicleWiseReport;
//# sourceMappingURL=productVehicleWiseReport.controller.js.map