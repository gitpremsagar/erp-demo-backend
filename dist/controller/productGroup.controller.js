"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductGroupStats = exports.deleteProductGroup = exports.updateProductGroup = exports.getProductGroupById = exports.getProductGroups = exports.createProductGroup = void 0;
const prisma_1 = require("../lib/prisma");
// Create a new product group
const createProductGroup = async (req, res) => {
    try {
        const { name } = req.body;
        // Check if product group name already exists
        const existingGroup = await prisma_1.prisma.productGroup.findFirst({
            where: { name },
        });
        if (existingGroup) {
            return res.status(409).json({ message: "Product group with this name already exists" });
        }
        const productGroup = await prisma_1.prisma.productGroup.create({
            data: { name },
        });
        res.status(201).json({ productGroup });
    }
    catch (error) {
        console.error("Error creating product group:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createProductGroup = createProductGroup;
// Get all product groups with pagination and filtering
const getProductGroups = async (req, res) => {
    try {
        const { page = 1, limit = 1000, search, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }
        const [productGroups, total] = await Promise.all([
            prisma_1.prisma.productGroup.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: {
                            Product: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.productGroup.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            productGroups,
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
        console.error("Error fetching product groups:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductGroups = getProductGroups;
// Get a single product group by ID
const getProductGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const productGroup = await prisma_1.prisma.productGroup.findUnique({
            where: { id },
            include: {
                Product: {
                    select: {
                        id: true,
                        name: true,
                        productCode: true,
                        mrp: true,
                    },
                },
                _count: {
                    select: {
                        Product: true,
                    },
                },
            },
        });
        if (!productGroup) {
            return res.status(404).json({ message: "Product group not found" });
        }
        res.json({ productGroup });
    }
    catch (error) {
        console.error("Error fetching product group:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductGroupById = getProductGroupById;
// Update a product group
const updateProductGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        // Check if product group exists
        const existingGroup = await prisma_1.prisma.productGroup.findUnique({
            where: { id },
        });
        if (!existingGroup) {
            return res.status(404).json({ message: "Product group not found" });
        }
        // If name is being updated, check for uniqueness
        if (name && name !== existingGroup.name) {
            const duplicateGroup = await prisma_1.prisma.productGroup.findFirst({
                where: { name },
            });
            if (duplicateGroup) {
                return res.status(409).json({ message: "Product group with this name already exists" });
            }
        }
        const productGroup = await prisma_1.prisma.productGroup.update({
            where: { id },
            data: { name },
            include: {
                _count: {
                    select: {
                        Product: true,
                    },
                },
            },
        });
        res.json({ productGroup });
    }
    catch (error) {
        console.error("Error updating product group:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProductGroup = updateProductGroup;
// Delete a product group
const deleteProductGroup = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if product group exists
        const existingGroup = await prisma_1.prisma.productGroup.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        Product: true,
                    },
                },
            },
        });
        if (!existingGroup) {
            return res.status(404).json({ message: "Product group not found" });
        }
        // Cascade update: Set productGroupId to null for all affected products
        // Then delete the product group
        const affectedProductsCount = existingGroup._count.Product;
        await prisma_1.prisma.$transaction(async (tx) => {
            // Update all products that reference this product group
            if (affectedProductsCount > 0) {
                await tx.product.updateMany({
                    where: { productGroupId: id },
                    data: { productGroupId: null },
                });
            }
            // Delete the product group
            await tx.productGroup.delete({
                where: { id },
            });
        });
        const message = affectedProductsCount > 0
            ? `Product group deleted successfully. ${affectedProductsCount} product(s) had their product group reference removed.`
            : "Product group deleted successfully";
        res.json({ message });
    }
    catch (error) {
        console.error("Error deleting product group:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteProductGroup = deleteProductGroup;
// Get product group statistics
const getProductGroupStats = async (req, res) => {
    try {
        const [totalGroups, mostUsedGroups, emptyGroups] = await Promise.all([
            prisma_1.prisma.productGroup.count(),
            prisma_1.prisma.productGroup.findMany({
                include: {
                    _count: {
                        select: {
                            Product: true,
                        },
                    },
                },
                orderBy: {
                    Product: {
                        _count: "desc",
                    },
                },
                take: 5,
            }),
            prisma_1.prisma.productGroup.findMany({
                where: {
                    Product: {
                        none: {},
                    },
                },
                include: {
                    _count: {
                        select: {
                            Product: true,
                        },
                    },
                },
            }),
        ]);
        res.json({
            stats: {
                totalGroups,
                mostUsedGroups,
                emptyGroupsCount: emptyGroups.length,
                emptyGroups,
            },
        });
    }
    catch (error) {
        console.error("Error fetching product group stats:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductGroupStats = getProductGroupStats;
//# sourceMappingURL=productGroup.controller.js.map