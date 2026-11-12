import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { nowInIndia } from "../../lib/indiaTime";
import { getCreatedByForStockRecord } from "../../lib/getCreatedByForStockRecord";
import { buildStockRecordChangeFields } from "../../lib/stockRecordChangeMeta";
import {
  CreatePurchaseData,
  CreatePurchaseInvoiceData,
  CreatePurchaseInvoiceItemData,
  PurchaseTransportStatus,
} from "./purchase.type";
import type {
  UpdatePurchaseManualDatetimesInput,
  UpdatePurchaseGrnInput,
} from "./purchase.schema";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  attachPricingComplete,
  isPurchasePricingComplete,
} from "./purchasePricing";
import { buildPurchaseItemPriceSnapshot, computePurchaseInvoiceAmountFromItems } from "../../lib/purchaseItemPriceSnapshot";

const purchaseItemPriceProductSelect = {
  id: true,
  name: true,
  productCode: true,
  lifeOfProduct: true,
  cartonsPerPallet: true,
  mrp: true,
  gstPercentage: true,
  packetsPerCarton: true,
  costPricePerPacket: true,
  costPricePerCarton: true,
} as const;

const includeRelations = {
  Transporter: true,
  PurchaseInvoice: {
    include: {
      PurchaseInvoiceItem: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
              gstPercentage: true,
              packetsPerCarton: true,
              costPricePerPacket: true,
              costPricePerCarton: true,
            },
          },
        },
      },
    },
  },
  stockBatches: {
    include: {
      product: { select: { id: true, name: true, productCode: true } },
    },
  },
  purchaseStockBatches: {
    include: {
      product: { select: { id: true, name: true, productCode: true } },
    },
  },
  StockAddedByUser: { select: { id: true, name: true, email: true } },
};

/** Active listing: line snapshot fields are enough for pricingComplete. */
const includeActiveWithPricingCheck = includeRelations;

