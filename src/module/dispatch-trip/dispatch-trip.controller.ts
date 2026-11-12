import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

const includeRelations = {
  Vehicle: true,
  Order: true,
  Distributor: { select: { id: true, name: true, email: true, userType: true } },
  Driver: { select: { id: true, name: true, email: true, phone: true, userType: true } },
};

export const createDispatchTrip = async (req: Request, res: Response) => {
  try {
    const { tripNumber, tripDate, distributorId, orderId, vehicleId, vehiclePosition, driverId, remarks } =
      req.body;

    const dispatchTrip = await prisma.dispatchTrip.create({
      data: {
        tripNumber: tripNumber ?? 1,
        tripDate: tripDate ?? new Date(),
        distributorId: distributorId || null,
        orderId: orderId || null,
        vehicleId: vehicleId || null,
        vehiclePosition: vehiclePosition ?? 1,
        driverId: driverId || null,
        remarks: remarks || null,
      },
      include: includeRelations,
    });

    res.status(201).json({ dispatchTrip });
  } catch (error) {
    console.error("Error creating dispatch trip:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const DATE_YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDayStart(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

function parseUtcDayEndExclusive(dateStr: string): Date {
  const end = parseUtcDayStart(dateStr);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export const getDispatchTrips = async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const startDateStr = req.query.startDate as string | undefined;
    const endDateStr = req.query.endDate as string | undefined;

    const where: { tripDate?: { gte?: Date; lt?: Date } } = {};

    if (startDateStr || endDateStr) {
      if (!startDateStr || !endDateStr) {
        return res.status(400).json({ message: "Both startDate and endDate are required" });
      }
      if (!DATE_YMD_REGEX.test(startDateStr) || !DATE_YMD_REGEX.test(endDateStr)) {
        return res.status(400).json({ message: "startDate and endDate must be YYYY-MM-DD" });
      }
      if (startDateStr > endDateStr) {
        return res.status(400).json({ message: "startDate must be on or before endDate" });
      }

      where.tripDate = {
        gte: parseUtcDayStart(startDateStr),
        lt: parseUtcDayEndExclusive(endDateStr),
      };
    } else if (dateStr && DATE_YMD_REGEX.test(dateStr)) {
      where.tripDate = {
        gte: parseUtcDayStart(dateStr),
        lt: parseUtcDayEndExclusive(dateStr),
      };
    }

    const dispatchTrips = await prisma.dispatchTrip.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: [{ tripDate: "desc" }, { tripNumber: "asc" }, { vehiclePosition: "asc" }],
      include: includeRelations,
    });

    res.json({ dispatchTrips });
  } catch (error) {
    console.error("Error fetching dispatch trips:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getDispatchTripById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dispatchTrip = await prisma.dispatchTrip.findUnique({
      where: { id },
      include: includeRelations,
    });

    if (!dispatchTrip) {
      return res.status(404).json({ message: "Dispatch trip not found" });
    }

    res.json({ dispatchTrip });
  } catch (error) {
    console.error("Error fetching dispatch trip:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateDispatchTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tripNumber, tripDate, distributorId, orderId, vehicleId, vehiclePosition, driverId, remarks } =
      req.body;

    const existing = await prisma.dispatchTrip.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Dispatch trip not found" });
    }

    const dispatchTrip = await prisma.dispatchTrip.update({
      where: { id },
      data: {
        ...(tripNumber !== undefined && { tripNumber }),
        ...(tripDate !== undefined && { tripDate }),
        ...(distributorId !== undefined && { distributorId: distributorId || null }),
        ...(orderId !== undefined && { orderId: orderId || null }),
        ...(vehicleId !== undefined && { vehicleId: vehicleId || null }),
        ...(vehiclePosition !== undefined && { vehiclePosition }),
        ...(driverId !== undefined && { driverId: driverId || null }),
        ...(remarks !== undefined && { remarks: remarks || null }),
      },
      include: includeRelations,
    });

    res.json({ dispatchTrip });
  } catch (error) {
    console.error("Error updating dispatch trip:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const pendingDistributorInclude = {
  Distributor: {
    select: {
      id: true,
      name: true,
      email: true,
      userType: true,
      CustomerDetail: {
        select: { dbName: true },
        take: 1,
      },
    },
  },
};

export const getPendingDistributors = async (_req: Request, res: Response) => {
  try {
    const pendingDistributors = await prisma.dispatchPendingDistributor.findMany({
      orderBy: { sortOrder: "asc" },
      include: pendingDistributorInclude,
    });

    res.json({ pendingDistributors });
  } catch (error) {
    console.error("Error fetching pending distributors:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createPendingDistributor = async (req: Request, res: Response) => {
  try {
    const { distributorId, remarks } = req.body as {
      distributorId: string;
      remarks?: string | null;
    };

    const distributor = await prisma.user.findUnique({
      where: { id: distributorId },
      select: { id: true, userType: true },
    });

    if (!distributor || distributor.userType !== "CUSTOMER") {
      return res.status(404).json({ message: "Distributor not found" });
    }

    const last = await prisma.dispatchPendingDistributor.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const pendingDistributor = await prisma.dispatchPendingDistributor.create({
      data: {
        distributorId,
        remarks: remarks?.trim() ? remarks.trim() : null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      include: pendingDistributorInclude,
    });

    res.status(201).json({ pendingDistributor });
  } catch (error) {
    console.error("Error adding pending distributor:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePendingDistributor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body as { remarks?: string | null };

    const existing = await prisma.dispatchPendingDistributor.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Pending distributor not found" });
    }

    const pendingDistributor = await prisma.dispatchPendingDistributor.update({
      where: { id },
      data: {
        remarks: remarks?.trim() ? remarks.trim() : null,
      },
      include: pendingDistributorInclude,
    });

    res.json({ pendingDistributor });
  } catch (error) {
    console.error("Error updating pending distributor:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePendingDistributor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.dispatchPendingDistributor.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Pending distributor not found" });
    }

    await prisma.dispatchPendingDistributor.delete({
      where: { id },
    });

    res.json({ message: "Pending distributor removed" });
  } catch (error) {
    console.error("Error removing pending distributor:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteDispatchTrip = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.dispatchTrip.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Dispatch trip not found" });
    }

    await prisma.dispatchTrip.delete({
      where: { id },
    });

    res.json({ message: "Dispatch trip deleted successfully" });
  } catch (error) {
    console.error("Error deleting dispatch trip:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
