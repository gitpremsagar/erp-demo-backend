"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTransporter = exports.updateTransporter = exports.getTransporterById = exports.getTransporters = exports.createTransporter = void 0;
const prisma_1 = require("../../lib/prisma");
const createTransporter = async (req, res) => {
    try {
        const { name, transporterContact, area } = req.body;
        const transporter = await prisma_1.prisma.transporter.create({
            data: {
                name,
                transporterContact: transporterContact ?? null,
                area: area ?? null,
            },
        });
        res.status(201).json({ transporter });
    }
    catch (error) {
        console.error("Error creating transporter:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createTransporter = createTransporter;
const getTransporters = async (req, res) => {
    try {
        const transporters = await prisma_1.prisma.transporter.findMany({
            orderBy: { name: "asc" },
        });
        res.json({ transporters });
    }
    catch (error) {
        console.error("Error fetching transporters:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getTransporters = getTransporters;
const getTransporterById = async (req, res) => {
    try {
        const { id } = req.params;
        const transporter = await prisma_1.prisma.transporter.findUnique({
            where: { id },
            include: {
                purchases: true,
            },
        });
        if (!transporter) {
            return res.status(404).json({ message: "Transporter not found" });
        }
        res.json({ transporter });
    }
    catch (error) {
        console.error("Error fetching transporter:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getTransporterById = getTransporterById;
const updateTransporter = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, transporterContact, area } = req.body;
        const existing = await prisma_1.prisma.transporter.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Transporter not found" });
        }
        const transporter = await prisma_1.prisma.transporter.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(transporterContact !== undefined && { transporterContact }),
                ...(area !== undefined && { area }),
            },
        });
        res.json({ transporter });
    }
    catch (error) {
        console.error("Error updating transporter:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateTransporter = updateTransporter;
const deleteTransporter = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.transporter.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ message: "Transporter not found" });
        }
        await prisma_1.prisma.transporter.delete({
            where: { id },
        });
        res.json({ message: "Transporter deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting transporter:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteTransporter = deleteTransporter;
//# sourceMappingURL=transporter.controller.js.map