const includeForPricingSync = {
  PurchaseInvoice: {
    include: {
      PurchaseInvoiceItem: {
        include: {
          product: {
            select: {
              id: true,
              mrp: true,
              gstPercentage: true,
              packetsPerCarton: true,
              costPricePerPacket: true,
              costPricePerCarton: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PurchaseInclude;

const WAREHOUSE_MANAGER_STATUSES = [
  // "IN_TRANSIT",
  "ARRIVED",
  "UNLOADING",
  "UNLOADED",
  // "EXITED",
] as const;

/** Richer product shape for purchase detail billing UI only (not used on list/history). */
const includePurchaseDetail = {
  Transporter: true,
  PurchaseInvoice: {
    include: {
      PurchaseInvoiceItem: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
              Category: { select: { position: true, name: true } },
            },
          },
        },
      },
    },
  },
  stockBatches: {
    include: {
      product: { select: { id: true, name: true, productCode: true } },
    },
  },
  purchaseStockBatches: {
    include: {
      product: { select: { id: true, name: true, productCode: true } },
    },
  },
} satisfies Prisma.PurchaseInclude;

type ProductSnapshot = {
  id: string;
  name: string;
  productCode: string;
  lifeOfProduct: number | null;
  cartonsPerPallet: number | null;
  mrp: number;
  gstPercentage: number | null;
  packetsPerCarton: number | null;
  costPricePerPacket: number | null;
  costPricePerCarton: number | null;
};

function invoiceAmountFromCatalog(
  items: CreatePurchaseInvoiceItemData[],
  productsById: Map<string, ProductSnapshot>
): number {
  const pricedItems = items.map((item) => {
    const product = productsById.get(item.productId)!;
    return {
      quantity: Number(item.quantity) || 0,
      ...buildPurchaseItemPriceSnapshot(product),
    };
  });
  return computePurchaseInvoiceAmountFromItems(pricedItems);
}

const createPurchaseWithTx = async (
  tx: Prisma.TransactionClient,
  payload: CreatePurchaseData,
  createdBy: string
) => {
  const {
    transporterId,
    vehicleNumber,
    driverContact,
    purchaseTransportStatus,
    markedArrivedAt,
    invoices,
  } = payload;
  const productIds = invoices.flatMap((invoice: CreatePurchaseInvoiceData) =>
    invoice.items.map((item: CreatePurchaseInvoiceItemData) => item.productId)
  ) as string[];

  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: purchaseItemPriceProductSelect,
  });
  const productsById = new Map<string, ProductSnapshot>(
    products.map((product) => [product.id, product])
  );

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
    }
  }

  const newPurchase = await tx.purchase.create({
    data: {
      transporterId,
      vehicleNumber: vehicleNumber ?? null,
      driverContact: driverContact ?? null,
      purchaseTransportStatus: purchaseTransportStatus ?? "PENDING",
      createdByUserId: createdBy,
      ...(markedArrivedAt != null
        ? {
            markedArrivedAt,
            markedArrivedByUserId: createdBy,
          }
        : {}),
    },
  });

  for (const invoice of invoices) {
    const newInvoice = await tx.purchaseInvoice.create({
      data: {
        invoiceID: invoice.invoiceID,
        invoiceDate: invoice.invoiceDate ?? null,
        invoiceAmount: invoiceAmountFromCatalog(invoice.items, productsById),
        purchaseId: newPurchase.id,
      },
    });

    const invoiceItems = [];
    const purchaseStockBatches = [];

    for (const item of invoice.items) {
      const product = productsById.get(item.productId)!;
      const quantity = Number(item.quantity) || 0;
      const cpp = product.cartonsPerPallet;
      const palletQuantity = cpp && cpp >= 1 ? Math.max(1, Math.ceil(quantity / cpp)) : 1;

      const priceSnapshot = buildPurchaseItemPriceSnapshot(product);

      invoiceItems.push({
        purchaseInvoiceId: newInvoice.id,
        productId: item.productId,
        palletQuantity,
        quantity,
        mrp: priceSnapshot.mrp,
        gstPercentage: priceSnapshot.gstPercentage,
        packetsPerCarton: priceSnapshot.packetsPerCarton,
        costPricePerPacket: priceSnapshot.costPricePerPacket,
        costPricePerCarton: priceSnapshot.costPricePerCarton,
      });

      const now = nowInIndia();
      const lifeMonths = product.lifeOfProduct || 6;
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + lifeMonths);

      purchaseStockBatches.push({
        productId: item.productId,
        manufacturingDate: now,
        arrivalDate: now,
        expiryDate,
        stockQuantity: quantity,
        purchaseId: newPurchase.id,
        purchaseTransportStatus: purchaseTransportStatus ?? "PENDING",
      });
    }

    await tx.purchaseStockBatch.createMany({
      data: purchaseStockBatches,
    });
    await tx.purchaseInvoiceItem.createMany({
      data: invoiceItems,
    });
  }

  return tx.purchase.findUnique({
    where: { id: newPurchase.id },
    include: includeRelations,
  });
};

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const payload = req.body as CreatePurchaseData;
    const createdBy = await getCreatedByForStockRecord(req);
    const purchase = await prisma.$transaction(async (tx) => {
      return createPurchaseWithTx(tx, payload, createdBy);
    }, {
      timeout: 30_000,
    });

    res.status(201).json({ purchase });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Product not found:")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error creating purchase:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createPurchasesBulk = async (req: Request, res: Response) => {
  try {
    const { purchases } = req.body as { purchases: CreatePurchaseData[] };
    const createdBy = await getCreatedByForStockRecord(req);

    const createdPurchases = await prisma.$transaction(async (tx) => {
      const created = [];
      for (let idx = 0; idx < purchases.length; idx += 1) {
        const payload = purchases[idx];
        try {
          const purchase = await createPurchaseWithTx(tx, payload, createdBy);
          created.push(purchase);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Product not found:")) {
            throw new Error(`Purchase #${idx + 1}: ${error.message}`);
          }
          throw error;
        }
      }
      return created;
    }, {
      timeout: 60_000,
    });

    res.status(201).json({
      purchases: createdPurchases,
      count: createdPurchases.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Product not found:")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error creating purchases in bulk:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPurchases = async (req: Request, res: Response) => {
  try {
    const { status, startDate, endDate, transporterId, page, limit } = req.query;

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.purchaseTransportStatus = status;
    }

    if (transporterId && typeof transporterId === "string") {
      where.transporterId = transporterId;
    }

    const hasDateFilter = Boolean(
      (startDate && typeof startDate === "string") || (endDate && typeof endDate === "string")
    );
    if (hasDateFilter) {
      const invoiceDate: { gte?: Date; lte?: Date } = {};
      if (startDate && typeof startDate === "string") {
        invoiceDate.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate && typeof endDate === "string") {
        invoiceDate.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
      if (Object.keys(invoiceDate).length > 0) {
        where.PurchaseInvoice = {
          some: {
            invoiceDate,
          },
        };
      }
    }

    const orderBy = hasDateFilter ? { purchaseDate: "desc" as const } : { createdAt: "desc" as const };

    if (hasDateFilter) {
      const pageNum = Math.max(1, Number(page) || 1);
      const rawLimit = Number(limit) || 1000;
      const limitNum = Math.min(Math.max(1, rawLimit), 5000);
      const skip = (pageNum - 1) * limitNum;

      const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
          where,
          include: includeRelations,
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.purchase.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum) || 1;

      res.json({
        purchases,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
        },
      });
      return;
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: includeRelations,
      orderBy,
    });

    res.json({ purchases });
  } catch (error) {
    console.error("Error fetching purchases:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getActivePurchases = async (req: Request, res: Response) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseTransportStatus: { not: "COMPLETED" },
      },
      include: includeActiveWithPricingCheck,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      purchases: purchases.map((purchase) => attachPricingComplete(purchase)),
    });
  } catch (error) {
    console.error("Error fetching active purchases:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getWarehouseManagerPurchases = async (req: Request, res: Response) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: {
        purchaseTransportStatus: { in: [...WAREHOUSE_MANAGER_STATUSES] },
      },
      include: includeRelations,
      orderBy: { purchaseDate: "desc" },
    });

    res.json({ purchases });
  } catch (error) {
    console.error("Error fetching warehouse manager purchases:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: includePurchaseDetail,
    });

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.json({ purchase: attachPricingComplete(purchase) });
  } catch (error) {
    console.error("Error fetching purchase:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const syncPurchasePricing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.purchase.findUnique({
      where: { id },
      select: { id: true, purchaseTransportStatus: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.purchaseTransportStatus === "COMPLETED") {
      return res.status(400).json({
        message: "Completed purchase pricing cannot be modified",
      });
    }

    const purchaseWithItems = await prisma.purchase.findUnique({
      where: { id },
      include: includeForPricingSync,
    });
    if (!purchaseWithItems) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    let updatedItemCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const invoice of purchaseWithItems.PurchaseInvoice) {
        const pricedItems: Array<{
          quantity: number;
          mrp?: number | null;
          gstPercentage?: number | null;
          packetsPerCarton?: number | null;
          costPricePerPacket?: number | null;
          costPricePerCarton?: number | null;
        }> = [];

        for (const item of invoice.PurchaseInvoiceItem) {
          const product = item.product;
          const packetRate = product.costPricePerPacket ?? 0;

          if (packetRate > 0) {
            const priceSnapshot = buildPurchaseItemPriceSnapshot(product);

            await tx.purchaseInvoiceItem.update({
              where: { id: item.id },
              data: {
                mrp: priceSnapshot.mrp,
                gstPercentage: priceSnapshot.gstPercentage,
                packetsPerCarton: priceSnapshot.packetsPerCarton,
                costPricePerPacket: priceSnapshot.costPricePerPacket,
                costPricePerCarton: priceSnapshot.costPricePerCarton,
              },
            });
            updatedItemCount += 1;

            pricedItems.push({
              quantity: item.quantity,
              ...priceSnapshot,
            });
          } else {
            pricedItems.push({
              quantity: item.quantity,
              mrp: item.mrp,
              gstPercentage: item.gstPercentage,
              packetsPerCarton: item.packetsPerCarton,
              costPricePerPacket: item.costPricePerPacket,
              costPricePerCarton: item.costPricePerCarton,
            });
          }
        }

        const invoiceAmount = computePurchaseInvoiceAmountFromItems(pricedItems);
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: { invoiceAmount },
        });
      }
    });

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: includePurchaseDetail,
    });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    const enriched = attachPricingComplete(purchase);
    const message =
      updatedItemCount === 0
        ? "No product pricing available to apply. Update product master data first."
        : enriched.pricingComplete
          ? `Pricing applied to ${updatedItemCount} item(s). All line pricing is now complete.`
          : `Pricing applied to ${updatedItemCount} item(s). Some products still lack complete pricing.`;

    res.json({
      purchase: enriched,
      updatedItemCount,
      message,
    });
  } catch (error) {
    console.error("Error syncing purchase pricing:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePurchase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      transporterId,
      vehicleNumber,
      driverContact,
      purchaseTransportStatus,
      markedArrivedAt,
      invoices,
    } = req.body;

    const existing = await prisma.purchase.findUnique({
      where: { id },
      include: { stockBatches: { select: { id: true } } },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.stockBatches.length > 0) {
      return res.status(400).json({
        message: "Cannot edit purchase after items were added to stock",
      });
    }
    if (existing.purchaseTransportStatus === "COMPLETED") {
      return res.status(400).json({ message: "Completed purchase cannot be modified" });
    }
    if (purchaseTransportStatus === "COMPLETED") {
      return res.status(400).json({
        message: "Use purchase status update endpoint to mark purchase as completed",
      });
    }

    const productIds = invoices.flatMap((invoice: CreatePurchaseInvoiceData) =>
      invoice.items.map((item: CreatePurchaseInvoiceItemData) => item.productId),
    ) as string[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: purchaseItemPriceProductSelect,
    });
    const productsById = new Map(products.map((product) => [product.id, product]));

    for (const invoice of invoices) {
      for (const item of invoice.items) {
        const product = productsById.get(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
      }
    }

    const actorId = await getCreatedByForStockRecord(req);

    const purchase = await prisma.$transaction(async (tx) => {
      await tx.purchaseStockBatch.deleteMany({ where: { purchaseId: id } });

      // If stock is already moved to live batches for this purchase, clear those
      // records so regenerated invoice items remain the source of truth.
      // const stockBatches = await tx.stockBatch.findMany({
      //   where: { purchaseId: id },
      //   select: { id: true },
      // });
      // const stockBatchIds = stockBatches.map((batch) => batch.id);
      // if (stockBatchIds.length > 0) {
      //   await tx.stockRecord.deleteMany({ where: { stockBatchId: { in: stockBatchIds } } });
      //   await tx.stockBatch.deleteMany({ where: { id: { in: stockBatchIds } } });
      // }

      const oldInvoices = await tx.purchaseInvoice.findMany({
        where: { purchaseId: id },
        select: { id: true },
      });
      const oldInvoiceIds = oldInvoices.map((inv) => inv.id);
      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: { in: oldInvoiceIds } },
      });
      await tx.purchaseInvoice.deleteMany({ where: { purchaseId: id } });

      await tx.purchase.update({
        where: { id },
        data: {
          transporterId,
          vehicleNumber: vehicleNumber ?? null,
          driverContact: driverContact ?? null,
          purchaseTransportStatus: purchaseTransportStatus ?? "PENDING",
          ...(markedArrivedAt !== undefined
            ? {
                markedArrivedAt,
                markedArrivedByUserId: markedArrivedAt === null ? null : actorId,
              }
            : {}),
        },
      });

      for (const invoice of invoices) {
        const newInvoice = await tx.purchaseInvoice.create({
          data: {
            invoiceID: invoice.invoiceID,
            invoiceDate: invoice.invoiceDate ?? null,
            invoiceAmount: invoiceAmountFromCatalog(invoice.items, productsById),
            purchaseId: id,
          },
        });

        for (const item of invoice.items) {
          const product = productsById.get(item.productId)!;
          const quantity = Number(item.quantity) || 0;
          const cpp = product.cartonsPerPallet;
          const palletQuantity =
            cpp && cpp >= 1 ? Math.max(1, Math.ceil(quantity / cpp)) : 1;

          const priceSnapshot = buildPurchaseItemPriceSnapshot(product);

          await tx.purchaseInvoiceItem.create({
            data: {
              purchaseInvoiceId: newInvoice.id,
              productId: item.productId,
              palletQuantity,
              quantity,
              mrp: priceSnapshot.mrp,
              gstPercentage: priceSnapshot.gstPercentage,
              packetsPerCarton: priceSnapshot.packetsPerCarton,
              costPricePerPacket: priceSnapshot.costPricePerPacket,
              costPricePerCarton: priceSnapshot.costPricePerCarton,
            },
          });

          const now = nowInIndia();
          const lifeMonths = product?.lifeOfProduct ?? 6;
          const expiryDate = new Date(now);
          expiryDate.setMonth(expiryDate.getMonth() + lifeMonths);

          const qty = quantity;
          await tx.purchaseStockBatch.create({
            data: {
              productId: item.productId,
              manufacturingDate: now,
              arrivalDate: now,
              expiryDate,
              stockQuantity: qty,
              purchaseId: id,
              purchaseTransportStatus: purchaseTransportStatus ?? "PENDING",
            },
          });
        }
      }

      return tx.purchase.findUnique({
        where: { id },
        include: includeRelations,
      });
    }, {
      timeout: 30_000,
    });

    res.json({ purchase });
  } catch (error) {
    console.error("Error updating purchase:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

function buildPurchaseManualDatetimeUncheckedUpdate(
  patch: UpdatePurchaseManualDatetimesInput,
  actorId: string
): Prisma.PurchaseUncheckedUpdateInput {
  const data: Prisma.PurchaseUncheckedUpdateInput = {};
  if (patch.purchaseDate !== undefined) {
    data.purchaseDate = patch.purchaseDate;
  }
  if (patch.markedArrivedAt !== undefined) {
    data.markedArrivedAt = patch.markedArrivedAt;
    data.markedArrivedByUserId = patch.markedArrivedAt === null ? null : actorId;
  }
  if (patch.TargetUnloadingDate !== undefined) {
    data.TargetUnloadingDate = patch.TargetUnloadingDate;
    data.TargetUnloadingByUserId = patch.TargetUnloadingDate ? actorId : null;
  }
  if (patch.markedUnloadedAt !== undefined) {
    data.markedUnloadedAt = patch.markedUnloadedAt;
    data.markedUnloadedByUserId = patch.markedUnloadedAt === null ? null : actorId;
  }
  if (patch.VehicleExitedAt !== undefined) {
    data.VehicleExitedAt = patch.VehicleExitedAt;
  }
  return data;
}

async function persistPurchaseManualDatetimes(
  id: string,
  patch: UpdatePurchaseManualDatetimesInput,
  actorId: string
) {
  const existing = await prisma.purchase.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, status: 404, message: "Purchase not found" };
  }
  if (existing.purchaseTransportStatus === "COMPLETED") {
    return {
      ok: false as const,
      status: 400,
      message: "Completed purchase cannot be modified",
    };
  }
  const data = buildPurchaseManualDatetimeUncheckedUpdate(patch, actorId);
  const purchase = await prisma.purchase.update({
    where: { id },
    data,
    include: includeRelations,
  });
  return { ok: true as const, purchase };
}

