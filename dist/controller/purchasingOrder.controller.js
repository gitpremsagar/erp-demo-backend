"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchasingOrderStats = exports.deletePurchasingOrder = exports.updatePurchasingOrder = exports.getPurchasingOrderById = exports.getPurchasingOrders = exports.createPurchasingOrder = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Create a new purchasing order
const createPurchasingOrder = async (req, res) => {
    try {
        const { orderDate, status, purchasingOrderItems } = req.body;
        // Validate that all products exist
        if (purchasingOrderItems && purchasingOrderItems.length > 0) {
            for (const item of purchasingOrderItems) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                });
                if (!product) {
                    return res
                        .status(404)
                        .json({ message: `Product with ID ${item.productId} not found` });
                }
            }
        }
        // Create purchasing order and items in a transaction
        const purchaseOrder = await prisma.$transaction(async (tx) => {
            // Create the purchase order
            const newPurchaseOrder = await tx.purchaseOrder.create({
                data: {
                    orderDate: new Date(orderDate),
                    status: status || "PENDING",
                },
            });
            // Create purchase order items
            if (purchasingOrderItems && purchasingOrderItems.length > 0) {
                for (const item of purchasingOrderItems) {
                    await tx.purchaseOrderItem.create({
                        data: {
                            purchaseOrderId: newPurchaseOrder.id,
                            productId: item.productId,
                            quantity: item.quantity,
                        },
                    });
                }
            }
            return newPurchaseOrder;
        });
        // Get the complete purchase order with items
        const completePurchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrder.id },
            include: {
                PurchaseOrderItem: {
                    include: {
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                productCode: true,
                                mrp: true,
                                costPricePerPacket: true,
                                costPricePerCarton: true,
                            },
                        },
                    },
                },
            },
        });
        res.status(201).json({ purchasingOrder: completePurchaseOrder });
    }
    catch (error) {
        console.error("Error creating purchasing order:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createPurchasingOrder = createPurchasingOrder;
// Get all purchasing orders with pagination and filtering
const getPurchasingOrders = async (req, res) => {
    try {
        const { page = 1, limit = 100, status, startDate, endDate, } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        // Build where clause
        const where = {};
        if (status) {
            where.status = status;
        }
        if (startDate || endDate) {
            where.orderDate = {};
            if (startDate) {
                where.orderDate.gte = new Date(startDate);
            }
            if (endDate) {
                where.orderDate.lte = new Date(endDate);
            }
        }
        const [purchasingOrders, total] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    PurchaseOrderItem: {
                        include: {
                            Product: {
                                select: {
                                    id: true,
                                    name: true,
                                    productCode: true,
                                    mrp: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    orderDate: "desc",
                },
            }),
            prisma.purchaseOrder.count({ where }),
        ]);
        const totalPages = Math.ceil(total / Number(limit));
        res.json({
            purchasingOrders,
            pagination: {
                currentPage: Number(page),
                totalPages,
                totalItems: total,
                itemsPerPage: Number(limit),
            },
        });
    }
    catch (error) {
        console.error("Error fetching purchasing orders:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPurchasingOrders = getPurchasingOrders;
// Get a single purchasing order by ID
const getPurchasingOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const purchasingOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                PurchaseOrderItem: {
                    include: {
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                productCode: true,
                                mrp: true,
                                costPricePerPacket: true,
                                costPricePerPacketWithGst: true,
                                costPricePerCarton: true,
                                costPricePerCartonWithGst: true,
                                imageUrl: true,
                            },
                        },
                    },
                },
            },
        });
        if (!purchasingOrder) {
            return res.status(404).json({ message: "Purchasing order not found" });
        }
        res.json({ purchasingOrder });
    }
    catch (error) {
        console.error("Error fetching purchasing order:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPurchasingOrderById = getPurchasingOrderById;
// Update a purchasing order
const updatePurchasingOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderDate, status, purchasingOrderItems } = req.body;
        // Check if purchasing order exists
        const existingPurchasingOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                PurchaseOrderItem: true,
            },
        });
        if (!existingPurchasingOrder) {
            return res.status(404).json({ message: "Purchasing order not found" });
        }
        // Validate products if items are being updated
        if (purchasingOrderItems && purchasingOrderItems.length > 0) {
            for (const item of purchasingOrderItems) {
                const product = await prisma.product.findUnique({
                    where: { id: item.productId },
                });
                if (!product) {
                    return res
                        .status(404)
                        .json({ message: `Product with ID ${item.productId} not found` });
                }
            }
        }
        // Update purchasing order and items in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update the purchasing order
            const updateData = {};
            if (orderDate !== undefined)
                updateData.orderDate = new Date(orderDate);
            if (status !== undefined)
                updateData.status = status;
            const updatedPurchaseOrder = await tx.purchaseOrder.update({
                where: { id },
                data: updateData,
            });
            // Handle purchase order items updates if provided
            let updatedItems = [];
            if (purchasingOrderItems && purchasingOrderItems.length > 0) {
                // Delete existing items
                await tx.purchaseOrderItem.deleteMany({
                    where: { purchaseOrderId: id },
                });
                // Create new items
                for (const item of purchasingOrderItems) {
                    const orderItem = await tx.purchaseOrderItem.create({
                        data: {
                            purchaseOrderId: id,
                            productId: item.productId,
                            quantity: item.quantity,
                        },
                    });
                    updatedItems.push(orderItem);
                }
            }
            return { updatedPurchaseOrder, updatedItems };
        });
        // Get the complete updated purchase order
        const completePurchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                PurchaseOrderItem: {
                    include: {
                        Product: {
                            select: {
                                id: true,
                                name: true,
                                productCode: true,
                                mrp: true,
                                costPricePerPacket: true,
                                costPricePerPacketWithGst: true,
                                costPricePerCarton: true,
                                costPricePerCartonWithGst: true,
                                imageUrl: true,
                            },
                        },
                    },
                },
            },
        });
        res.json({
            purchasingOrder: completePurchaseOrder,
            updatedItems: result.updatedItems,
        });
    }
    catch (error) {
        console.error("Error updating purchasing order:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updatePurchasingOrder = updatePurchasingOrder;
// Delete a purchasing order
const deletePurchasingOrder = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if purchasing order exists
        const purchasingOrder = await prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                PurchaseOrderItem: true,
            },
        });
        if (!purchasingOrder) {
            return res.status(404).json({ message: "Purchasing order not found" });
        }
        // Delete purchase order and items in a transaction
        await prisma.$transaction(async (tx) => {
            // Delete items first (due to foreign key constraint)
            await tx.purchaseOrderItem.deleteMany({
                where: { purchaseOrderId: id },
            });
            // Delete the purchase order
            await tx.purchaseOrder.delete({
                where: { id },
            });
        });
        res.json({ message: "Purchasing order deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting purchasing order:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deletePurchasingOrder = deletePurchasingOrder;
// Get purchasing order statistics
const getPurchasingOrderStats = async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (startDate || endDate) {
            where.orderDate = {};
            if (startDate)
                where.orderDate.gte = new Date(startDate);
            if (endDate)
                where.orderDate.lte = new Date(endDate);
        }
        const [totalOrders, pendingOrders, completedOrders, inProgressOrders, ordersByStatus,] = await Promise.all([
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.count({ where: { ...where, status: "PENDING" } }),
            prisma.purchaseOrder.count({ where: { ...where, status: "COMPLETED" } }),
            prisma.purchaseOrder.count({ where: { ...where, status: "IN_PROGRESS" } }),
            prisma.purchaseOrder.groupBy({
                by: ["status"],
                where,
                _count: {
                    id: true,
                },
            }),
        ]);
        res.json({
            totalOrders,
            pendingOrders,
            completedOrders,
            inProgressOrders,
            ordersByStatus,
        });
    }
    catch (error) {
        console.error("Error fetching purchasing order statistics:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPurchasingOrderStats = getPurchasingOrderStats;
//# sourceMappingURL=purchasingOrder.controller.js.map