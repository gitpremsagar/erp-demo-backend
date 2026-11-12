"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVehicleType = exports.updateVehicleType = exports.getVehicleTypeById = exports.getVehicleTypes = exports.createVehicleType = void 0;
const prisma_1 = require("../lib/prisma");
// Vehicle Type Controllers
const createVehicleType = async (req, res) => {
    try {
        const { name } = req.body;
        const existing = await prisma_1.prisma.vehicleType.findFirst({
            where: { name: name.trim() },
        });
        if (existing) {
            return res.status(409).json({ message: "Vehicle type with this name already exists" });
        }
        const vehicleType = await prisma_1.prisma.vehicleType.create({
            data: { name: name.trim() },
        });
        res.status(201).json({ vehicleType });
    }
    catch (error) {
        console.error("Error creating vehicle type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createVehicleType = createVehicleType;
const getVehicleTypes = async (req, res) => {
    try {
        const vehicleTypes = await prisma_1.prisma.vehicleType.findMany({
            orderBy: { name: "asc" },
        });
        res.json({ vehicleTypes });
    }
    catch (error) {
        console.error("Error fetching vehicle types:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVehicleTypes = getVehicleTypes;
const getVehicleTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicleType = await prisma_1.prisma.vehicleType.findUnique({
            where: { id },
            include: { Vehicle: { select: { id: true } } },
        });
        if (!vehicleType) {
            return res.status(404).json({ message: "Vehicle type not found" });
        }
        res.json({ vehicleType });
    }
    catch (error) {
        console.error("Error fetching vehicle type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVehicleTypeById = getVehicleTypeById;
const updateVehicleType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const existing = await prisma_1.prisma.vehicleType.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Vehicle type not found" });
        }
        if (name && name.trim() !== existing.name) {
            const duplicate = await prisma_1.prisma.vehicleType.findFirst({
                where: { name: name.trim(), id: { not: id } },
            });
            if (duplicate) {
                return res.status(409).json({ message: "Vehicle type with this name already exists" });
            }
        }
        const vehicleType = await prisma_1.prisma.vehicleType.update({
            where: { id },
            data: name !== undefined ? { name: name.trim() } : {},
        });
        res.json({ vehicleType });
    }
    catch (error) {
        console.error("Error updating vehicle type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateVehicleType = updateVehicleType;
const deleteVehicleType = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.vehicleType.findUnique({
            where: { id },
            include: { Vehicle: { select: { id: true } } },
        });
        if (!existing) {
            return res.status(404).json({ message: "Vehicle type not found" });
        }
        if (existing.Vehicle.length > 0) {
            return res.status(400).json({
                message: "Cannot delete vehicle type that is assigned to one or more vehicles",
            });
        }
        await prisma_1.prisma.vehicleType.delete({
            where: { id },
        });
        res.json({ message: "Vehicle type deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting vehicle type:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteVehicleType = deleteVehicleType;
//# sourceMappingURL=vehicleType.controller.js.map