export async function transferPurchaseStockToInventory(
  tx: Prisma.TransactionClient,
  args: {
    purchaseId: string;
    actorId: string;
    now: Date;
    purchaseTransportStatus: PurchaseTransportStatus;
  }
): Promise<{ transferred: boolean; alreadyExisted: boolean }> {
  const { purchaseId, actorId, now, purchaseTransportStatus } = args;

  const existingCount = await tx.stockBatch.count({ where: { purchaseId } });
  if (existingCount > 0) {
    return { transferred: false, alreadyExisted: true };
  }

  const plannedBatches = await tx.purchaseStockBatch.findMany({
    where: { purchaseId },
  });

  if (plannedBatches.length === 0) {
    return { transferred: false, alreadyExisted: false };
  }

  const invoices = await tx.purchaseInvoice.findMany({
    where: { purchaseId },
    include: {
      PurchaseInvoiceItem: {
        select: { productId: true, purchaseInvoiceId: true },
      },
    },
  });
  const invoiceIdByProductId = new Map<string, string>();
  for (const invoice of invoices) {
    for (const item of invoice.PurchaseInvoiceItem) {
      if (!invoiceIdByProductId.has(item.productId)) {
        invoiceIdByProductId.set(item.productId, invoice.id);
      }
    }
  }

  for (const plannedBatch of plannedBatches) {
    const qty = Number(plannedBatch.stockQuantity) || 0;
    const newBatch = await tx.stockBatch.create({
      data: {
        productId: plannedBatch.productId,
        manufacturingDate: plannedBatch.manufacturingDate,
        arrivalDate: now,
        expiryDate: plannedBatch.expiryDate,
        stockQuantity: qty,
        purchaseId,
        purchaseInvoiceId: invoiceIdByProductId.get(plannedBatch.productId) ?? null,
        purchaseTransportStatus,
      },
    });

    if (qty > 0) {
      const changeMeta = buildStockRecordChangeFields({
        changeInStock: qty,
        changeDate: now,
      });
      await tx.stockRecord.create({
        data: {
          productId: plannedBatch.productId,
          stockBatchId: newBatch.id,
          changeInStock: qty,
          reason: "ARRIVAL_FROM_SUPPLIER",
          createdBy: actorId,
          ...changeMeta,
        },
      });
    }
  }

  await tx.purchase.update({
    where: { id: purchaseId },
    data: {
      stockAddedAt: now,
      StockAddedByUser: { connect: { id: actorId } },
    },
  });

  return { transferred: true, alreadyExisted: false };
}

