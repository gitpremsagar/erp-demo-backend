import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";

const INDIA_TIMEZONE = "Asia/Kolkata";

/** Start of today's calendar date in India (IST), as an ISO-8601 string. */
function getIndiaTodayStartIsoString(): string {
  const ymd = new Date().toLocaleDateString("en-CA", {
    timeZone: INDIA_TIMEZONE,
  });
  return `${ymd}T00:00:00.000+05:30`;
}

function getCalendarYearMonthIndia(isoDateString: string | Date): {
  year: number;
  month0: number;
} {
  const d = typeof isoDateString === "string" ? new Date(isoDateString) : isoDateString;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month0 = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return { year, month0 };
}

/** Start/end of that calendar month in IST (inclusive range for queries). */
function getIndiaMonthRangeFromIsoDate(isoDateString: string | Date): {
  startOfMonth: Date;
  endOfMonth: Date;
} {
  const { year, month0 } = getCalendarYearMonthIndia(isoDateString);
  const m = month0 + 1;
  const mm = String(m).padStart(2, "0");
  const startOfMonth = new Date(`${year}-${mm}-01T00:00:00.000+05:30`);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const dd = String(daysInMonth).padStart(2, "0");
  const endOfMonth = new Date(`${year}-${mm}-${dd}T23:59:59.999+05:30`);
  return { startOfMonth, endOfMonth };
}

