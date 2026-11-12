import { Response } from "express";
import { prisma } from "../lib/prisma";
import { getCreatedByForStockRecord } from "../lib/getCreatedByForStockRecord";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { applyPurchaseTransportStatusUpdate } from "../module/purchase/purchase.controller";
import { PurchaseTransportStatus } from "../module/purchase/purchase.type";

const GUARD_VISIBLE_PURCHASE_STATUSES: PurchaseTransportStatus[] = [
  "IN_TRANSIT",
  "LOADED",
  "UNLOADED",
];

const GUARD_ALLOWED_STATUS_TRANSITIONS: Record<
  PurchaseTransportStatus,
  PurchaseTransportStatus[]
> = {
  PENDING: [],
  LOADING: [],
  LOADED: ["EXITED"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED: [],
  UNLOADING: [],
  UNLOADED: ["EXITED"],
  EXITED: [],
  COMPLETED: [],
};

export const getGuardPurchases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseTransportStatus: { in: GUARD_VISIBLE_PURCHASE_STATUSES },
      },
      select: {
        id: true,
        vehicleNumber: true,
        driverContact: true,
        purchaseTransportStatus: true,
        PurchaseInvoice: {
          select: {
            PurchaseInvoiceItem: {
              select: { quantity: true },
            },
          },
        },
      },
      orderBy: { purchaseDate: "desc" },
    });

    const rows = purchases.map((purchase) => ({
      id: purchase.id,
      vehicleNumber: purchase.vehicleNumber,
      driverName: purchase.driverContact,
      status: purchase.purchaseTransportStatus,
      totalQuantity: purchase.PurchaseInvoice.reduce(
        (invoiceSum, invoice) =>
          invoiceSum +
          invoice.PurchaseInvoiceItem.reduce(
            (itemSum, item) => itemSum + (Number(item.quantity) || 0),
            0
          ),
        0
      ),
    }));

    res.json({ purchases: rows });
  } catch (error) {
    console.error("Error fetching guard purchases:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateGuardPurchaseStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { purchaseTransportStatus } = req.body as {
      purchaseTransportStatus: PurchaseTransportStatus;
    };

    const existing = await prisma.purchase.findUnique({
      where: { id },
      select: { id: true, purchaseTransportStatus: true, grnNumber: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const allowedNext = GUARD_ALLOWED_STATUS_TRANSITIONS[existing.purchaseTransportStatus] ?? [];
    if (!allowedNext.includes(purchaseTransportStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${existing.purchaseTransportStatus} to ${purchaseTransportStatus}`,
      });
    }

    const body = req.body as {
      purchaseTransportStatus: PurchaseTransportStatus;
      markedArrivedAt?: Date;
      grnNumber?: string;
    };

    if (purchaseTransportStatus === "ARRIVED") {
      if (existing.grnNumber?.trim()) {
        return res.status(409).json({ message: "GRN number is already set for this purchase" });
      }
      if (!body.markedArrivedAt || !body.grnNumber?.trim()) {
        return res.status(400).json({
          message: "markedArrivedAt and grnNumber are required when marking as arrived",
        });
      }
    }

    const actorId = await getCreatedByForStockRecord(req);
    const purchase = await prisma.$transaction(async (tx) => {
      const updated = await applyPurchaseTransportStatusUpdate(tx, {
        id,
        purchaseTransportStatus,
        actorId,
        ...(purchaseTransportStatus === "ARRIVED" && body.markedArrivedAt
          ? { now: body.markedArrivedAt }
          : {}),
      });

      if (purchaseTransportStatus === "ARRIVED" && body.grnNumber) {
        await tx.purchase.update({
          where: { id },
          data: { grnNumber: body.grnNumber.trim() },
        });
      }

      return updated;
    });

    res.json({
      purchase: {
        id: purchase.id,
        vehicleNumber: purchase.vehicleNumber,
        driverName: purchase.driverContact,
        status: purchase.purchaseTransportStatus,
      },
    });
  } catch (error) {
    console.error("Error updating guard purchase status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getGuardOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusRows = await prisma.orderStatusType.findMany({
      where: { name: { in: ["LOADED", "VEHICLE_COMING_BACK"] } },
      select: { id: true, name: true },
    });
    const statusIds = statusRows.map((row) => row.id);
    if (statusIds.length === 0) {
      return res.json({ orders: [] });
    }

    const orders = await prisma.order.findMany({
      where: { orderStatusTypeId: { in: statusIds } },
      select: {
        id: true,
        customeOrderId: true,
        driverId: true,
        OrderStatusType: {
          select: { name: true, displayName: true },
        },
        customerId: true,
        Customer: {
          select: {
            name: true,
            CustomerDetail: { select: { dbName: true } },
          },
        },
        Vehicle: {
          select: { vehicleNumber: true },
        },
        OrderItem: {
          select: { quantity: true },
        },
      },
      orderBy: { orderDate: "desc" },
    });

    const driverIds = Array.from(
      new Set(orders.map((order) => order.driverId).filter((id): id is string => Boolean(id)))
    );
    const drivers =
      driverIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: { id: { in: driverIds }, userType: "DRIVER" },
            select: { id: true, name: true },
          });
    const driverById = new Map(drivers.map((driver) => [driver.id, driver.name]));

    const rows = orders.map((order) => ({
      id: order.id,
      orderNumber: order.customeOrderId,
      vehicleNumber: order.Vehicle?.vehicleNumber ?? null,
      distributorName: order.Customer?.CustomerDetail?.[0]?.dbName ?? order.Customer?.name ?? null,
      driverId: order.driverId ?? null,
      driverName: order.driverId ? driverById.get(order.driverId) ?? null : null,
      customerId: order.customerId,
      status: order.OrderStatusType?.name ?? null,
      statusLabel:
        order.OrderStatusType?.displayName ?? order.OrderStatusType?.name ?? "Unknown",
      totalQuantity: order.OrderItem.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      ),
    }));

    res.json({ orders: rows });
  } catch (error) {
    console.error("Error fetching guard orders:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getGuardDrivers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { userType: "DRIVER" },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    });
    res.json({ drivers });
  } catch (error) {
    console.error("Error fetching guard drivers:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateGuardOrderDriver = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body as { driverId: string };

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true, driverId: true },
    });
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (existingOrder.driverId) {
      return res.status(400).json({ message: "Driver is already assigned for this order" });
    }

    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, userType: true },
    });
    if (!driver || driver.userType !== "DRIVER") {
      return res.status(400).json({ message: "Invalid driver selection" });
    }

    await prisma.order.update({
      where: { id },
      data: { driverId },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error updating guard order driver:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const GUARD_ORDER_ALLOWED_TRANSITIONS = {
  LOADED: "OUT_FOR_DELIVERY",
  VEHICLE_COMING_BACK: "VEHICLE_CAME_BACK",
} as const;

export const updateGuardOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { orderStatusTypeId } = req.body as { orderStatusTypeId: string };

    const [existingOrder, nextStatusType] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          orderStatusTypeId: true,
          OrderStatusType: { select: { name: true } },
        },
      }),
      prisma.orderStatusType.findUnique({
        where: { id: orderStatusTypeId },
        select: { id: true, name: true },
      }),
    ]);

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (!nextStatusType) {
      return res.status(404).json({ message: "Order status type not found" });
    }

    const currentName = existingOrder.OrderStatusType?.name;
    if (!currentName || !(currentName in GUARD_ORDER_ALLOWED_TRANSITIONS)) {
      return res.status(400).json({ message: "Current order status cannot be changed by guard" });
    }

    const expectedNext =
      GUARD_ORDER_ALLOWED_TRANSITIONS[currentName as keyof typeof GUARD_ORDER_ALLOWED_TRANSITIONS];
    if (nextStatusType.name !== expectedNext) {
      return res.status(400).json({
        message: `Invalid guard transition from ${currentName} to ${nextStatusType.name}`,
      });
    }

    await prisma.order.update({
      where: { id },
      data: { orderStatusTypeId: nextStatusType.id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error updating guard order status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
