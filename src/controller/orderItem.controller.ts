import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";

// Create a new order item
export const createOrderItem = async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      productId,
      quantity,
      customerId,
      orderCompleted = false,
    } = req.body;

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if customer exists
    if (customerId) {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Calculate current stock from stock records
    const stockRecords = await prisma.stockRecord.findMany({
      where: { productId },
    });
    
    const currentStock = stockRecords.reduce((total, record) => total + record.changeInStock, 0);
    
    // Check if product has sufficient stock
    if (currentStock < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Available: ${currentStock}, Requested: ${quantity}` 
      });
    }

    // Create order item
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        quantity,
        customerId,
        orderCompleted,
      },
      include: {
        Order: true,
        Product: {
          include: {
            Category: true,
          },
        },
        Customer: true,
      },
    });

    res.status(201).json({ orderItem });
  } catch (error) {
    console.error("Error creating order item:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all order items with pagination and filtering
export const getOrderItems = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      orderId,
      productId,
      orderCompleted,
    } = req.query as any;

    // Convert string parameters to numbers
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // Validate parameters
    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      return res.status(400).json({ 
        message: "Invalid pagination parameters. Page and limit must be positive numbers." 
      });
    }

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (orderId) {
      where.orderId = orderId;
    }

    if (productId) {
      where.productId = productId;
    }

    if (orderCompleted !== undefined) {
      where.orderCompleted = orderCompleted;
    }

    const [orderItems, total] = await Promise.all([
      prisma.orderItem.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          Order: true,
          Product: {
            include: {
              Category: true,
            },
          },
          Customer: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.orderItem.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      orderItems,
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
    console.error("Error fetching order items:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Product order history (expands to the full product group when grouped)
export const getProducOrderHistory = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const scope = await resolveHistoryProductScope(productId);

    const productOrderHistory = await prisma.orderItem.findMany({
      where: { productId: { in: scope.productIds } },
      include: {
        Order: true,
        Product: {
          include: {
            Category: true,
          },
        },
        Customer: {
          include: {
            CustomerDetail: true,
          },
        },
      },
    });

    productOrderHistory.sort((a, b) => {
      const dateA = new Date(a.orderDate ?? a.createdAt).getTime();
      const dateB = new Date(b.orderDate ?? b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json({
      productOrderHistory,
      scope: {
        mode: scope.mode,
        productGroupId: scope.productGroupId,
        productGroupName: scope.productGroupName,
        productIds: scope.productIds,
      },
    });
  } catch (error) {
    console.error("Error fetching produc order history:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

type HistoryRange = "3months" | "6months" | "lifetime";

function getDateRangeForRange(range: HistoryRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (range === "3months") {
    start.setMonth(start.getMonth() - 3);
  } else if (range === "6months") {
    start.setMonth(start.getMonth() - 6);
  } else {
    start.setFullYear(2000, 0, 1);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Product IDs in scope for history: all products sharing the selected
 * product's productGroupId, or just the selected product when it has no group.
 */
async function resolveHistoryProductScope(productId: string): Promise<{
  productIds: string[];
  mode: "productGroup" | "product";
  productGroupId: string | null;
  productGroupName: string | null;
}> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      productGroupId: true,
      ProductGroup: { select: { id: true, name: true } },
    },
  });

  if (!product) {
    return {
      productIds: [productId],
      mode: "product",
      productGroupId: null,
      productGroupName: null,
    };
  }

  if (!product.productGroupId || !product.ProductGroup) {
    return {
      productIds: [product.id],
      mode: "product",
      productGroupId: null,
      productGroupName: null,
    };
  }

  const siblings = await prisma.product.findMany({
    where: { productGroupId: product.productGroupId },
    select: { id: true },
  });

  return {
    productIds: siblings.map((p) => p.id),
    mode: "productGroup",
    productGroupId: product.ProductGroup.id,
    productGroupName: product.ProductGroup.name,
  };
}

// Get a history of product order by customer id and product id
// (expands to the full product group when the product has a productGroupId)
export const getCustomerProductOrderHistory = async (req: Request, res: Response) => {
  try {
    const { customerId, productId } = req.params;
    const range = (req.query.range as HistoryRange) || "3months";
    const validRanges: HistoryRange[] = ["3months", "6months", "lifetime"];
    const historyRange = validRanges.includes(range) ? range : "3months";

    const scope = await resolveHistoryProductScope(productId);
    const { start, end } = getDateRangeForRange(historyRange);

    const conditions: Prisma.OrderItemWhereInput[] = [
      { customerId },
      { productId: { in: scope.productIds } },
      {
        OR: [
          { orderCompleted: true },
          { Order: { orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID } },
        ],
      },
    ];

    if (historyRange !== "lifetime") {
      conditions.push({
        OR: [
          { orderDate: { gte: start, lte: end } },
          { orderDate: null, createdAt: { gte: start, lte: end } },
        ],
      });
    }

    const where: Prisma.OrderItemWhereInput = { AND: conditions };

    const [customerProductOrderHistory, forecastItems] = await Promise.all([
      prisma.orderItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.forecastItem.findMany({
        where: {
          distributorId: customerId,
          productId: { in: scope.productIds },
          ...(historyRange !== "lifetime"
            ? { forecastDate: { gte: start, lte: end } }
            : {}),
        },
        select: {
          id: true,
          forecastDate: true,
          quantity: true,
          productId: true,
        },
        orderBy: { forecastDate: "desc" },
      }),
    ]);

    customerProductOrderHistory.sort((a, b) => {
      const dateA = new Date(a.orderDate ?? a.createdAt).getTime();
      const dateB = new Date(b.orderDate ?? b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json({
      customerProductOrderHistory,
      forecastItems,
      scope: {
        mode: scope.mode,
        productGroupId: scope.productGroupId,
        productGroupName: scope.productGroupName,
        productIds: scope.productIds,
      },
    });
  } catch (error) {
    console.error("Error fetching customer product order history:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update an order item
export const updateOrderItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if order item exists
    const existingOrderItem = await prisma.orderItem.findUnique({
      where: { id },
      include: {
        Product: true,
        Order: true,
      },
    });

    if (!existingOrderItem) {
      return res.status(404).json({ message: "Order item not found" });
    }

    // Quantity changes must go through updateOrder (FIFO + append-only StockRecords).
    // This endpoint previously wrote fake StockRecords (stockBatchId: "default").
    if (updateData.quantity !== undefined) {
      return res.status(400).json({
        message:
          "Cannot change order item quantity here. Use PUT /api/orders/:orderId so stock is deducted/restored with proper StockBatch and StockRecord entries.",
      });
    }

    // Convert date string to Date object if provided
    if (updateData.deliveryDate) {
      updateData.deliveryDate = new Date(updateData.deliveryDate);
    }

    const orderItem = await prisma.orderItem.update({
      where: { id },
      data: updateData,
      include: {
        Order: true,
        Product: {
          include: {
            Category: true,
          },
        },
        Customer: true,
      },
    });

    res.json({ orderItem });
  } catch (error) {
    console.error("Error updating order item:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an order item
export const deleteOrderItem = async (_req: Request, res: Response) => {
  try {
    return res.status(400).json({
      message:
        "Cannot delete order items here. Use PUT /api/orders/:orderId (set quantity to 0) or DELETE /api/orders/:orderId so stock is restored with proper RELEASED_FROM_ORDER StockRecords.",
    });
  } catch (error) {
    console.error("Error deleting order item:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get order item statistics
export const getOrderItemStats = async (req: Request, res: Response) => {
  try {
    const [totalOrderItems, completedOrderItems, pendingOrderItems] = await Promise.all([
      prisma.orderItem.count(),
      prisma.orderItem.count({
        where: { orderCompleted: true },
      }),
      prisma.orderItem.count({
        where: { orderCompleted: false },
      }),
    ]);

    const completionRate = totalOrderItems > 0 ? (completedOrderItems / totalOrderItems) * 100 : 0;

    res.json({
      stats: {
        totalOrderItems,
        completedOrderItems,
        pendingOrderItems,
        completionRate: Math.round(completionRate * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching order item stats:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