// Create a new forecast with forecast items
export const createForecast = async (req: Request, res: Response) => {
  try {
    const { distributorId, forecastDate, forecastItems } = req.body;

    // Default to today's date in India (IST) if forecastDate is not provided
    const finalForecastDate = forecastDate || getIndiaTodayStartIsoString();

    // Check if distributor exists
    const distributor = await prisma.user.findUnique({
      where: { id: distributorId },
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    // Check if a forecast already exists for this distributor in the same month/year (India calendar)
    const { year, month0 } = getCalendarYearMonthIndia(finalForecastDate);
    const { startOfMonth, endOfMonth } =
      getIndiaMonthRangeFromIsoDate(finalForecastDate);

    const existingForecast = await prisma.forecast.findFirst({
      where: {
        distributorId,
        forecastDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    if (existingForecast) {
      return res.status(409).json({
        message: `A forecast already exists for this distributor in ${year}-${String(month0 + 1).padStart(2, "0")}`,
      });
    }

    // Check if all products exist (single query)
    const productIds = [...new Set(forecastItems.map((item: { productId: string }) => item.productId as string))] as string[];
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missingId = productIds.find((id: string) => !existingIds.has(id));
    if (missingId) {
      return res
        .status(404)
        .json({ message: `Product with ID ${missingId} not found` });
    }

    // Create forecast and forecast items in a transaction
    const forecast = await prisma.$transaction(
      async (tx) => {
        // Create the forecast
        const newForecast = await tx.forecast.create({
          data: {
            distributorId,
            forecastDate: new Date(finalForecastDate),
          },
        });

        // Create forecast items in one batch
        await tx.forecastItem.createMany({
          data: forecastItems.map((item: { productId: string; quantity: number }) => ({
            forecastId: newForecast.id,
            productId: item.productId,
            distributorId,
            forecastDate: new Date(finalForecastDate),
            quantity: item.quantity,
          })),
        });

        return newForecast;
      },
      { timeout: 20_000 },
    );

    // Get the complete forecast with items
    const completeForecast = await prisma.forecast.findUnique({
      where: { id: forecast.id },
      include: {
        Distributor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ForecastItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                productCode: true,
                mrp: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ forecast: completeForecast });
  } catch (error) {
    console.error("Error creating forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all forecasts with pagination and filtering
export const getForecasts = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 100,
      distributorId,
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {};

    if (distributorId) {
      where.distributorId = distributorId;
    }

    if (startDate || endDate) {
      where.forecastDate = {};
      if (startDate) {
        where.forecastDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.forecastDate.lte = new Date(endDate as string);
      }
    }

    const [forecasts, total] = await Promise.all([
      prisma.forecast.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          Distributor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          ForecastItem: {
            include: {
              Product: {
                select: {
                  id: true,
                  name: true,
                  productCode: true,
                  mrp: true,
                },
              },
            },
          },
        },
        orderBy: {
          forecastDate: "desc",
        },
      }),
      prisma.forecast.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      forecasts,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching forecasts:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single forecast by ID
export const getForecastById = async (req: Request, res: Response) => {
  try {
    const { forecastId } = req.params;

    const forecast = await prisma.forecast.findUnique({
      where: { id: forecastId },
      include: {
        Distributor: {
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            CustomerDetail: {
              select: {
                dbCategory: true,
              },
            },
          },
        },
        ForecastItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                costPricePerCarton: true,
                costPricePerCartonWithGst: true,
                sellingPricePerCartonForDb: true,
                sellingPricePerCartonForDbWithGst: true,
                sellingPricePerCartonForRss: true,
                sellingPricePerCartonForRssWithGst: true,
                productCode: true,
                mrp: true,
              },
            },
          },
        },
      },
    });

    if (!forecast) {
      return res.status(404).json({ message: "Forecast not found" });
    }

    res.json({ forecast });
  } catch (error) {
    console.error("Error fetching forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get forecast detail report: comparison (Forecast vs Billed vs Balance) and products not in forecast
export const getForecastDetailReport = async (req: Request, res: Response) => {
  try {
    const { forecastId } = req.params;

    const forecast = await prisma.forecast.findUnique({
      where: { id: forecastId },
      include: {
        Distributor: {
          select: {
            id: true,
            name: true,
            email: true,
            userType: true,
            CustomerDetail: {
              select: {
                dbCategory: true,
              },
            },
          },
        },
        ForecastItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                Category: { select: { id: true, name: true } },
                costPricePerCarton: true,
                costPricePerCartonWithGst: true,
                sellingPricePerCartonForDb: true,
                sellingPricePerCartonForDbWithGst: true,
                sellingPricePerCartonForRss: true,
                sellingPricePerCartonForRssWithGst: true,
                productCode: true,
                mrp: true,
              },
            },
          },
        },
      },
    });

    if (!forecast) {
      return res.status(404).json({ message: "Forecast not found" });
    }

    const { startOfMonth, endOfMonth } = getIndiaMonthRangeFromIsoDate(
      forecast.forecastDate,
    );
    const { year, month0 } = getCalendarYearMonthIndia(forecast.forecastDate);

    // Billed: orders for this distributor in the same month (completed via dynamic status)
    const ordersInMonth = await prisma.order.findMany({
      where: {
        customerId: forecast.distributorId,
        orderDate: { gte: startOfMonth, lte: endOfMonth },
        orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID,
      },
      select: { id: true },
    });

    const orderIds = ordersInMonth.map((o) => o.id);

    const billedItems =
      orderIds.length > 0
        ? await prisma.orderItem.groupBy({
          by: ["productId"],
          where: { orderId: { in: orderIds } },
          _sum: { quantity: true },
        })
        : [];
    const billedByProduct: Record<string, number> = {};
    for (const row of billedItems) {
      billedByProduct[row.productId] = row._sum.quantity ?? 0;
    }

    const comparison = forecast.ForecastItem.map((item) => {
      const forecastQty = item.quantity;
      const billedQty = billedByProduct[item.productId] ?? 0;
      const balance = forecastQty - billedQty;
      return {
        productId: item.productId,
        productName: item.Product.name,
        productCode: item.Product.productCode,
        mrp: item.Product.mrp,
        forecastQty,
        billedQty,
        balance,
        product: item.Product,
      };
    });

    const forecastProductIds = forecast.ForecastItem.map((f) => f.productId);
    const rawProductsNotInForecast = await prisma.product.findMany({
      where: { id: { notIn: forecastProductIds } },
      select: {
        id: true,
        name: true,
        productCode: true,
        mrp: true,
        categoryId: true,
        Category: { select: { id: true, name: true } },
        costPricePerCarton: true,
        costPricePerCartonWithGst: true,
        sellingPricePerCartonForDb: true,
        sellingPricePerCartonForDbWithGst: true,
        sellingPricePerCartonForRss: true,
        sellingPricePerCartonForRssWithGst: true,
      },
      orderBy: { name: "asc" },
    });

    const productsNotInForecast = rawProductsNotInForecast.map((p) => {
      const billedQty = billedByProduct[p.id] ?? 0;
      return {
        ...p,
        billedQty,
        product: p,
      };
    });

    res.json({
      forecast,
      comparison,
      productsNotInForecast,
      monthYear: { year, month: month0 + 1 },
    });
  } catch (error) {
    console.error("Error fetching forecast detail report:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a forecast
export const updateForecast = async (req: Request, res: Response) => {
  try {
    const { forecastId } = req.params;
    const { distributorId, forecastDate, forecastItems } = req.body;

    // Check if forecast exists
    const existingForecast = await prisma.forecast.findUnique({
      where: { id: forecastId },
      include: {
        ForecastItem: true,
      },
    });

    if (!existingForecast) {
      return res.status(404).json({ message: "Forecast not found" });
    }

    // Validate related entities if provided
    if (distributorId) {
      const distributor = await prisma.user.findUnique({
        where: { id: distributorId },
      });
      if (!distributor) {
        return res.status(404).json({ message: "Distributor not found" });
      }
    }

    // Update forecast and related data in a transaction
    await prisma.$transaction(
      async (tx) => {
        // Update the forecast - only update fields that are provided
        const updateData: any = {};

        if (distributorId !== undefined) {
          updateData.distributorId = distributorId;
        }
        if (forecastDate !== undefined) {
          updateData.forecastDate = new Date(forecastDate);
        }

        await tx.forecast.update({
          where: { id: forecastId },
          data: updateData,
        });

        // Handle forecast items updates if provided
        if (forecastItems && forecastItems.length > 0) {
          // Delete existing forecast items
          await tx.forecastItem.deleteMany({
            where: { forecastId },
          });

          // Create new forecast items in one batch
          const effectiveDistributorId = distributorId ?? existingForecast.distributorId;
          const effectiveForecastDate = forecastDate
            ? new Date(forecastDate)
            : existingForecast.forecastDate;

          await tx.forecastItem.createMany({
            data: forecastItems.map((item: { productId: string; quantity: number }) => ({
              forecastId,
              productId: item.productId,
              distributorId: effectiveDistributorId,
              forecastDate: effectiveForecastDate,
              quantity: item.quantity,
            })),
          });
        }
      },
      { timeout: 20_000 },
    );

    // Get the complete updated forecast with all relations
    const completeForecast = await prisma.forecast.findUnique({
      where: { id: forecastId },
      include: {
        Distributor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ForecastItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true,
                productCode: true,
                mrp: true,
              },
            },
          },
        },
      },
    });

    res.json({
      forecast: completeForecast,
      updatedForecastItems: completeForecast?.ForecastItem ?? [],
    });
  } catch (error) {
    console.error("Error updating forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a forecast
export const deleteForecast = async (req: Request, res: Response) => {
  try {
    const { forecastId } = req.params;

    // Check if forecast exists
    const forecast = await prisma.forecast.findUnique({
      where: { id: forecastId },
      include: {
        ForecastItem: true,
      },
    });

    if (!forecast) {
      return res.status(404).json({ message: "Forecast not found" });
    }

    // Delete forecast items and forecast
    await prisma.$transaction(async (tx) => {
      await tx.forecastItem.deleteMany({
        where: { forecastId: forecastId },
      });

      await tx.forecast.delete({
        where: { id: forecastId },
      });
    });

    res.json({ message: "Forecast deleted successfully" });
  } catch (error) {
    console.error("Error deleting forecast:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get forecasts by distributor ID (via query parameter)
export const getForecastsByDistributor = async (req: Request, res: Response) => {
  const { distributorId } = req.params;
  try {
    const {
      page = 1,
      limit = 1000,
      startDate,
      endDate,
    } = req.query;

    // Validate distributorId is provided
    if (!distributorId) {
      return res.status(400).json({ message: "distributorId query parameter is required" });
    }

    // Check if distributor exists
    const distributor = await prisma.user.findUnique({
      where: { id: distributorId as string },
    });

    if (!distributor) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {
      distributorId: distributorId as string,
    };

    if (startDate || endDate) {
      where.forecastDate = {};
      if (startDate) {
        where.forecastDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.forecastDate.lte = new Date(endDate as string);
      }
    }

    const [forecasts, total] = await Promise.all([
      prisma.forecast.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          forecastDate: true,
        },
        orderBy: {
          forecastDate: "desc",
        },
      }),
      prisma.forecast.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      forecasts,
      distributor: {
        id: distributor.id,
        name: distributor.name,
        email: distributor.email,
      },
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching forecasts by distributor:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get forecast statistics
export const getForecastStats = async (req: Request, res: Response) => {
  try {
    const { distributorId, startDate, endDate } = req.query;

    const forecastWhere: any = {};
    const forecastItemWhere: any = {};

    if (distributorId) {
      forecastWhere.distributorId = distributorId;
      forecastItemWhere.distributorId = distributorId;
    }

    if (startDate || endDate) {
      forecastWhere.forecastDate = {};
      forecastItemWhere.forecastDate = {};
      if (startDate) {
        forecastWhere.forecastDate.gte = new Date(startDate as string);
        forecastItemWhere.forecastDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        forecastWhere.forecastDate.lte = new Date(endDate as string);
        forecastItemWhere.forecastDate.lte = new Date(endDate as string);
      }
    }

    const [totalForecasts, totalQuantity, forecastsByProduct] = await Promise.all([
      prisma.forecast.count({ where: forecastWhere }),
      prisma.forecastItem.aggregate({
        where: forecastItemWhere,
        _sum: {
          quantity: true,
        },
      }),
      prisma.forecastItem.groupBy({
        by: ["productId"],
        where: forecastItemWhere,
        _sum: {
          quantity: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    res.json({
      totalForecasts,
      totalQuantity: totalQuantity._sum.quantity || 0,
      forecastsByProduct,
    });
  } catch (error) {
    console.error("Error fetching forecast statistics:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