export async function applyPurchaseTransportStatusUpdate(
  tx: Prisma.TransactionClient,
  args: {
    id: string;
    purchaseTransportStatus: PurchaseTransportStatus;
    actorId: string;
    now?: Date;
  }
) {
  const { id, purchaseTransportStatus, actorId } = args;
  const now = args.now ?? new Date();
  const data: Prisma.PurchaseUpdateInput = { purchaseTransportStatus };

  switch (purchaseTransportStatus) {
    case "PENDING":
    case "LOADING":
    case "LOADED":
    case "IN_TRANSIT":
      break;
    case "ARRIVED":
      data.MarkedArrivedByUser = { connect: { id: actorId } };
      data.markedArrivedAt = now;
      break;
    case "UNLOADING":
      data.MarkedUnloadingByUser = { connect: { id: actorId } };
      data.markedUnloadingAt = now;
      break;
    case "UNLOADED":
      data.MarkedUnloadedByUser = { connect: { id: actorId } };
      data.markedUnloadedAt = now;
      break;
    case "EXITED":
      data.VehicleExitedAt = now;
      break;
    case "COMPLETED":
      data.MarkedCompletedByUser = { connect: { id: actorId } };
      data.markedCompletedAt = now;
      break;
  }

  const updated = await tx.purchase.update({
    where: { id },
    data,
    include: includeRelations,
  });

  if (purchaseTransportStatus === "COMPLETED") {
    await transferPurchaseStockToInventory(tx, {
      purchaseId: id,
      actorId,
      now,
      purchaseTransportStatus,
    });
  }

  await tx.stockBatch.updateMany({
    where: { purchaseId: id },
    data: { purchaseTransportStatus },
  });
  await tx.purchaseStockBatch.updateMany({
    where: { purchaseId: id },
    data: { purchaseTransportStatus },
  });

  return (
    (await tx.purchase.findUnique({ where: { id }, include: includeRelations })) ??
    updated
  );
}

