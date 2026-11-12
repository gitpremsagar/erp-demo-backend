"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockRecordStats = exports.getStockRecordsByStockBatchId = exports.getStockRecordsByProductId = exports.updateStockRecord = exports.getStockRecordById = exports.getStockRecords = exports.createStockRecord = void 0;
const prisma_1 = require("../lib/prisma");
const stockRecordChangeMeta_1 = require("../lib/stockRecordChangeMeta");
// Create a new stock record
const createStockRecord = async (req, res) => {
    try {
        const { productId, stockBatchId, changeInStock, reason, createdBy, changeDate: changeDateBody, } = req.body;
        // Verify that product exists
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
            include: { Category: true }
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Verify that stock batch exists
        const stockBatch = await prisma_1.prisma.stockBatch.findUnique({
            where: { id: stockBatchId },
            include: {
                product: { include: { Category: true } },
            }
        });
        if (!stockBatch) {
            return res.status(404).json({ message: "Stock batch not found" });
        }
        // Verify that the stock batch belongs to the specified product
        if (stockBatch.productId !== productId) {
            return res.status(400).json({
                message: "Stock batch does not belong to the specified product"
            });
        }
        // Verify that user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: createdBy },
            select: { id: true, name: true, email: true, userType: true }
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Check if the change would result in negative stock
        const currentStock = stockBatch.stockQuantity;
        const newStock = currentStock + changeInStock;
        if (newStock < 0) {
            return res.status(400).json({
                message: `Insufficient stock. Current stock: ${currentStock}, attempting to change by: ${changeInStock}`
            });
        }
        let resolvedChangeDate;
        if (changeDateBody !== undefined && changeDateBody !== null) {
            resolvedChangeDate = new Date(changeDateBody);
        }
        else if (reason === "ARRIVAL_FROM_SUPPLIER") {
            resolvedChangeDate = stockBatch.arrivalDate;
        }
        else {
            resolvedChangeDate = (0, stockRecordChangeMeta_1.defaultChangeDateIst)();
        }
        const changeMeta = (0, stockRecordChangeMeta_1.buildStockRecordChangeFields)({
            changeInStock,
            changeDate: resolvedChangeDate,
        });
        // Create stock record
        const stockRecord = await prisma_1.prisma.stockRecord.create({
            data: {
                productId,
                stockBatchId,
                changeInStock,
                reason,
                createdBy,
                ...changeMeta,
            },
            include: {
                Product: {
                    include: {
                        Category: true,
                    },
                },
                StockBatch: {
                    include: {
                        product: { include: { Category: true } },
                    },
                },
                User: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        userType: true,
                    },
                },
            },
        });
        // Update the stock batch quantity
        await prisma_1.prisma.stockBatch.update({
            where: { id: stockBatchId },
            data: { stockQuantity: newStock },
        });
        res.status(201).json({
            stockRecord,
            updatedStockQuantity: newStock
        });
    }
    catch (error) {
        console.error("Error creating stock record:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createStockRecord = createStockRecord;
// Get all stock records with pagination and filtering
const getStockRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, productId, stockBatchId, reason, createdBy, dateFrom, dateTo, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { Product: { name: { contains: search, mode: "insensitive" } } },
                { Product: { productCode: { contains: search, mode: "insensitive" } } },
                { User: { name: { contains: search, mode: "insensitive" } } },
                { User: { email: { contains: search, mode: "insensitive" } } },
            ];
        }
        if (productId) {
            where.productId = productId;
        }
        if (stockBatchId) {
            where.stockBatchId = stockBatchId;
        }
        if (reason) {
            where.reason = reason;
        }
        if (createdBy) {
            where.createdBy = createdBy;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }
        const [stockRecords, total] = await Promise.all([
            prisma_1.prisma.stockRecord.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    Product: {
                        include: {
                            Category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    StockBatch: {
                        include: {
                            product: { include: { Category: true } },
                        },
                    },
                    User: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            userType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.stockRecord.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            stockRecords,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching stock records:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getStockRecords = getStockRecords;
// Get a single stock record by ID
const getStockRecordById = async (req, res) => {
    try {
        const { id } = req.params;
        const stockRecord = await prisma_1.prisma.stockRecord.findUnique({
            where: { id },
            include: {
                Product: {
                    include: {
                        Category: true,
                    },
                },
                StockBatch: {
                    include: {
                        product: { include: { Category: true } },
                    },
                },
                User: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        userType: true,
                    },
                },
                Order: {
                    select: {
                        id: true,
                        customeOrderId: true,
                        status: true,
                        totalPrice: true,
                        orderDate: true,
                    },
                },
            },
        });
        if (!stockRecord) {
            return res.status(404).json({ message: "Stock record not found" });
        }
        res.json({ stockRecord });
    }
    catch (error) {
        console.error("Error fetching stock record:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getStockRecordById = getStockRecordById;
// Update a stock record
const updateStockRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if stock record exists
        const existingStockRecord = await prisma_1.prisma.stockRecord.findUnique({
            where: { id },
            include: {
                StockBatch: true,
            },
        });
        if (!existingStockRecord) {
            return res.status(404).json({ message: "Stock record not found" });
        }
        // If changeInStock is being updated, we need to recalculate the stock batch quantity
        if (updateData.changeInStock !== undefined) {
            const originalChange = existingStockRecord.changeInStock;
            const newChange = updateData.changeInStock;
            const difference = newChange - originalChange;
            const currentStock = existingStockRecord.StockBatch.stockQuantity;
            const newStock = currentStock + difference;
            if (newStock < 0) {
                return res.status(400).json({
                    message: `Insufficient stock. Current stock: ${currentStock}, attempting to change by: ${difference}`
                });
            }
            // Update the stock batch quantity
            await prisma_1.prisma.stockBatch.update({
                where: { id: existingStockRecord.stockBatchId },
                data: { stockQuantity: newStock },
            });
        }
        const { changeInStock, reason, changeDate } = updateData;
        const data = {};
        if (reason !== undefined) {
            data.reason = reason;
        }
        if (changeDate !== undefined) {
            data.changeDate = (0, stockRecordChangeMeta_1.toChangeDateIst)(changeDate instanceof Date ? changeDate : new Date(changeDate));
        }
        if (changeInStock !== undefined) {
            data.changeInStock = changeInStock;
            data.changeType = (0, stockRecordChangeMeta_1.changeTypeFromDelta)(changeInStock);
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        const stockRecord = await prisma_1.prisma.stockRecord.update({
            where: { id },
            data,
            include: {
                Product: {
                    include: {
                        Category: true,
                    },
                },
                StockBatch: {
                    include: {
                        product: { include: { Category: true } },
                    },
                },
                User: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        userType: true,
                    },
                },
            },
        });
        res.json({ stockRecord });
    }
    catch (error) {
        console.error("Error updating stock record:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateStockRecord = updateStockRecord;
// // Delete a stock record
// export const deleteStockRecord = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     // Check if stock record exists
//     const existingStockRecord = await prisma.stockRecord.findUnique({
//       where: { id },
//       include: {
//         StockBatch: true,
//         Order: true,
//       },
//     });
//     if (!existingStockRecord) {
//       return res.status(404).json({ message: "Stock record not found" });
//     }
//     // Check if stock record is used in any orders
//     if (existingStockRecord.Order && existingStockRecord.Order.length > 0) {
//       return res.status(400).json({
//         message: "Cannot delete stock record as it is associated with orders",
//       });
//     }
//     // Revert the stock batch quantity
//     const currentStock = existingStockRecord.StockBatch.stockQuantity;
//     const revertedStock = currentStock - existingStockRecord.changeInStock;
//     if (revertedStock < 0) {
//       return res.status(400).json({
//         message: "Cannot delete stock record as it would result in negative stock",
//       });
//     }
//     // Update the stock batch quantity
//     await prisma.stockBatch.update({
//       where: { id: existingStockRecord.stockBatchId },
//       data: { stockQuantity: revertedStock },
//     });
//     // Delete the stock record
//     await prisma.stockRecord.delete({
//       where: { id },
//     });
//     res.json({ 
//       message: "Stock record deleted successfully",
//       revertedStockQuantity: revertedStock 
//     });
//   } catch (error) {
//     console.error("Error deleting stock record:\n", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };
// Get stock records by product ID
const getStockRecordsByProductId = async (req, res) => {
    try {
        const { productId } = req.params;
        const { page = 1, limit = 10, reason, dateFrom, dateTo, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Verify that product exists
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
            include: {
                Category: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Build where clause
        const where = {
            productId: productId,
        };
        if (reason) {
            where.reason = reason;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }
        const [stockRecords, total] = await Promise.all([
            prisma_1.prisma.stockRecord.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    Product: {
                        include: {
                            Category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    StockBatch: {
                        include: {
                            product: { include: { Category: true } },
                        },
                    },
                    User: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            userType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.stockRecord.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            product,
            stockRecords,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching stock records by product ID:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getStockRecordsByProductId = getStockRecordsByProductId;
// Get stock records by stock batch ID
const getStockRecordsByStockBatchId = async (req, res) => {
    try {
        const { stockBatchId } = req.params;
        const { page = 1, limit = 10, reason, dateFrom, dateTo, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Verify that stock batch exists
        const stockBatch = await prisma_1.prisma.stockBatch.findUnique({
            where: { id: stockBatchId },
            include: {
                product: {
                    include: {
                        Category: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    }
                },
            },
        });
        if (!stockBatch) {
            return res.status(404).json({ message: "Stock batch not found" });
        }
        // Build where clause
        const where = {
            stockBatchId: stockBatchId,
        };
        if (reason) {
            where.reason = reason;
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.createdAt.lte = new Date(dateTo);
            }
        }
        const [stockRecords, total] = await Promise.all([
            prisma_1.prisma.stockRecord.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    Product: {
                        include: {
                            Category: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    StockBatch: {
                        include: {
                            product: { include: { Category: true } },
                        },
                    },
                    User: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            userType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.stockRecord.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            stockBatch,
            stockRecords,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching stock records by stock batch ID:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getStockRecordsByStockBatchId = getStockRecordsByStockBatchId;
// Get stock record statistics
const getStockRecordStats = async (req, res) => {
    try {
        const [totalStockRecords, arrivalRecords, deliveryRecords, correctionRecords, totalStockIn, totalStockOut,] = await Promise.all([
            prisma_1.prisma.stockRecord.count(),
            prisma_1.prisma.stockRecord.count({
                where: { reason: "ARRIVAL_FROM_SUPPLIER" },
            }),
            prisma_1.prisma.stockRecord.count({
                where: { reason: "ASSIGNED_TO_ORDER" },
            }),
            prisma_1.prisma.stockRecord.count({
                where: { reason: "CORRECTION_BY_ADMIN" },
            }),
            prisma_1.prisma.stockRecord.aggregate({
                where: { changeInStock: { gt: 0 } },
                _sum: { changeInStock: true },
            }),
            prisma_1.prisma.stockRecord.aggregate({
                where: { changeInStock: { lt: 0 } },
                _sum: { changeInStock: true },
            }),
        ]);
        // Get recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentActivity = await prisma_1.prisma.stockRecord.count({
            where: {
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        res.json({
            stats: {
                totalStockRecords,
                arrivalRecords,
                deliveryRecords,
                correctionRecords,
                totalStockIn: totalStockIn._sum.changeInStock || 0,
                totalStockOut: Math.abs(totalStockOut._sum.changeInStock || 0),
                recentActivity,
            },
        });
    }
    catch (error) {
        console.error("Error fetching stock record stats:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getStockRecordStats = getStockRecordStats;
//# sourceMappingURL=stockRecord.controller.js.map