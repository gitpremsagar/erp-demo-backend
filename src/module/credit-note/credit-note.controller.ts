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
  CreditNoteItem: {
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

  if (!order) return { ok: false, status: 404, message: "Order not found" };
  if (order.customerId !== customerId) {
    return { ok: false, status: 400, message: "Customer does not match this order" };
  }
  // New credit notes must reference a recent order (the order picker only lists
  // the last RETURN_ORDER_LOOKBACK_MONTHS). Edits to existing notes are exempt.
  if (enforceReturnWindow && !isOrderWithinReturnWindow(order.orderDate)) {
    return {
      ok: false,
      status: 400,
      message: returnOrderWindowMessage("credit note"),
    };
  }

  const qtyByProduct = new Map<string, number>();
  for (const oi of order.OrderItem) {
    qtyByProduct.set(oi.productId, (qtyByProduct.get(oi.productId) ?? 0) + oi.quantity);
  }

  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.productId)) {
      return { ok: false, status: 400, message: "Duplicate product in credit note items" };
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
        message: `Credit note quantity cannot exceed ordered quantity for product ${it.productId}`,
      };
    }
  }

  return { ok: true };
}

async function reverseCreditNoteInventory(
  tx: Tx,
  creditNoteId: string,
  createdBy: string
): Promise<void> {
  const records = await tx.stockRecord.findMany({
    where: { creditNoteId },
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
      creditNoteId,
      preferBatchIds,
    });
  }
}

async function applyCreditNoteStock(
  tx: Tx,
  params: {
    creditNoteId: string;
    orderId: string;
    noteDate: Date;
    items: ItemInput[];
    createdBy: string;
  }
): Promise<void> {
  const { creditNoteId, orderId, noteDate, items, createdBy } = params;
  const note = noteDate instanceof Date ? noteDate : new Date(noteDate);
  const productIds = [...new Set(items.map((it) => it.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, lifeOfProduct: true },
  });
  const lifeById = new Map(products.map((p) => [p.id, p.lifeOfProduct ?? 6]));

  for (const it of items) {
    const lifeMonths = lifeById.get(it.productId) ?? 6;
    const anchor = toChangeDateIst(note);
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
      changeDate: note,
    });

    await tx.stockRecord.create({
      data: {
        productId: it.productId,
        stockBatchId: batch.id,
        changeInStock: it.quantity,
        reason: "CREDIT_NOTE",
        createdBy,
        orderId,
        creditNoteId,
        ...changeMeta,
      },
    });
  }
}