export const updatePurchaseStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { purchaseTransportStatus } = req.body;

    const existing = await prisma.purchase.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.purchaseTransportStatus === "COMPLETED") {
      return res.status(400).json({ message: "Completed purchase status cannot be modified" });
    }

    if (purchaseTransportStatus === "COMPLETED") {
      const purchaseForPricing = await prisma.purchase.findUnique({
        where: { id },
        include: includeForPricingSync,
      });
      if (
        !purchaseForPricing ||
        !isPurchasePricingComplete(purchaseForPricing.PurchaseInvoice)
      ) {
        return res.status(400).json({
          message:
            "Cannot complete purchase: pricing is incomplete for one or more products",
        });
      }
    }

    const actorId = await getCreatedByForStockRecord(req);
    const purchase = await prisma.$transaction(async (tx) => {
      return applyPurchaseTransportStatusUpdate(tx, {
        id,
        purchaseTransportStatus,
        actorId,
      });
    }, {
      timeout: 30_000,
    });

    res.json({
      purchase: {
        ...purchase,
        pricingComplete: purchaseTransportStatus === "COMPLETED",
      },
    });
  } catch (error) {
    console.error("Error updating purchase status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePurchaseManualDatetimes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patch = req.body as UpdatePurchaseManualDatetimesInput;
    const actorId = await getCreatedByForStockRecord(req);
    const result = await persistPurchaseManualDatetimes(id, patch, actorId);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    res.json({ purchase: result.purchase });
  } catch (error) {
    console.error("Error updating purchase manual datetimes:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const ADMIN_USER_TYPES = ["ADMIN", "SUPER_ADMIN", "MIS"] as const;
const GRN_CREATE_USER_TYPES = ["ADMIN", "SUPER_ADMIN", "MIS", "WAREHOUSE_MANAGER", "GUARD"] as const;

function hasNonEmptyGrn(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export const updatePurchaseGrn = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { grnNumber } = req.body as UpdatePurchaseGrnInput;
    const user = req.user as { userType?: string } | undefined;

    if (!user?.userType) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const isAdmin = ADMIN_USER_TYPES.includes(
      user.userType as (typeof ADMIN_USER_TYPES)[number]
    );
    const canCreateGrn = GRN_CREATE_USER_TYPES.includes(
      user.userType as (typeof GRN_CREATE_USER_TYPES)[number]
    );

    if (!isAdmin && !canCreateGrn) {
      return res.status(403).json({ message: "Access denied" });
    }

    const existing = await prisma.purchase.findUnique({
      where: { id },
      select: { id: true, purchaseTransportStatus: true, grnNumber: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.purchaseTransportStatus === "COMPLETED") {
      return res.status(400).json({ message: "Completed purchase cannot be modified" });
    }

    const hasExistingGrn = hasNonEmptyGrn(existing.grnNumber);

    if (!isAdmin) {
      if (grnNumber === null) {
        return res.status(403).json({ message: "Only admins can clear GRN number" });
      }
      if (!grnNumber) {
        return res.status(400).json({ message: "GRN number is required" });
      }
      if (hasExistingGrn) {
        if (existing.grnNumber?.trim() !== grnNumber) {
          return res.status(403).json({ message: "GRN number can only be set once" });
        }
        return res.json({
          purchase: await prisma.purchase.findUnique({
            where: { id },
            include: includeRelations,
          }),
        });
      }
    }

    const purchase = await prisma.purchase.update({
      where: { id },
      data: { grnNumber: grnNumber === null ? null : grnNumber.trim() },
      include: includeRelations,
    });

    res.json({ purchase });
  } catch (error) {
    console.error("Error updating purchase GRN:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addPurchaseToStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.purchase.findUnique({
      where: { id },
      include: { stockBatches: { select: { id: true } }, purchaseStockBatches: { select: { id: true } } },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.stockBatches.length > 0) {
      return res.status(409).json({ message: "Purchase stock has already been added" });
    }
    if (existing.purchaseStockBatches.length === 0) {
      return res.status(400).json({ message: "No purchase stock batches to transfer" });
    }

    const actorId = await getCreatedByForStockRecord(req);
    const purchase = await prisma.$transaction(async (tx) => {
      const result = await transferPurchaseStockToInventory(tx, {
        purchaseId: id,
        actorId,
        now: new Date(),
        purchaseTransportStatus: existing.purchaseTransportStatus,
      });
      if (result.alreadyExisted) {
        throw new Error("ALREADY_ADDED");
      }
      if (!result.transferred) {
        throw new Error("NOTHING_TO_TRANSFER");
      }
      await tx.stockBatch.updateMany({
        where: { purchaseId: id },
        data: { purchaseTransportStatus: existing.purchaseTransportStatus },
      });
      await tx.purchaseStockBatch.updateMany({
        where: { purchaseId: id },
        data: { purchaseTransportStatus: existing.purchaseTransportStatus },
      });
      return tx.purchase.findUnique({
        where: { id },
        include: includeRelations,
      });
    }, {
      timeout: 30_000,
    });

    res.json({ purchase });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_ADDED") {
      return res.status(409).json({ message: "Purchase stock has already been added" });
    }
    if (error instanceof Error && error.message === "NOTHING_TO_TRANSFER") {
      return res.status(400).json({ message: "No purchase stock batches to transfer" });
    }
    console.error("Error adding purchase to stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updatePurchaseTargetUnloading = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { TargetUnloadingDate } = req.body as { TargetUnloadingDate: Date | null };
    const actorId = await getCreatedByForStockRecord(req);
    const result = await persistPurchaseManualDatetimes(id, { TargetUnloadingDate }, actorId);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    res.json({ purchase: result.purchase });
  } catch (error) {
    console.error("Error updating target unloading datetime:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deletePurchase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.purchase.findUnique({
      where: { id },
      include: { stockBatches: { select: { id: true } } },
    });
    if (!existing) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    if (existing.stockBatches.length > 0) {
      return res.status(400).json({
        message: "Cannot delete purchase after items were added to stock",
      });
    }

    await prisma.$transaction(async (tx) => {

      // const stockBatches = await tx.stockBatch.findMany({ where: { purchaseId: id }, select: { id: true } });
      // const stockBatchIds = stockBatches.map((batch) => batch.id);
      // await tx.stockRecord.deleteMany({ where: { stockBatchId: { in: stockBatchIds } } });
      // await tx.stockBatch.deleteMany({ where: { id: { in: stockBatchIds } } });

      // //delete all purchase stock batches
      await tx.purchaseStockBatch.deleteMany({ where: { purchaseId: id } });

      const invoices = await tx.purchaseInvoice.findMany({
        where: { purchaseId: id },
        select: { id: true },
      });
      const invoiceIds = invoices.map((inv) => inv.id);

      await tx.purchaseInvoiceItem.deleteMany({
        where: { purchaseInvoiceId: { in: invoiceIds } },
      });

      await tx.purchaseInvoice.deleteMany({ where: { purchaseId: id } });

      await tx.purchase.delete({ where: { id } });
    });

    res.json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("Error deleting purchase:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
