import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { isInsufficientStockError } from "../../lib/applyStockLedgerDelta";
import { fifoDeductStock } from "../../lib/fifoDeductStock";
import { getCreatedByForStockRecord } from "../../lib/getCreatedByForStockRecord";
import {
  isOrderWithinReturnWindow,
  returnOrderWindowMessage,
} from "../../lib/returnOrderWindow";
import {
  buildStockRecordChangeFields,
  toChangeDateIst,
} from "../../lib/stockRecordChangeMeta";

type ItemInput = { productId: string; quantity: number };

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const listInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      CustomerDetail: { select: { dbName: true, dbCategory: true } },
    },
  },
  order: {
    select: {
      id: true,
      customeOrderId: true,
      orderDate: true,
      customerId: true,
    },
  },
  SalesReturnItem: {
    include: {
      Product: {
        select: {
          id: true,
          name: true,
          productCode: true,
          sellingPricePerCartonForRssWithGst: true,
          sellingPricePerCartonForRss: true,
          costPricePerCartonWithGst: true,
          costPricePerCarton: true,
          sellingPricePerCartonForDbWithGst: true,
          sellingPricePerCartonForDb: true,
        },
      },
    },
  },
} as const;

async function validateItemsAgainstOrder(
  orderId: string,
  customerId: string,
  items: ItemInput[],
  opts: { enforceReturnWindow?: boolean } = {}
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { enforceReturnWindow = true } = opts;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { OrderItem: true },
  });

  if (!order) {
    return { ok: false, status: 404, message: "Order not found" };
  }
  if (order.customerId !== customerId) {
    return { ok: false, status: 400, message: "Customer does not match this order" };
  }
  // New returns must reference a recent order (the order picker only lists the
  // last RETURN_ORDER_LOOKBACK_MONTHS). Edits to existing returns are exempt.
  if (enforceReturnWindow && !isOrderWithinReturnWindow(order.orderDate)) {
    return {
      ok: false,
      status: 400,
      message: returnOrderWindowMessage("sales return"),
    };
  }

  const qtyByProduct = new Map<string, number>();
  for (const oi of order.OrderItem) {
    qtyByProduct.set(oi.productId, (qtyByProduct.get(oi.productId) ?? 0) + oi.quantity);
  }

  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.productId)) {
      return { ok: false, status: 400, message: "Duplicate product in return items" };
    }
    seen.add(it.productId);
    const max = qtyByProduct.get(it.productId);
    if (max === undefined) {
      return {
        ok: false,
        status: 400,
        message: `Product is not on this order: ${it.productId}`,
      };
    }
    if (it.quantity > max) {
      return {
        ok: false,
        status: 400,
        message: `Return quantity cannot exceed ordered quantity for product ${it.productId}`,
      };
    }
  }

  return { ok: true };
}

async function reverseSalesReturnInventory(
  tx: Tx,
  salesReturnId: string,
  createdBy: string
): Promise<void> {
  const records = await tx.stockRecord.findMany({
    where: { salesReturnId },
    select: {
      stockBatchId: true,
      productId: true,
      changeInStock: true,
    },
  });
  if (records.length === 0) return;

  const netByBatch = new Map<
    string,
    { stockBatchId: string; productId: string; net: number }
  >();
  for (const row of records) {
    const cur = netByBatch.get(row.stockBatchId) ?? {
      stockBatchId: row.stockBatchId,
      productId: row.productId,
      net: 0,
    };
    cur.net += row.changeInStock;
    netByBatch.set(row.stockBatchId, cur);
  }

  const neededByProduct = new Map<string, { needed: number; preferBatchIds: string[] }>();
  for (const { stockBatchId, productId, net } of netByBatch.values()) {
    if (net <= 0) continue;
    const cur = neededByProduct.get(productId) ?? { needed: 0, preferBatchIds: [] };
    cur.needed += net;
    cur.preferBatchIds.push(stockBatchId);
    neededByProduct.set(productId, cur);
  }

  for (const [productId, { needed, preferBatchIds }] of neededByProduct) {
    await fifoDeductStock({
      db: tx,
      productId,
      quantity: needed,
      createdBy,
      salesReturnId,
      preferBatchIds,
    });
  }
}