async function bumpCreditNoteLinkedBatchDates(
  tx: Tx,
  creditNoteId: string,
  newNoteDate: Date
): Promise<void> {
  const records = await tx.stockRecord.findMany({ where: { creditNoteId } });
  if (records.length === 0) return;

  const productIds = [...new Set(records.map((r) => r.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, lifeOfProduct: true },
  });
  const lifeById = new Map(products.map((p) => [p.id, p.lifeOfProduct ?? 6]));
  const anchor = toChangeDateIst(newNoteDate instanceof Date ? newNoteDate : new Date(newNoteDate));

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

export const createCreditNote = async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, noteDate, noteReason, items } = req.body as {
      customerId: string;
      orderId: string;
      noteDate: Date;
      noteReason: string;
      items: ItemInput[];
    };

    const check = await validateItemsAgainstOrder(orderId, customerId, items);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const createdBy = await getCreatedByForStockRecord(req);

    const creditNote = await prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.create({
        data: {
          customerId,
          orderId,
          noteDate,
          noteReason,
          CreditNoteItem: {
            create: items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          },
        },
        include: { CreditNoteItem: true },
      });

      await applyCreditNoteStock(tx, {
        creditNoteId: cn.id,
        orderId: cn.orderId,
        noteDate: cn.noteDate,
        items,
        createdBy,
      });

      return tx.creditNote.findUniqueOrThrow({
        where: { id: cn.id },
        include: listInclude,
      });
    });

    res.status(201).json({ creditNote });
  } catch (error) {
    console.error("Error creating credit note:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCreditNotes = async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, startDate, endDate, page, limit } = req.query;

    const where: Record<string, unknown> = {};
    if (customerId && typeof customerId === "string") where.customerId = customerId;
    if (orderId && typeof orderId === "string") where.orderId = orderId;

    const hasDateFilter = Boolean(
      (startDate && typeof startDate === "string") || (endDate && typeof endDate === "string")
    );
    if (hasDateFilter) {
      const noteDate: { gte?: Date; lte?: Date } = {};
      if (startDate && typeof startDate === "string") {
        noteDate.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate && typeof endDate === "string") {
        noteDate.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
      if (Object.keys(noteDate).length > 0) where.noteDate = noteDate;
    }

    const orderBy = hasDateFilter ? ({ noteDate: "desc" } as const) : ({ createdAt: "desc" } as const);

    // Paginate only when page/limit are explicitly requested. Date filters alone return all matches.
    if (page !== undefined || limit !== undefined) {
      const pageNum = Math.max(1, Number(page) || 1);
      const rawLimit = Number(limit) || 1000;
      const limitNum = Math.min(Math.max(1, rawLimit), 5000);
      const skip = (pageNum - 1) * limitNum;

      const [creditNotes, total] = await Promise.all([
        prisma.creditNote.findMany({
          where,
          include: listInclude,
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.creditNote.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.json({
        creditNotes,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
        },
      });
    }

    const creditNotes = await prisma.creditNote.findMany({ where, include: listInclude, orderBy });
    res.json({ creditNotes });
  } catch (error) {
    console.error("Error fetching credit notes:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCreditNoteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const creditNote = await prisma.creditNote.findUnique({ where: { id }, include: listInclude });
    if (!creditNote) return res.status(404).json({ message: "Credit note not found" });
    res.json({ creditNote });
  } catch (error) {
    console.error("Error fetching credit note:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCreditNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as {
      noteDate?: Date;
      noteReason?: string;
      items?: ItemInput[];
    };

    const existing = await prisma.creditNote.findUnique({
      where: { id },
      include: { CreditNoteItem: true },
    });
    if (!existing) return res.status(404).json({ message: "Credit note not found" });

    if (body.items && body.items.length > 0) {
      const check = await validateItemsAgainstOrder(
        existing.orderId,
        existing.customerId,
        body.items,
        { enforceReturnWindow: false }
      );
      if (!check.ok) return res.status(check.status).json({ message: check.message });
    }

    const createdBy = await getCreatedByForStockRecord(req);

    const creditNote = await prisma.$transaction(async (tx) => {
      const itemsReplaced = Boolean(body.items && body.items.length > 0);

      if (itemsReplaced) {
        await reverseCreditNoteInventory(tx, id, createdBy);
        await tx.creditNoteItem.deleteMany({ where: { creditNoteId: id } });
      }

      const data: {
        noteDate?: Date;
        noteReason?: string;
        CreditNoteItem?: { create: { productId: string; quantity: number }[] };
      } = {};
      if (body.noteDate !== undefined) data.noteDate = body.noteDate;
      if (body.noteReason !== undefined) data.noteReason = body.noteReason;
      if (itemsReplaced) {
        data.CreditNoteItem = {
          create: body.items!.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        };
      }

      await tx.creditNote.update({ where: { id }, data });

      if (itemsReplaced) {
        const noteDateToUse = body.noteDate !== undefined ? body.noteDate : existing.noteDate;
        await applyCreditNoteStock(tx, {
          creditNoteId: id,
          orderId: existing.orderId,
          noteDate: noteDateToUse,
          items: body.items!,
          createdBy,
        });
      } else if (body.noteDate !== undefined) {
        await bumpCreditNoteLinkedBatchDates(tx, id, body.noteDate);
      }

      return tx.creditNote.findUniqueOrThrow({ where: { id }, include: listInclude });
    });

    res.json({ creditNote });
  } catch (error) {
    console.error("Error updating credit note:\n", error);
    if (isInsufficientStockError(error)) {
      return res.status(409).json({
        message:
          "Cannot change credit note quantities because the credited stock has already been used.",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCreditNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.creditNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Credit note not found" });

    const createdBy = await getCreatedByForStockRecord(req);

    await prisma.$transaction(async (tx) => {
      await reverseCreditNoteInventory(tx, id, createdBy);
      await tx.creditNoteItem.deleteMany({ where: { creditNoteId: id } });
      await tx.creditNote.delete({ where: { id } });
    });

    res.json({ message: "Credit note deleted" });
  } catch (error) {
    console.error("Error deleting credit note:\n", error);
    if (isInsufficientStockError(error)) {
      return res.status(409).json({
        message:
          "This credit note cannot be deleted because there is not enough available stock to reverse it.",
      });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
