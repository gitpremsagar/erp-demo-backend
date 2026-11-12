import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const createOrderStatusType = async (req: Request, res: Response) => {
  try {
    const { name, displayName, sortOrder } = req.body;
    const code = String(name).trim().toUpperCase().replace(/\s+/g, "_");

    const existing = await prisma.orderStatusType.findFirst({
      where: { name: code },
    });

    if (existing) {
      return res.status(409).json({ message: "Order status type with this name already exists" });
    }

    const orderStatusType = await prisma.orderStatusType.create({
      data: {
        name: code,
        displayName: displayName?.trim() || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    res.status(201).json({ orderStatusType });
  } catch (error) {
    console.error("Error creating order status type:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrderStatusTypes = async (req: Request, res: Response) => {
  try {
    const orderStatusTypes = await prisma.orderStatusType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    res.json({ orderStatusTypes });
  } catch (error) {
    console.error("Error fetching order status types:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrderStatusTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const orderStatusType = await prisma.orderStatusType.findUnique({
      where: { id },
      include: { Order: { select: { id: true } } },
    });

    if (!orderStatusType) {
      return res.status(404).json({ message: "Order status type not found" });
    }

    res.json({ orderStatusType });
  } catch (error) {
    console.error("Error fetching order status type:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateOrderStatusType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, displayName, sortOrder } = req.body;

    const existing = await prisma.orderStatusType.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Order status type not found" });
    }

    const updates: { name?: string; displayName?: string | null; sortOrder?: number } = {};
    if (name !== undefined) {
      const code = String(name).trim().toUpperCase().replace(/\s+/g, "_");
      if (code !== existing.name) {
        const duplicate = await prisma.orderStatusType.findFirst({
          where: { name: code, id: { not: id } },
        });
        if (duplicate) {
          return res.status(409).json({ message: "Order status type with this name already exists" });
        }
        updates.name = code;
      }
    }
    if (displayName !== undefined) updates.displayName = displayName?.trim() || null;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const orderStatusType = await prisma.orderStatusType.update({
      where: { id },
      data: updates,
    });

    res.json({ orderStatusType });
  } catch (error) {
    console.error("Error updating order status type:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteOrderStatusType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.orderStatusType.findUnique({
      where: { id },
      include: { Order: { select: { id: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Order status type not found" });
    }

    if (existing.Order.length > 0) {
      return res.status(400).json({
        message: "Cannot delete order status type that is assigned to one or more orders",
      });
    }

    await prisma.orderStatusType.delete({
      where: { id },
    });

    res.json({ message: "Order status type deleted successfully" });
  } catch (error) {
    console.error("Error deleting order status type:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
