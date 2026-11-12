"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlant = exports.updatePlant = exports.getPlantById = exports.getPlants = exports.createPlant = void 0;
const prisma_1 = require("../lib/prisma");
// Plant Controllers
const createPlant = async (req, res) => {
    try {
        const { name, location } = req.body;
        // Check if plant name already exists
        const existingPlant = await prisma_1.prisma.plant.findFirst({
            where: { name },
        });
        if (existingPlant) {
            return res.status(409).json({ message: "Plant name already exists" });
        }
        const plant = await prisma_1.prisma.plant.create({
            data: {
                name,
                ...(location !== undefined && { location })
            },
        });
        res.status(201).json({ plant });
    }
    catch (error) {
        console.error("Error creating plant:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createPlant = createPlant;
const getPlants = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ];
        }
        const [plants, total] = await Promise.all([
            prisma_1.prisma.plant.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { name: "asc" },
            }),
            prisma_1.prisma.plant.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            plants,
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
        console.error("Error fetching plants:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPlants = getPlants;
const getPlantById = async (req, res) => {
    try {
        const { id } = req.params;
        const plant = await prisma_1.prisma.plant.findUnique({
            where: { id },
            include: {
                Product: true,
            },
        });
        if (!plant) {
            return res.status(404).json({ message: "Plant not found" });
        }
        res.json({ plant });
    }
    catch (error) {
        console.error("Error fetching plant:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPlantById = getPlantById;
const updatePlant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location } = req.body;
        // Check if plant exists
        const existingPlant = await prisma_1.prisma.plant.findUnique({
            where: { id },
        });
        if (!existingPlant) {
            return res.status(404).json({ message: "Plant not found" });
        }
        // If name is being updated, check for uniqueness
        if (name && name !== existingPlant.name) {
            const duplicatePlant = await prisma_1.prisma.plant.findFirst({
                where: { name },
            });
            if (duplicatePlant) {
                return res.status(409).json({ message: "Plant name already exists" });
            }
        }
        const plant = await prisma_1.prisma.plant.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(location !== undefined && { location })
            },
        });
        res.json({ plant });
    }
    catch (error) {
        console.error("Error updating plant:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updatePlant = updatePlant;
const deletePlant = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if plant exists and count related entities
        const existingPlant = await prisma_1.prisma.plant.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        Product: true,
                    },
                },
            },
        });
        if (!existingPlant) {
            return res.status(404).json({ message: "Plant not found" });
        }
        // Cascade update: Set plantId to null for all affected products
        // Then delete the plant
        const affectedProductsCount = existingPlant._count.Product;
        await prisma_1.prisma.$transaction(async (tx) => {
            // Update all products that reference this plant
            if (affectedProductsCount > 0) {
                await tx.product.updateMany({
                    where: { plantId: id },
                    data: { plantId: null },
                });
            }
            // Delete the plant
            await tx.plant.delete({
                where: { id },
            });
        });
        // Build informative message
        const message = affectedProductsCount > 0
            ? `Plant deleted successfully. ${affectedProductsCount} product(s) had their plant reference removed.`
            : "Plant deleted successfully";
        res.json({ message });
    }
    catch (error) {
        console.error("Error deleting plant:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deletePlant = deletePlant;
//# sourceMappingURL=plant.controller.js.map