async function applySalesReturnStock(
  tx: Tx,
  params: {
    salesReturnId: string;
    orderId: string;
    returnDate: Date;
    items: ItemInput[];
    createdBy: string;
  }
): Promise<void> {
  const { salesReturnId, orderId, returnDate, items, createdBy } = params;
  const ret = returnDate instanceof Date ? returnDate : new Date(returnDate);
  const productIds = [...new Set(items.map((it) => it.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, lifeOfProduct: true },
  });
  const lifeById = new Map(products.map((p) => [p.id, p.lifeOfProduct ?? 6]));

  for (const it of items) {
    const lifeMonths = lifeById.get(it.productId) ?? 6;
    const anchor = toChangeDateIst(ret);
    const expiryDate = new Date(anchor);
    expiryDate.setMonth(expiryDate.getMonth() + lifeMonths);

    const batch = await tx.stockBatch.create({
      data: {
        productId: it.productId,
        manufacturingDate: anchor,
        arrivalDate: anchor,
        expiryDate,
        stockQuantity: it.quantity,
        purchaseId: null,
        isArchived: false,
      },
    });

    const changeMeta = buildStockRecordChangeFields({
      changeInStock: it.quantity,
      changeDate: ret,
    });

    await tx.stockRecord.create({
      data: {
        productId: it.productId,
        stockBatchId: batch.id,
        changeInStock: it.quantity,
        reason: "RETURNED",
        createdBy,
        orderId,
        salesReturnId,
        ...changeMeta,
      },
    });
  }
}

async function bumpReturnLinkedBatchDates(
  tx: Tx,
  salesReturnId: string,
  newReturnDate: Date
): Promise<void> {
  const records = await tx.stockRecord.findMany({ where: { salesReturnId } });
  if (records.length === 0) return;

  const productIds = [...new Set(records.map((r) => r.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, lifeOfProduct: true },
  });
  const lifeById = new Map(products.map((p) => [p.id, p.lifeOfProduct ?? 6]));

  const anchor = toChangeDateIst(newReturnDate instanceof Date ? newReturnDate : new Date(newReturnDate));

  for (const rec of records) {
    const lifeMonths = lifeById.get(rec.productId) ?? 6;
    const expiryDate = new Date(anchor);
    expiryDate.setMonth(expiryDate.getMonth() + lifeMonths);

    await tx.stockRecord.update({
      where: { id: rec.id },
      data: { changeDate: anchor },
    });
    await tx.stockBatch.update({
      where: { id: rec.stockBatchId },
      data: {
        manufacturingDate: anchor,
        arrivalDate: anchor,
        expiryDate,
      },
    });
  }
}

