"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.getCategories = exports.createCategory = void 0;
const prisma_1 = require("../lib/prisma");
// Category Controllers
const createCategory = async (req, res) => {
    try {
        const { name, description, position } = req.body;
        // Check if category name already exists
        const existingCategory = await prisma_1.prisma.category.findUnique({
            where: { name },
        });
        if (existingCategory) {
            return res.status(409).json({ message: "Category name already exists" });
        }
        const category = await prisma_1.prisma.category.create({
            data: {
                name,
                description,
                position: typeof position === "number" ? position : undefined,
            },
        });
        res.status(201).json({ category });
    }
    catch (error) {
        console.error("Error creating category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createCategory = createCategory;
const getCategories = async (req, res) => {
    try {
        const categories = await prisma_1.prisma.category.findMany({
            orderBy: { name: "asc" },
        });
        res.json({ categories });
    }
    catch (error) {
        console.error("Error fetching categories:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCategories = getCategories;
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma_1.prisma.category.findUnique({
            where: { id },
            include: {
                Product: true,
            },
        });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        res.json({ category });
    }
    catch (error) {
        console.error("Error fetching category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCategoryById = getCategoryById;
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, position } = req.body;
        // Check if category exists
        const existingCategory = await prisma_1.prisma.category.findUnique({
            where: { id },
        });
        if (!existingCategory) {
            return res.status(404).json({ message: "Category not found" });
        }
        // If name is being updated, check for uniqueness
        if (name && name !== existingCategory.name) {
            const duplicateCategory = await prisma_1.prisma.category.findUnique({
                where: { name },
            });
            if (duplicateCategory) {
                return res.status(409).json({ message: "Category name already exists" });
            }
        }
        const category = await prisma_1.prisma.category.update({
            where: { id },
            data: {
                name,
                description,
                position: typeof position === "number" ? position : existingCategory.position,
            },
        });
        res.json({ category });
    }
    catch (error) {
        console.error("Error updating category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if category exists
        const existingCategory = await prisma_1.prisma.category.findUnique({
            where: { id },
        });
        if (!existingCategory) {
            return res.status(404).json({ message: "Category not found" });
        }
        // Check if category is used by any products
        const products = await prisma_1.prisma.product.findMany({
            where: { categoryId: id },
        });
        if (products.length > 0) {
            return res.status(400).json({
                message: "Cannot delete category as it is associated with existing products",
            });
        }
        const subCategories = await prisma_1.prisma.subCategory.findMany({
            where: { categoryId: id },
            select: { id: true },
        });
        if (subCategories.length > 0) {
            return res.status(400).json({
                message: "Cannot delete category as it has existing sub-categories. Delete them first.",
            });
        }
        await prisma_1.prisma.category.delete({
            where: { id },
        });
        res.json({ message: "Category deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteCategory = deleteCategory;
//# sourceMappingURL=category.controller.js.map