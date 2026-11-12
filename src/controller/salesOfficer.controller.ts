import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Create a new sales officer
export const createSalesOfficer = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    // Check if user with same email or phone already exists
    const existingUser = await prisma.user.findFirst({
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
    const hashedPassword = await bcrypt.hash(
      password || "defaultPassword123",
      +process.env.BCRYPT_SALT_ROUNDS! || 10
    );

    const salesOfficer = await prisma.user.create({
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
  } catch (error) {
    console.error("Error creating sales officer:", error);
    res.status(500).json({ message: "Error creating sales officer" });
  }
};

// Get all sales officers
export const getAllSalesOfficers = async (req: Request, res: Response) => {
  try {
    const salesOfficers = await prisma.user.findMany({
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
  } catch (error) {
    console.error("Error fetching sales officers:", error);
    res.status(500).json({ message: "Error fetching sales officers" });
  }
};

// Get sales officer by ID with assigned distributors
export const getSalesOfficerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const salesOfficer = await prisma.user.findUnique({
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
  } catch (error) {
    console.error("Error fetching sales officer:", error);
    res.status(500).json({ message: "Error fetching sales officer" });
  }
};

// Update sales officer
export const updateSalesOfficer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;

    // Check if sales officer exists
    const existingSalesOfficer = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingSalesOfficer || existingSalesOfficer.userType !== "SALES_OFFICER") {
      return res.status(404).json({ message: "Sales officer not found" });
    }

    // Check if email or phone is being updated and already exists for another user
    if (email || phone) {
      const duplicateUser = await prisma.user.findFirst({
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
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    
    // Hash password if provided
    if (password) {
      const bcrypt = require("bcrypt");
      updateData.password = await bcrypt.hash(
        password,
        +process.env.BCRYPT_SALT_ROUNDS! || 10
      );
    }

    const updatedSalesOfficer = await prisma.user.update({
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
  } catch (error) {
    console.error("Error updating sales officer:", error);
    res.status(500).json({ message: "Error updating sales officer" });
  }
};

// Assign distributor to sales officer
export const assignDistributorToSalesOfficer = async (
  req: Request,
  res: Response
) => {
  try {
    const { salesOfficerId, distributorId } = req.body;

    // Check if sales officer exists
    const salesOfficer = await prisma.user.findUnique({
      where: { id: salesOfficerId },
    });

    if (!salesOfficer || salesOfficer.userType !== "SALES_OFFICER") {
      return res.status(404).json({ message: "Sales officer not found" });
    }

    // Check if distributor exists
    const distributor = await prisma.user.findUnique({
      where: { id: distributorId },
    });

    if (!distributor || distributor.userType !== "CUSTOMER") {
      return res.status(404).json({ message: "Distributor not found" });
    }

    // Create assignment
    const assignment = await prisma.salesOfficerAssignment.create({
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
  } catch (error: any) {
    console.error("Error assigning distributor:", error);
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ message: "This distributor is already assigned to this sales officer" });
    }
    res.status(500).json({ message: "Error assigning distributor" });
  }
};

// Remove distributor from sales officer
export const removeDistributorFromSalesOfficer = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    await prisma.salesOfficerAssignment.delete({
      where: { id },
    });

    res.status(200).json({ message: "Distributor removed successfully" });
  } catch (error) {
    console.error("Error removing distributor:", error);
    res.status(500).json({ message: "Error removing distributor" });
  }
};

// Get assigned distributors for a sales officer
export const getAssignedDistributors = async (req: Request, res: Response) => {
  try {
    const { salesOfficerId } = req.params;

    const assignments = await prisma.salesOfficerAssignment.findMany({
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
  } catch (error) {
    console.error("Error fetching assigned distributors:", error);
    res.status(500).json({ message: "Error fetching assigned distributors" });
  }
};

// Delete sales officer
export const deleteSalesOfficer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if sales officer exists
    const salesOfficer = await prisma.user.findUnique({
      where: { id },
    });

    if (!salesOfficer || salesOfficer.userType !== "SALES_OFFICER") {
      return res.status(404).json({ message: "Sales officer not found" });
    }

    // Delete all assignments first (cascade delete)
    await prisma.salesOfficerAssignment.deleteMany({
      where: {
        salesOfficerId: id,
      },
    });

    // Delete the sales officer
    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({ message: "Sales officer deleted successfully" });
  } catch (error) {
    console.error("Error deleting sales officer:", error);
    res.status(500).json({ message: "Error deleting sales officer" });
  }
};

// Get sales officer stats
export const getSalesOfficerStats = async (req: Request, res: Response) => {
  try {
    const { salesOfficerId } = req.params;

    // Get assigned distributors
    const assignedDistributors = await prisma.salesOfficerAssignment.count({
      where: {
        salesOfficerId,
      },
    });

    // Get total orders for assigned distributors
    const distributorIds = await prisma.salesOfficerAssignment.findMany({
      where: {
        salesOfficerId,
      },
      select: {
        distributorId: true,
      },
    });

    const totalOrders = await prisma.order.count({
      where: {
        customerId: {
          in: distributorIds.map((d) => d.distributorId),
        },
      },
    });

    // Get pending forecasts
    const pendingForecasts = await prisma.forecast.count({
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
  } catch (error) {
    console.error("Error fetching sales officer stats:", error);
    res.status(500).json({ message: "Error fetching sales officer stats" });
  }
};