export const createSalesReturn = async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, returnDate, returnReason, items } = req.body as {
      customerId: string;
      orderId: string;
      returnDate: Date;
      returnReason: string;
      items: ItemInput[];
    };

    const check = await validateItemsAgainstOrder(orderId, customerId, items);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const createdBy = await getCreatedByForStockRecord(req);

    const salesReturn = await prisma.$transaction(async (tx) => {
      const sr = await tx.salesReturn.create({
        data: {
          customerId,
          orderId,
          returnDate,
          returnReason,
          SalesReturnItem: {
            create: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          },
        },
        include: { SalesReturnItem: true },
      });

      await applySalesReturnStock(tx, {
        salesReturnId: sr.id,
        orderId: sr.orderId,
        returnDate: sr.returnDate,
        items,
        createdBy,
      });

      return tx.salesReturn.findUniqueOrThrow({
        where: { id: sr.id },
        include: listInclude,
      });
    });

    res.status(201).json({ salesReturn });
  } catch (error) {
    console.error("Error creating sales return:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSalesReturns = async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, startDate, endDate, page, limit } = req.query;

    const where: Record<string, unknown> = {};
    if (customerId && typeof customerId === "string") {
      where.customerId = customerId;
    }
    if (orderId && typeof orderId === "string") {
      where.orderId = orderId;
    }

    const hasDateFilter = Boolean(
      (startDate && typeof startDate === "string") || (endDate && typeof endDate === "string")
    );
    if (hasDateFilter) {
      const returnDate: { gte?: Date; lte?: Date } = {};
      if (startDate && typeof startDate === "string") {
        returnDate.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate && typeof endDate === "string") {
        returnDate.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
      if (Object.keys(returnDate).length > 0) {
        where.returnDate = returnDate;
      }
    }

    const orderBy = hasDateFilter
      ? ({ returnDate: "desc" } as const)
      : ({ createdAt: "desc" } as const);

    // Paginate only when page/limit are explicitly requested. Date filters alone return all matches.
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const rawLimit = Number(limit) || 1000;
      const limitNum = Math.min(Math.max(1, rawLimit), 5000);
      const skip = (pageNum - 1) * limitNum;

      const [salesReturns, total] = await Promise.all([
        prisma.salesReturn.findMany({
          where,
          include: listInclude,
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.salesReturn.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum) || 1;

      return res.json({
        salesReturns,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
        },
      });
    }

    const salesReturns = await prisma.salesReturn.findMany({
      where,
      include: listInclude,
      orderBy,
    });

    res.json({ salesReturns });
  } catch (error) {
    console.error("Error fetching sales returns:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getSalesReturnById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const salesReturn = await prisma.salesReturn.findUnique({
      where: { id },
      include: listInclude,
    });

    if (!salesReturn) {
      return res.status(404).json({ message: "Sales return not found" });
    }

    res.json({ salesReturn });
  } catch (error) {
    console.error("Error fetching sales return:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSalesReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as {
      returnDate?: Date;
      returnReason?: string;
      items?: ItemInput[];
    };

    const existing = await prisma.salesReturn.findUnique({
      where: { id },
      include: { SalesReturnItem: true },
    });

    if (!existing) {
      return res.status(404).json({ message: "Sales return not found" });
    }

    if (body.items && body.items.length > 0) {
      const check = await validateItemsAgainstOrder(
        existing.orderId,
        existing.customerId,
        body.items,
        { enforceReturnWindow: false }
      );
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }
    }

    const createdBy = await getCreatedByForStockRecord(req);

    const salesReturn = await prisma.$transaction(async (tx) => {
      const itemsReplaced = Boolean(body.items && body.items.length > 0);

      if (itemsReplaced) {
        await reverseSalesReturnInventory(tx, id, createdBy);
        await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });
      }

      const data: {
        returnDate?: Date;
        returnReason?: string;
        SalesReturnItem?: { create: { productId: string; quantity: number }[] };
      } = {};
      if (body.returnDate !== undefined) data.returnDate = body.returnDate;
      if (body.returnReason !== undefined) data.returnReason = body.returnReason;
      if (itemsReplaced) {
        data.SalesReturnItem = {
          create: body.items!.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        };
      }

      await tx.salesReturn.update({
        where: { id },
        data,
      });

      if (itemsReplaced) {
        const returnDateToUse =
          body.returnDate !== undefined ? body.returnDate : existing.returnDate;
        await applySalesReturnStock(tx, {
          salesReturnId: id,
          orderId: existing.orderId,
          returnDate: returnDateToUse,
          items: body.items!,
          createdBy,
        });
      } else if (body.returnDate !== undefined) {
        await bumpReturnLinkedBatchDates(tx, id, body.returnDate);
      }

      return tx.salesReturn.findUniqueOrThrow({
        where: { id },
        include: listInclude,
      });
    });

    res.json({ salesReturn });
  } catch (error) {
    console.error("Error updating sales return:\n", error);
    if (isInsufficientStockError(error)) {
      return res.status(409).json({
        message:
          "Cannot change returned quantities because the returned stock has already been used.",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSalesReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.salesReturn.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Sales return not found" });
    }

    const createdBy = await getCreatedByForStockRecord(req);

    await prisma.$transaction(async (tx) => {
      await reverseSalesReturnInventory(tx, id, createdBy);
      await tx.salesReturnItem.deleteMany({ where: { salesReturnId: id } });
      await tx.salesReturn.delete({ where: { id } });
    });

    res.json({ message: "Sales return deleted" });
  } catch (error) {
    console.error("Error deleting sales return:\n", error);
    if (isInsufficientStockError(error)) {
      return res.status(409).json({
        message:
          "This sales return cannot be deleted because there is not enough available stock to reverse it.",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
