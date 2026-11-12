import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const createTransporter = async (req: Request, res: Response) => {
  try {
    const { name, transporterContact, area } = req.body;

    const transporter = await prisma.transporter.create({
      data: {
        name,
        transporterContact: transporterContact ?? null,
        area: area ?? null,
      },
    });

    res.status(201).json({ transporter });
  } catch (error) {
    console.error("Error creating transporter:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTransporters = async (req: Request, res: Response) => {
  try {
    const transporters = await prisma.transporter.findMany({
      orderBy: { name: "asc" },
    });

    res.json({ transporters });
  } catch (error) {
    console.error("Error fetching transporters:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getTransporterById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transporter = await prisma.transporter.findUnique({
      where: { id },
      include: {
        purchases: true,
      },
    });

    if (!transporter) {
      return res.status(404).json({ message: "Transporter not found" });
    }

    res.json({ transporter });
  } catch (error) {
    console.error("Error fetching transporter:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateTransporter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, transporterContact, area } = req.body;

    const existing = await prisma.transporter.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Transporter not found" });
    }

    const transporter = await prisma.transporter.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(transporterContact !== undefined && { transporterContact }),
        ...(area !== undefined && { area }),
      },
    });

    res.json({ transporter });
  } catch (error) {
    console.error("Error updating transporter:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteTransporter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.transporter.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Transporter not found" });
    }

    await prisma.transporter.delete({
      where: { id },
    });

    res.json({ message: "Transporter deleted successfully" });
  } catch (error) {
    console.error("Error deleting transporter:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
