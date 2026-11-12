"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrderStatusType = exports.updateOrderStatusType = exports.getOrderStatusTypeById = exports.getOrderStatusTypes = exports.createOrderStatusType = void 0;
const prisma_1 = require("../lib/prisma");
const createOrderStatusType = async (req, res) => {
    try {
        const { name, displayName, sortOrder } = req.body;
        const code = String(name).trim().toUpperCase().replace(/\s+/g, "_");
        const existing = await prisma_1.prisma.orderStatusType.findFirst({
            where: { name: code },
        });
        if (existing) {
            return res.status(409).json({ message: "Order status type with this name already exists" });
        }
        const orderStatusType = await prisma_1.prisma.orderStatusType.create({
            data: {
                name: code,
                displayName: displayName?.trim() || null,
                sortOrder: sortOrder ?? 0,
            },
        });
        res.status(201).json({ orderStatusType });
    }
    catch (error) {
        console.error("Error creating order status type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createOrderStatusType = createOrderStatusType;
const getOrderStatusTypes = async (req, res) => {
    try {
        const orderStatusTypes = await prisma_1.prisma.orderStatusType.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
        res.json({ orderStatusTypes });
    }
    catch (error) {
        console.error("Error fetching order status types:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrderStatusTypes = getOrderStatusTypes;
const getOrderStatusTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const orderStatusType = await prisma_1.prisma.orderStatusType.findUnique({
            where: { id },
            include: { Order: { select: { id: true } } },
        });
        if (!orderStatusType) {
            return res.status(404).json({ message: "Order status type not found" });
        }
        res.json({ orderStatusType });
    }
    catch (error) {
        console.error("Error fetching order status type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrderStatusTypeById = getOrderStatusTypeById;
const updateOrderStatusType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, displayName, sortOrder } = req.body;
        const existing = await prisma_1.prisma.orderStatusType.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Order status type not found" });
        }
        const updates = {};
        if (name !== undefined) {
            const code = String(name).trim().toUpperCase().replace(/\s+/g, "_");
            if (code !== existing.name) {
                const duplicate = await prisma_1.prisma.orderStatusType.findFirst({
                    where: { name: code, id: { not: id } },
                });
                if (duplicate) {
                    return res.status(409).json({ message: "Order status type with this name already exists" });
                }
                updates.name = code;
            }
        }
        if (displayName !== undefined)
            updates.displayName = displayName?.trim() || null;
        if (sortOrder !== undefined)
            updates.sortOrder = sortOrder;
        const orderStatusType = await prisma_1.prisma.orderStatusType.update({
            where: { id },
            data: updates,
        });
        res.json({ orderStatusType });
    }
    catch (error) {
        console.error("Error updating order status type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateOrderStatusType = updateOrderStatusType;
const deleteOrderStatusType = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.orderStatusType.findUnique({
            where: { id },
            include: { Order: { select: { id: true } } },
        });
        if (!existing) {
            return res.status(404).json({ message: "Order status type not found" });
        }
        if (existing.Order.length > 0) {
            return res.status(400).json({
                message: "Cannot delete order status type that is assigned to one or more orders",
            });
        }
        await prisma_1.prisma.orderStatusType.delete({
            where: { id },
        });
        res.json({ message: "Order status type deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting order status type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteOrderStatusType = deleteOrderStatusType;
//# sourceMappingURL=orderStatusType.controller.js.map