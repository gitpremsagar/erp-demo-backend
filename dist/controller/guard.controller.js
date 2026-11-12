"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGuardOrderStatus = exports.updateGuardOrderDriver = exports.getGuardDrivers = exports.getGuardOrders = exports.updateGuardPurchaseStatus = exports.getGuardPurchases = void 0;
const prisma_1 = require("../lib/prisma");
const getCreatedByForStockRecord_1 = require("../lib/getCreatedByForStockRecord");
const purchase_controller_1 = require("../module/purchase/purchase.controller");
const GUARD_VISIBLE_PURCHASE_STATUSES = [
    "IN_TRANSIT",
    "LOADED",
    "UNLOADED",
];
const GUARD_ALLOWED_STATUS_TRANSITIONS = {
    PENDING: [],
    LOADING: [],
    LOADED: ["EXITED"],
    IN_TRANSIT: ["ARRIVED"],
    ARRIVED: [],
    UNLOADING: [],
    UNLOADED: ["EXITED"],
    EXITED: [],
    COMPLETED: [],
};
const getGuardPurchases = async (req, res) => {
    try {
        const purchases = await prisma_1.prisma.purchase.findMany({
            where: {
                purchaseTransportStatus: { in: GUARD_VISIBLE_PURCHASE_STATUSES },
            },
            select: {
                id: true,
                vehicleNumber: true,
                driverContact: true,
                purchaseTransportStatus: true,
                PurchaseInvoice: {
                    select: {
                        PurchaseInvoiceItem: {
                            select: { quantity: true },
                        },
                    },
                },
            },
            orderBy: { purchaseDate: "desc" },
        });
        const rows = purchases.map((purchase) => ({
            id: purchase.id,
            vehicleNumber: purchase.vehicleNumber,
            driverName: purchase.driverContact,
            status: purchase.purchaseTransportStatus,
            totalQuantity: purchase.PurchaseInvoice.reduce((invoiceSum, invoice) => invoiceSum +
                invoice.PurchaseInvoiceItem.reduce((itemSum, item) => itemSum + (Number(item.quantity) || 0), 0), 0),
        }));
        res.json({ purchases: rows });
    }
    catch (error) {
        console.error("Error fetching guard purchases:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getGuardPurchases = getGuardPurchases;
const updateGuardPurchaseStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { purchaseTransportStatus } = req.body;
        const existing = await prisma_1.prisma.purchase.findUnique({
            where: { id },
            select: { id: true, purchaseTransportStatus: true, grnNumber: true },
        });
        if (!existing) {
            return res.status(404).json({ message: "Purchase not found" });
        }
        const allowedNext = GUARD_ALLOWED_STATUS_TRANSITIONS[existing.purchaseTransportStatus] ?? [];
        if (!allowedNext.includes(purchaseTransportStatus)) {
            return res.status(400).json({
                message: `Invalid status transition from ${existing.purchaseTransportStatus} to ${purchaseTransportStatus}`,
            });
        }
        const body = req.body;
        if (purchaseTransportStatus === "ARRIVED") {
            if (existing.grnNumber?.trim()) {
                return res.status(409).json({ message: "GRN number is already set for this purchase" });
            }
            if (!body.markedArrivedAt || !body.grnNumber?.trim()) {
                return res.status(400).json({
                    message: "markedArrivedAt and grnNumber are required when marking as arrived",
                });
            }
        }
        const actorId = await (0, getCreatedByForStockRecord_1.getCreatedByForStockRecord)(req);
        const purchase = await prisma_1.prisma.$transaction(async (tx) => {
            const updated = await (0, purchase_controller_1.applyPurchaseTransportStatusUpdate)(tx, {
                id,
                purchaseTransportStatus,
                actorId,
                ...(purchaseTransportStatus === "ARRIVED" && body.markedArrivedAt
                    ? { now: body.markedArrivedAt }
                    : {}),
            });
            if (purchaseTransportStatus === "ARRIVED" && body.grnNumber) {
                await tx.purchase.update({
                    where: { id },
                    data: { grnNumber: body.grnNumber.trim() },
                });
            }
            return updated;
        });
        res.json({
            purchase: {
                id: purchase.id,
                vehicleNumber: purchase.vehicleNumber,
                driverName: purchase.driverContact,
                status: purchase.purchaseTransportStatus,
            },
        });
    }
    catch (error) {
        console.error("Error updating guard purchase status:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateGuardPurchaseStatus = updateGuardPurchaseStatus;
const getGuardOrders = async (req, res) => {
    try {
        const statusRows = await prisma_1.prisma.orderStatusType.findMany({
            where: { name: { in: ["LOADED", "VEHICLE_COMING_BACK"] } },
            select: { id: true, name: true },
        });
        const statusIds = statusRows.map((row) => row.id);
        if (statusIds.length === 0) {
            return res.json({ orders: [] });
        }
        const orders = await prisma_1.prisma.order.findMany({
            where: { orderStatusTypeId: { in: statusIds } },
            select: {
                id: true,
                customeOrderId: true,
                driverId: true,
                OrderStatusType: {
                    select: { name: true, displayName: true },
                },
                customerId: true,
                Customer: {
                    select: {
                        name: true,
                        CustomerDetail: { select: { dbName: true } },
                    },
                },
                Vehicle: {
                    select: { vehicleNumber: true },
                },
                OrderItem: {
                    select: { quantity: true },
                },
            },
            orderBy: { orderDate: "desc" },
        });
        const driverIds = Array.from(new Set(orders.map((order) => order.driverId).filter((id) => Boolean(id))));
        const drivers = driverIds.length === 0
            ? []
            : await prisma_1.prisma.user.findMany({
                where: { id: { in: driverIds }, userType: "DRIVER" },
                select: { id: true, name: true },
            });
        const driverById = new Map(drivers.map((driver) => [driver.id, driver.name]));
        const rows = orders.map((order) => ({
            id: order.id,
            orderNumber: order.customeOrderId,
            vehicleNumber: order.Vehicle?.vehicleNumber ?? null,
            distributorName: order.Customer?.CustomerDetail?.[0]?.dbName ?? order.Customer?.name ?? null,
            driverId: order.driverId ?? null,
            driverName: order.driverId ? driverById.get(order.driverId) ?? null : null,
            customerId: order.customerId,
            status: order.OrderStatusType?.name ?? null,
            statusLabel: order.OrderStatusType?.displayName ?? order.OrderStatusType?.name ?? "Unknown",
            totalQuantity: order.OrderItem.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        }));
        res.json({ orders: rows });
    }
    catch (error) {
        console.error("Error fetching guard orders:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getGuardOrders = getGuardOrders;
const getGuardDrivers = async (req, res) => {
    try {
        const drivers = await prisma_1.prisma.user.findMany({
            where: { userType: "DRIVER" },
            select: { id: true, name: true, phone: true },
            orderBy: { name: "asc" },
        });
        res.json({ drivers });
    }
    catch (error) {
        console.error("Error fetching guard drivers:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getGuardDrivers = getGuardDrivers;
const updateGuardOrderDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { driverId } = req.body;
        const existingOrder = await prisma_1.prisma.order.findUnique({
            where: { id },
            select: { id: true, driverId: true },
        });
        if (!existingOrder) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (existingOrder.driverId) {
            return res.status(400).json({ message: "Driver is already assigned for this order" });
        }
        const driver = await prisma_1.prisma.user.findUnique({
            where: { id: driverId },
            select: { id: true, userType: true },
        });
        if (!driver || driver.userType !== "DRIVER") {
            return res.status(400).json({ message: "Invalid driver selection" });
        }
        await prisma_1.prisma.order.update({
            where: { id },
            data: { driverId },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error updating guard order driver:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateGuardOrderDriver = updateGuardOrderDriver;
const GUARD_ORDER_ALLOWED_TRANSITIONS = {
    LOADED: "OUT_FOR_DELIVERY",
    VEHICLE_COMING_BACK: "VEHICLE_CAME_BACK",
};
const updateGuardOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatusTypeId } = req.body;
        const [existingOrder, nextStatusType] = await Promise.all([
            prisma_1.prisma.order.findUnique({
                where: { id },
                select: {
                    id: true,
                    orderStatusTypeId: true,
                    OrderStatusType: { select: { name: true } },
                },
            }),
            prisma_1.prisma.orderStatusType.findUnique({
                where: { id: orderStatusTypeId },
                select: { id: true, name: true },
            }),
        ]);
        if (!existingOrder) {
            return res.status(404).json({ message: "Order not found" });
        }
        if (!nextStatusType) {
            return res.status(404).json({ message: "Order status type not found" });
        }
        const currentName = existingOrder.OrderStatusType?.name;
        if (!currentName || !(currentName in GUARD_ORDER_ALLOWED_TRANSITIONS)) {
            return res.status(400).json({ message: "Current order status cannot be changed by guard" });
        }
        const expectedNext = GUARD_ORDER_ALLOWED_TRANSITIONS[currentName];
        if (nextStatusType.name !== expectedNext) {
            return res.status(400).json({
                message: `Invalid guard transition from ${currentName} to ${nextStatusType.name}`,
            });
        }
        await prisma_1.prisma.order.update({
            where: { id },
            data: { orderStatusTypeId: nextStatusType.id },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Error updating guard order status:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateGuardOrderStatus = updateGuardOrderStatus;
//# sourceMappingURL=guard.controller.js.map