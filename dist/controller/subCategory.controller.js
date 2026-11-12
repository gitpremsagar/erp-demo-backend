"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSubCategory = exports.updateSubCategory = exports.getSubCategoryById = exports.getSubCategories = exports.createSubCategory = void 0;
const prisma_1 = require("../lib/prisma");
const createSubCategory = async (req, res) => {
    try {
        const { name, description, categoryId } = req.body;
        const category = await prisma_1.prisma.category.findUnique({
            where: { id: categoryId },
        });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        const existing = await prisma_1.prisma.subCategory.findFirst({
            where: { categoryId, name },
        });
        if (existing) {
            return res
                .status(409)
                .json({ message: "Sub-category name already exists in this category" });
        }
        const subCategory = await prisma_1.prisma.subCategory.create({
            data: {
                name,
                description,
                categoryId,
            },
        });
        res.status(201).json({ subCategory });
    }
    catch (error) {
        console.error("Error creating sub-category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createSubCategory = createSubCategory;
const getSubCategories = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const where = typeof categoryId === "string" && categoryId.length > 0
            ? { categoryId }
            : {};
        const subCategories = await prisma_1.prisma.subCategory.findMany({
            where,
            orderBy: { name: "asc" },
            include: {
                Category: {
                    select: { id: true, name: true },
                },
            },
        });
        res.json({ subCategories });
    }
    catch (error) {
        console.error("Error fetching sub-categories:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getSubCategories = getSubCategories;
const getSubCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const subCategory = await prisma_1.prisma.subCategory.findUnique({
            where: { id },
            include: {
                Category: {
                    select: { id: true, name: true },
                },
            },
        });
        if (!subCategory) {
            return res.status(404).json({ message: "Sub-category not found" });
        }
        res.json({ subCategory });
    }
    catch (error) {
        console.error("Error fetching sub-category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getSubCategoryById = getSubCategoryById;
const updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, categoryId } = req.body;
        const existingSubCategory = await prisma_1.prisma.subCategory.findUnique({
            where: { id },
        });
        if (!existingSubCategory) {
            return res.status(404).json({ message: "Sub-category not found" });
        }
        const nextCategoryId = categoryId ?? existingSubCategory.categoryId;
        const nextName = name ?? existingSubCategory.name;
        if (categoryId && categoryId !== existingSubCategory.categoryId) {
            const category = await prisma_1.prisma.category.findUnique({
                where: { id: categoryId },
            });
            if (!category) {
                return res.status(404).json({ message: "Category not found" });
            }
        }
        if (nextName !== existingSubCategory.name ||
            nextCategoryId !== existingSubCategory.categoryId) {
            const duplicate = await prisma_1.prisma.subCategory.findFirst({
                where: {
                    categoryId: nextCategoryId,
                    name: nextName,
                    NOT: { id },
                },
            });
            if (duplicate) {
                return res.status(409).json({
                    message: "Sub-category name already exists in this category",
                });
            }
        }
        const subCategory = await prisma_1.prisma.subCategory.update({
            where: { id },
            data: {
                name,
                description,
                categoryId,
            },
        });
        res.json({ subCategory });
    }
    catch (error) {
        console.error("Error updating sub-category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateSubCategory = updateSubCategory;
const deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSubCategory = await prisma_1.prisma.subCategory.findUnique({
            where: { id },
        });
        if (!existingSubCategory) {
            return res.status(404).json({ message: "Sub-category not found" });
        }
        const products = await prisma_1.prisma.product.findMany({
            where: { subCategoryId: id },
            select: { id: true },
        });
        if (products.length > 0) {
            return res.status(400).json({
                message: "Cannot delete sub-category as it is associated with existing products",
            });
        }
        await prisma_1.prisma.subCategory.delete({
            where: { id },
        });
        res.json({ message: "Sub-category deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting sub-category:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteSubCategory = deleteSubCategory;
//# sourceMappingURL=subCategory.controller.js.map