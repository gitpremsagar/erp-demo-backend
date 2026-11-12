"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesOfficerStats = exports.deleteSalesOfficer = exports.getAssignedDistributors = exports.removeDistributorFromSalesOfficer = exports.assignDistributorToSalesOfficer = exports.updateSalesOfficer = exports.getSalesOfficerById = exports.getAllSalesOfficers = exports.createSalesOfficer = void 0;
const prisma_1 = require("../lib/prisma");
// Create a new sales officer
const createSalesOfficer = async (req, res) => {
    try {
        const { name, email, phone, password, } = req.body;
        // Check if user with same email or phone already exists
        const existingUser = await prisma_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    ...(phone ? [{ phone }] : []),
                ],
            },
        });
        if (existingUser) {
            return res.status(409).json({
                message: "User with same email or phone already exists"
            });
        }
        // Hash the password
        const bcrypt = require("bcrypt");
        const hashedPassword = await bcrypt.hash(password || "defaultPassword123", +process.env.BCRYPT_SALT_ROUNDS || 10);
        const salesOfficer = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                userType: "SALES_OFFICER",
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                userType: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({
            message: "Sales officer created successfully",
            salesOfficer,
        });
    }
    catch (error) {
        console.error("Error creating sales officer:", error);
        res.status(500).json({ message: "Error creating sales officer" });
    }
};
exports.createSalesOfficer = createSalesOfficer;
// Get all sales officers
const getAllSalesOfficers = async (req, res) => {
    try {
        const salesOfficers = await prisma_1.prisma.user.findMany({
            where: {
                userType: "SALES_OFFICER",
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json(salesOfficers);
    }
    catch (error) {
        console.error("Error fetching sales officers:", error);
        res.status(500).json({ message: "Error fetching sales officers" });
    }
};
exports.getAllSalesOfficers = getAllSalesOfficers;
// Get sales officer by ID with assigned distributors
const getSalesOfficerById = async (req, res) => {
    try {
        const { id } = req.params;
        const salesOfficer = await prisma_1.prisma.user.findUnique({
            where: { id },
            include: {
                SalesOfficerAssignment: {
                    include: {
                        Distributor: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                CustomerDetail: true,
                            },
                        },
                    },
                },
            },
        });
        if (!salesOfficer) {
            return res.status(404).json({ message: "Sales officer not found" });
        }
        res.status(200).json(salesOfficer);
    }
    catch (error) {
        console.error("Error fetching sales officer:", error);
        res.status(500).json({ message: "Error fetching sales officer" });
    }
};
exports.getSalesOfficerById = getSalesOfficerById;
// Update sales officer
const updateSalesOfficer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, password } = req.body;
        // Check if sales officer exists
        const existingSalesOfficer = await prisma_1.prisma.user.findUnique({
            where: { id },
        });
        if (!existingSalesOfficer || existingSalesOfficer.userType !== "SALES_OFFICER") {
            return res.status(404).json({ message: "Sales officer not found" });
        }
        // Check if email or phone is being updated and already exists for another user
        if (email || phone) {
            const duplicateUser = await prisma_1.prisma.user.findFirst({
                where: {
                    AND: [
                        { id: { not: id } }, // Exclude current user
                        {
                            OR: [
                                ...(email ? [{ email }] : []),
                                ...(phone ? [{ phone }] : []),
                            ],
                        },
                    ],
                },
            });
            if (duplicateUser) {
                return res.status(409).json({
                    message: "User with same email or phone already exists"
                });
            }
        }
        // Prepare update data
        const updateData = {};
        if (name)
            updateData.name = name;
        if (email)
            updateData.email = email;
        if (phone)
            updateData.phone = phone;
        // Hash password if provided
        if (password) {
            const bcrypt = require("bcrypt");
            updateData.password = await bcrypt.hash(password, +process.env.BCRYPT_SALT_ROUNDS || 10);
        }
        const updatedSalesOfficer = await prisma_1.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                userType: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json({
            message: "Sales officer updated successfully",
            salesOfficer: updatedSalesOfficer,
        });
    }
    catch (error) {
        console.error("Error updating sales officer:", error);
        res.status(500).json({ message: "Error updating sales officer" });
    }
};
exports.updateSalesOfficer = updateSalesOfficer;
// Assign distributor to sales officer
const assignDistributorToSalesOfficer = async (req, res) => {
    try {
        const { salesOfficerId, distributorId } = req.body;
        // Check if sales officer exists
        const salesOfficer = await prisma_1.prisma.user.findUnique({
            where: { id: salesOfficerId },
        });
        if (!salesOfficer || salesOfficer.userType !== "SALES_OFFICER") {
            return res.status(404).json({ message: "Sales officer not found" });
        }
        // Check if distributor exists
        const distributor = await prisma_1.prisma.user.findUnique({
            where: { id: distributorId },
        });
        if (!distributor || distributor.userType !== "CUSTOMER") {
            return res.status(404).json({ message: "Distributor not found" });
        }
        // Create assignment
        const assignment = await prisma_1.prisma.salesOfficerAssignment.create({
            data: {
                salesOfficerId,
                distributorId,
            },
            include: {
                SalesOfficer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                Distributor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        res.status(201).json(assignment);
    }
    catch (error) {
        console.error("Error assigning distributor:", error);
        if (error.code === "P2002") {
            return res
                .status(400)
                .json({ message: "This distributor is already assigned to this sales officer" });
        }
        res.status(500).json({ message: "Error assigning distributor" });
    }
};
exports.assignDistributorToSalesOfficer = assignDistributorToSalesOfficer;
// Remove distributor from sales officer
const removeDistributorFromSalesOfficer = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.salesOfficerAssignment.delete({
            where: { id },
        });
        res.status(200).json({ message: "Distributor removed successfully" });
    }
    catch (error) {
        console.error("Error removing distributor:", error);
        res.status(500).json({ message: "Error removing distributor" });
    }
};
exports.removeDistributorFromSalesOfficer = removeDistributorFromSalesOfficer;
// Get assigned distributors for a sales officer
const getAssignedDistributors = async (req, res) => {
    try {
        const { salesOfficerId } = req.params;
        const assignments = await prisma_1.prisma.salesOfficerAssignment.findMany({
            where: {
                salesOfficerId,
            },
            include: {
                Distributor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        CustomerDetail: true,
                    },
                },
            },
        });
        const distributors = assignments.map((assignment) => assignment.Distributor);
        res.status(200).json(distributors);
    }
    catch (error) {
        console.error("Error fetching assigned distributors:", error);
        res.status(500).json({ message: "Error fetching assigned distributors" });
    }
};
exports.getAssignedDistributors = getAssignedDistributors;
// Delete sales officer
const deleteSalesOfficer = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if sales officer exists
        const salesOfficer = await prisma_1.prisma.user.findUnique({
            where: { id },
        });
        if (!salesOfficer || salesOfficer.userType !== "SALES_OFFICER") {
            return res.status(404).json({ message: "Sales officer not found" });
        }
        // Delete all assignments first (cascade delete)
        await prisma_1.prisma.salesOfficerAssignment.deleteMany({
            where: {
                salesOfficerId: id,
            },
        });
        // Delete the sales officer
        await prisma_1.prisma.user.delete({
            where: { id },
        });
        res.status(200).json({ message: "Sales officer deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting sales officer:", error);
        res.status(500).json({ message: "Error deleting sales officer" });
    }
};
exports.deleteSalesOfficer = deleteSalesOfficer;
// Get sales officer stats
const getSalesOfficerStats = async (req, res) => {
    try {
        const { salesOfficerId } = req.params;
        // Get assigned distributors
        const assignedDistributors = await prisma_1.prisma.salesOfficerAssignment.count({
            where: {
                salesOfficerId,
            },
        });
        // Get total orders for assigned distributors
        const distributorIds = await prisma_1.prisma.salesOfficerAssignment.findMany({
            where: {
                salesOfficerId,
            },
            select: {
                distributorId: true,
            },
        });
        const totalOrders = await prisma_1.prisma.order.count({
            where: {
                customerId: {
                    in: distributorIds.map((d) => d.distributorId),
                },
            },
        });
        // Get pending forecasts
        const pendingForecasts = await prisma_1.prisma.forecast.count({
            where: {
                distributorId: {
                    in: distributorIds.map((d) => d.distributorId),
                },
            },
        });
        res.status(200).json({
            assignedDistributors,
            totalOrders,
            pendingForecasts,
        });
    }
    catch (error) {
        console.error("Error fetching sales officer stats:", error);
        res.status(500).json({ message: "Error fetching sales officer stats" });
    }
};
exports.getSalesOfficerStats = getSalesOfficerStats;
//# sourceMappingURL=salesOfficer.controller.js.map