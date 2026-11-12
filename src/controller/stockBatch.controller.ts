import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { applyStockLedgerDelta } from "../lib/applyStockLedgerDelta";
import { getCreatedByForStockRecord } from "../lib/getCreatedByForStockRecord";
import { buildStockRecordChangeFields, defaultChangeDateIst } from "../lib/stockRecordChangeMeta";

// Order status: "loaded" = completed; reserved = assigned to orders not yet completed (same as order.controller)
const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";

type ReservedOrderSummary = {
  orderId: string;
  orderNo: string;
  dbName: string | null;
  orderDate: Date;
  orderStatusTypeName: string | null;
  reservedQuantity: number;
};

// Create a new stock entry
export const createStockBatch = async (req: Request, res: Response) => {
  try {
    const {
      productId,
      manufacturingDate,
      arrivalDate,
      stockQuantity,
      isArchived,
      purchaseInvoiceId,
    } = req.body;

    const quantity = Number(stockQuantity) || 0;

    // Verify that product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (purchaseInvoiceId) {
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
      });
      if (!invoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
    }

    // Calculate expiry date based on manufacturing date and product's life
    if (!product.lifeOfProduct) {
      return res.status(400).json({
        message: "Product does not have a lifeOfProduct value. Cannot calculate expiry date."
      });
    }

    const manufacturingDateObj = new Date(manufacturingDate);
    const expiryDate = new Date(manufacturingDateObj);
    expiryDate.setMonth(expiryDate.getMonth() + product.lifeOfProduct);

    // Create stock entry
    const stock = await prisma.stockBatch.create({
      data: {
        productId,
        manufacturingDate: manufacturingDateObj,
        arrivalDate: new Date(arrivalDate),
        expiryDate: expiryDate,
        stockQuantity: quantity,
        isArchived: isArchived || false,
        purchaseInvoiceId: purchaseInvoiceId || null,
      },
      include: {
        product: {
          include: {
            Category: true,
          },
        },
        PurchaseInvoice: {
          select: {
            id: true,
            invoiceID: true,
            invoiceDate: true,
          },
        },
      },
    });

    // Record arrival in StockRecord so daily report inward quantity is correct
    if (quantity > 0) {
      const createdBy = await getCreatedByForStockRecord(req);
      const arrival = new Date(arrivalDate);
      const changeMeta = buildStockRecordChangeFields({
        changeInStock: quantity,
        changeDate: arrival,
      });
      await prisma.stockRecord.create({
        data: {
          productId,
          stockBatchId: stock.id,
          changeInStock: quantity,
          reason: "ARRIVAL_FROM_SUPPLIER",
          createdBy,
          ...changeMeta,
        },
      });
    }

    res.status(201).json({ stock });
  } catch (error) {
    console.error("Error creating stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all stock entries with pagination and filtering
export const getStockBatches = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      productId,
      isArchived,
      expired,
      lowStock,
    } = req.query as any;

    // Convert string values to numbers
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { product: { name: { contains: search, mode: "insensitive" } } },
        { product: { productCode: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (isArchived !== undefined) {
      where.isArchived = isArchived;
    }

    if (expired !== undefined) {
      if (expired) {
        where.expiryDate = { lt: new Date() };
      } else {
        where.expiryDate = { gte: new Date() };
      }
    }

    if (lowStock !== undefined) {
      if (lowStock) {
        where.AND = [
          { stockQuantity: { gt: 0 } },
          {
            product: {
              lowStockLimit: { gt: 0 },
            },
          },
        ];
        // This is a simplified check - you might want to implement more sophisticated logic
        where.stockQuantity = { lte: 10 }; // Example threshold
      }
    }

    const [stockBatches, total] = await Promise.all([
      prisma.stockBatch.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          product: {
            include: {
              Category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          StockRecord: {
            orderBy: { createdAt: "desc" },
            // take: 5, // Get last 5 stock records
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockBatch.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      stockBatches,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching stocks:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single stock entry by ID
export const getStockBatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const stockBatch = await prisma.stockBatch.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            Category: true,
          },
        },
        StockRecord: {
          orderBy: { createdAt: "desc" },
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!stockBatch) {
      return res.status(404).json({ message: "Stock not found" });
    }

    res.json({ stockBatch });
  } catch (error) {
    console.error("Error fetching stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Update a stock entry
export const updateStockBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Check if stock exists
    const existingStockBatch = await prisma.stockBatch.findUnique({
      where: { id },
    });

    if (!existingStockBatch) {
      return res.status(404).json({ message: "Stock not found" });
    }

    if (updateData.purchaseInvoiceId) {
      const invoice = await prisma.purchaseInvoice.findUnique({
        where: { id: updateData.purchaseInvoiceId },
      });
      if (!invoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
    }

    // Get product for expiry date calculation (use updated productId or existing one)
    const productIdToUse = updateData.productId || existingStockBatch.productId;
    const product = await prisma.product.findUnique({
      where: { id: productIdToUse },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Recalculate expiry date if manufacturing date is being updated or product is being changed
    if (updateData.manufacturingDate || updateData.productId) {
      // Convert manufacturing date to Date object if provided
      const manufacturingDateToUse = updateData.manufacturingDate
        ? new Date(updateData.manufacturingDate)
        : existingStockBatch.manufacturingDate;

      if (!product.lifeOfProduct) {
        return res.status(400).json({
          message: "Product does not have a lifeOfProduct value. Cannot calculate expiry date."
        });
      }

      const expiryDate = new Date(manufacturingDateToUse);
      expiryDate.setMonth(expiryDate.getMonth() + product.lifeOfProduct);
      updateData.expiryDate = expiryDate;
      updateData.manufacturingDate = manufacturingDateToUse;
    }

    // Convert date strings to Date objects for other dates
    if (updateData.arrivalDate) {
      updateData.arrivalDate = new Date(updateData.arrivalDate);
    }

    const qtyProvided = updateData.stockQuantity !== undefined && updateData.stockQuantity !== null;
    const requestedQty = qtyProvided ? Number(updateData.stockQuantity) : undefined;
    if (qtyProvided && (!Number.isFinite(requestedQty!) || requestedQty! < 0)) {
      return res.status(400).json({ message: "stockQuantity must be a non-negative number" });
    }
    const qtyDelta =
      qtyProvided && requestedQty !== existingStockBatch.stockQuantity
        ? requestedQty! - existingStockBatch.stockQuantity
        : 0;

    // Qty changes go through the ledger helper; strip from plain update payload
    if (qtyProvided) {
      delete updateData.stockQuantity;
    }

    const includeBatch = {
      product: {
        include: {
          Category: true,
        },
      },
      PurchaseInvoice: {
        select: {
          id: true,
          invoiceID: true,
          invoiceDate: true,
        },
      },
    } as const;

    const stockBatch = await prisma.$transaction(async (tx) => {
      if (qtyDelta !== 0) {
        await applyStockLedgerDelta({
          db: tx,
          stockBatchId: id,
          productId: existingStockBatch.productId,
          delta: qtyDelta,
          reason: "CORRECTION_BY_ADMIN",
          changeDate: defaultChangeDateIst(),
          createdBy: await getCreatedByForStockRecord(req),
        });
      }

      if (Object.keys(updateData).length === 0) {
        return tx.stockBatch.findUniqueOrThrow({
          where: { id },
          include: includeBatch,
        });
      }

      return tx.stockBatch.update({
        where: { id },
        data: updateData,
        include: includeBatch,
      });
    });

    res.json({ stockBatch });
  } catch (error) {
    console.error("Error updating stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// OrderStatusType IDs that block stock batch deletion (from anshGroupErp.OrderStatusType)
const BLOCKED_ORDER_STATUS_TYPE_IDS = new Set([
  "699f1bcc58a2f2472223b361", // PENDING
  "699f1bff58a2f2472223b362", // MODIFYING
  "699f1c3458a2f2472223b363", // FINALIZED
  "699f1c8658a2f2472223b364", // PULLING
  "699f1c9f58a2f2472223b365", // LOADING
]);

// Delete a stock entry
export const deleteStockBatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if stock exists
    const existingStockBatch = await prisma.stockBatch.findUnique({
      where: { id },
    });

    if (!existingStockBatch) {
      return res.status(404).json({ message: "Stock not found" });
    }

    // Ledger is append-only: removing a line writes RELEASED_FROM_ORDER and keeps
    // the original ASSIGNED_TO_ORDER row. Only a still-negative net (qty still
    // reserved) on a not-yet-loaded order should block deletion.
    const stockRecords = await prisma.stockRecord.findMany({
      where: {
        stockBatchId: existingStockBatch.id,
        reason: { in: ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"] },
        orderId: { not: null },
      },
      select: {
        changeInStock: true,
        Order: {
          select: {
            id: true,
            orderStatusTypeId: true,
          },
        },
      },
    });

    const netByOrderId = new Map<
      string,
      { net: number; orderStatusTypeId: string | null }
    >();
    for (const rec of stockRecords) {
      if (!rec.Order?.id) continue;
      const existing = netByOrderId.get(rec.Order.id);
      if (existing) {
        existing.net += rec.changeInStock;
      } else {
        netByOrderId.set(rec.Order.id, {
          net: rec.changeInStock,
          orderStatusTypeId: rec.Order.orderStatusTypeId,
        });
      }
    }

    const blockedOrderIds = Array.from(netByOrderId.entries())
      .filter(
        ([, entry]) =>
          entry.net < 0 &&
          !!entry.orderStatusTypeId &&
          BLOCKED_ORDER_STATUS_TYPE_IDS.has(entry.orderStatusTypeId)
      )
      .map(([orderId]) => orderId);

    // If any record is linked to an order whose status is blocked, do not allow delete
    const hasBlockedOrder = blockedOrderIds.length > 0;

    // const hasBlockedOrder = false;
    if (hasBlockedOrder) {
      //send error with associated order ids
      return res.status(400).json({
        associatedOrderIds: blockedOrderIds,
        message:
          "Cannot delete stock batch until associated order(s) are loaded or deleted!",
      });
    }

    // Soft-remove: write-off remaining qty via ledger, archive batch, keep StockRecords
    const createdBy = await getCreatedByForStockRecord(req);
    await prisma.$transaction(async (tx) => {
      if (existingStockBatch.stockQuantity > 0) {
        await applyStockLedgerDelta({
          db: tx,
          stockBatchId: existingStockBatch.id,
          productId: existingStockBatch.productId,
          delta: -existingStockBatch.stockQuantity,
          reason: "CORRECTION_BY_ADMIN",
          changeDate: defaultChangeDateIst(),
          createdBy,
        });
      } else if (!existingStockBatch.isArchived) {
        await tx.stockBatch.update({
          where: { id: existingStockBatch.id },
          data: { isArchived: true },
        });
      }
    });

    res.json({
      message:
        "Stock batch archived and remaining quantity written off. Stock records were kept for audit.",
    });
  } catch (error) {
    console.error("Error deleting stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Archive/Unarchive stock
export const toggleStockArchive = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;

    // Check if stock exists
    const existingStockBatch = await prisma.stockBatch.findUnique({
      where: { id },
    });

    if (!existingStockBatch) {
      return res.status(404).json({ message: "Stock not found" });
    }

    const stockBatch = await prisma.stockBatch.update({
      where: { id },
      data: { isArchived },
      include: {
        product: {
          include: {
            Category: true,
          },
        },
      },
    });

    res.json({ stockBatch });
  } catch (error) {
    console.error("Error toggling stock archive:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get stock statistics
export const getStockStats = async (req: Request, res: Response) => {
  try {
    const [
      totalStockBatches,
      totalValue,
      expiredStocks,
      lowStockCount,
      archivedStockBatches,
    ] = await Promise.all([
      prisma.stockBatch.count(),
      prisma.stockBatch.aggregate({
        _sum: {
          stockQuantity: true,
        },
      }),
      prisma.stockBatch.count({
        where: {
          expiryDate: { lt: new Date() },
        },
      }),
      prisma.stockBatch.count({
        where: {
          stockQuantity: { lte: 10 }, // Example threshold
        },
      }),
      prisma.stockBatch.count({
        where: {
          isArchived: true,
        },
      }),
    ]);

    // Calculate total inventory value
    const stocksWithProducts = await prisma.stockBatch.findMany({
      include: {
        product: {
          select: {
            mrp: true,
          },
        },
      },
    });

    const totalInventoryValue = stocksWithProducts.reduce(
      (sum, stock) => sum + (stock.product.mrp * stock.stockQuantity),
      0
    );

    res.json({
      stats: {
        totalStockBatches,
        totalQuantity: totalValue._sum.stockQuantity || 0,
        totalInventoryValue,
        expiredStocks,
        lowStockCount,
        archivedStockBatches,
        activeStockBatches: totalStockBatches - archivedStockBatches,
      },
    });
  } catch (error) {
    console.error("Error fetching stock stats:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get stock batches by product ID
export const getStockBatchesByProductId = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const {
      page = 1,
      limit = 100,
      isArchived,
      expired,
      lowStock,
      includeProductGroup,
    } = req.query as any;

    // Convert string values to numbers
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    const skip = (pageNum - 1) * limitNum;

    // Verify that product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        Category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    let productIds: string[] = [productId];
    if (includeProductGroup === "true" && product.productGroupId) {
      const siblings = await prisma.product.findMany({
        where: { productGroupId: product.productGroupId },
        select: { id: true },
      });
      productIds = siblings.map((p) => p.id);
    }

    // Build where clause
    const where: any = {
      productId: productIds.length === 1 ? productIds[0] : { in: productIds },
    };

    if (isArchived !== undefined) {
      where.isArchived = isArchived === 'true';
    }

    if (expired !== undefined) {
      if (expired === 'true') {
        where.expiryDate = { lt: new Date() };
      } else {
        where.expiryDate = { gte: new Date() };
      }
    }

    if (lowStock !== undefined && lowStock === 'true') {
      where.AND = [
        { stockQuantity: { gt: 0 } },
        {
          product: {
            lowStockLimit: { gt: 0 },
          },
        },
      ];
      // This is a simplified check - you might want to implement more sophisticated logic
      where.stockQuantity = { lte: 10 }; // Example threshold
    }

    const [stockBatches, total] = await Promise.all([
      prisma.stockBatch.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          product: {
            include: {
              Category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          PurchaseInvoice: {
            select: {
              id: true,
              invoiceID: true,
              invoiceDate: true,
            },
          },
          StockRecord: {
            orderBy: { createdAt: "desc" },
            take: 5, // Get last 5 stock records
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stockBatch.count({ where }),
    ]);

    // Reserved = net outstanding assignment on non-completed orders
    // (ASSIGNED_TO_ORDER decreases + RELEASED_FROM_ORDER increases; same netting as updateOrder)
    const batchIds = stockBatches.map((b) => b.id);
    let reservedByBatchId: Record<string, number> = {};
    let reservedOrdersByBatchId: Record<string, ReservedOrderSummary[]> = {};
    if (batchIds.length > 0) {
      const assignmentRecords = await prisma.stockRecord.findMany({
        where: {
          reason: { in: ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"] },
          stockBatchId: { in: batchIds },
          orderId: { not: null },
          Order: {
            orderStatusTypeId: { not: COMPLETED_ORDER_STATUS_TYPE_ID },
          },
        },
        select: {
          stockBatchId: true,
          changeInStock: true,
          Order: {
            select: {
              id: true,
              customeOrderId: true,
              orderDate: true,
              OrderStatusType: {
                select: {
                  name: true,
                },
              },
              Customer: {
                select: {
                  CustomerDetail: {
                    select: {
                      dbName: true,
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      type OrderNet = ReservedOrderSummary & { net: number };
      const perBatchOrderMap: Record<string, Record<string, OrderNet>> = {};

      for (const r of assignmentRecords) {
        if (!r.Order?.id) continue;
        const batchId = r.stockBatchId;
        if (!perBatchOrderMap[batchId]) perBatchOrderMap[batchId] = {};
        const existing = perBatchOrderMap[batchId][r.Order.id];
        if (existing) {
          existing.net += r.changeInStock;
        } else {
          perBatchOrderMap[batchId][r.Order.id] = {
            orderId: r.Order.id,
            orderNo: r.Order.customeOrderId,
            dbName: r.Order.Customer?.CustomerDetail?.[0]?.dbName ?? null,
            orderDate: r.Order.orderDate,
            orderStatusTypeName: r.Order.OrderStatusType?.name ?? null,
            reservedQuantity: 0,
            net: r.changeInStock,
          };
        }
      }

      reservedByBatchId = {};
      reservedOrdersByBatchId = {};
      for (const [batchId, orderMap] of Object.entries(perBatchOrderMap)) {
        const orders: ReservedOrderSummary[] = [];
        let batchReserved = 0;
        for (const { net, ...summary } of Object.values(orderMap)) {
          // net < 0 means qty still reserved on this batch for this order
          const reserved = net < 0 ? -net : 0;
          if (reserved <= 0) continue;
          batchReserved += reserved;
          orders.push({ ...summary, reservedQuantity: reserved });
        }
        orders.sort(
          (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
        );
        reservedByBatchId[batchId] = batchReserved;
        reservedOrdersByBatchId[batchId] = orders;
      }
    }

    const stockBatchesWithQuantities = stockBatches.map((batch) => {
      const reserved = reservedByBatchId[batch.id] ?? 0;
      const remaining = batch.stockQuantity;
      const inWarehouse = remaining + reserved;
      return {
        ...batch,
        reservedQuantity: reserved,
        inWarehouseQuantity: inWarehouse,
        reservedOrders: reservedOrdersByBatchId[batch.id] ?? [],
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      product,
      stockBatches: stockBatchesWithQuantities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching stock batches by product ID:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get stock alerts (expired, low stock, etc.)
export const getStockAlerts = async (req: Request, res: Response) => {
  try {
    const [expiredStocks, lowStockItems, expiringSoon] = await Promise.all([
      // Expired stocks
      prisma.stockBatch.findMany({
        where: {
          expiryDate: { lt: new Date() },
          isArchived: false,
        },
        include: {
          product: {
            select: {
              name: true,
              productCode: true,
            },
          },
        },
        orderBy: { expiryDate: "asc" },
      }),
      // Low stock items
      prisma.stockBatch.findMany({
        where: {
          stockQuantity: { lte: 10 }, // Example threshold
          isArchived: false,
        },
        include: {
          product: {
            select: {
              name: true,
              productCode: true,
              lowStockLimit: true,
            },
          },
        },
        orderBy: { stockQuantity: "asc" },
      }),
      // Expiring soon (within 30 days)
      prisma.stockBatch.findMany({
        where: {
          expiryDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
          isArchived: false,
        },
        include: {
          product: {
            select: {
              name: true,
              productCode: true,
            },
          },
        },
        orderBy: { expiryDate: "asc" },
      }),
    ]);

    res.json({
      alerts: {
        expired: expiredStocks,
        lowStock: lowStockItems,
        expiringSoon,
        totalAlerts: expiredStocks.length + lowStockItems.length + expiringSoon.length,
      },
    });
  } catch (error) {
    console.error("Error fetching stock alerts:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Reconcile a product's total stock quantity to a target (admin Excel cross-check).
 * Uses CORRECTION_BY_ADMIN ledger entries via applyStockLedgerDelta.
 * Increases go to the newest batch (or a new correction batch); decreases drain newest-first.
 */
export const reconcileProductQuantity = async (req: Request, res: Response) => {
  try {
    const { productId, targetQuantity } = req.body as {
      productId?: string;
      targetQuantity?: number;
    };

    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ message: "productId is required" });
    }

    const target = Number(targetQuantity);
    if (!Number.isFinite(target) || target < 0 || !Number.isInteger(target)) {
      return res.status(400).json({
        message: "targetQuantity must be a non-negative integer",
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, lifeOfProduct: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const createdBy = await getCreatedByForStockRecord(req);
    const changeDate = defaultChangeDateIst();

    const result = await prisma.$transaction(async (tx) => {
      const batches = await tx.stockBatch.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          stockQuantity: true,
          isArchived: true,
          createdAt: true,
        },
      });

      const currentSum = batches.reduce((sum, b) => sum + b.stockQuantity, 0);
      const delta = target - currentSum;

      if (delta === 0) {
        return { previousQuantity: currentSum, newQuantity: currentSum, delta: 0 };
      }

      if (delta > 0) {
        // Prefer newest non-archived batch; else newest batch (will unarchive via helper)
        const preferred =
          batches.find((b) => !b.isArchived) ?? batches[0] ?? null;

        if (preferred) {
          await applyStockLedgerDelta({
            db: tx,
            stockBatchId: preferred.id,
            productId,
            delta,
            reason: "CORRECTION_BY_ADMIN",
            changeDate,
            createdBy,
          });
        } else {
          const now = changeDate;
          const lifeMonths = product.lifeOfProduct && product.lifeOfProduct > 0
            ? product.lifeOfProduct
            : 12;
          const expiryDate = new Date(now);
          expiryDate.setMonth(expiryDate.getMonth() + lifeMonths);

          const newBatch = await tx.stockBatch.create({
            data: {
              productId,
              manufacturingDate: now,
              arrivalDate: now,
              expiryDate,
              stockQuantity: 0,
              isArchived: false,
            },
          });

          await applyStockLedgerDelta({
            db: tx,
            stockBatchId: newBatch.id,
            productId,
            delta,
            reason: "CORRECTION_BY_ADMIN",
            changeDate,
            createdBy,
          });
        }
      } else {
        // Decrease newest-first across batches that have quantity
        let remaining = -delta;
        const withStock = batches
          .filter((b) => b.stockQuantity > 0)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        for (const batch of withStock) {
          if (remaining <= 0) break;
          const take = Math.min(batch.stockQuantity, remaining);
          await applyStockLedgerDelta({
            db: tx,
            stockBatchId: batch.id,
            productId,
            delta: -take,
            reason: "CORRECTION_BY_ADMIN",
            changeDate,
            createdBy,
          });
          remaining -= take;
        }

        if (remaining > 0) {
          throw new Error(
            `Insufficient stock to reconcile: need to remove ${-delta} but only ${currentSum} available`
          );
        }
      }

      const updated = await tx.stockBatch.findMany({
        where: { productId },
        select: { stockQuantity: true },
      });
      const newQuantity = updated.reduce((sum, b) => sum + b.stockQuantity, 0);

      return { previousQuantity: currentSum, newQuantity, delta };
    });

    return res.json({
      message: "Product quantity reconciled",
      productId,
      ...result,
    });
  } catch (error) {
    console.error("Error reconciling product quantity:\n", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Insufficient stock")) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};
