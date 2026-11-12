import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  normalizeSchemeEnd,
  normalizeSchemeStart,
  schemeActiveOn,
} from "../lib/schemeDates";

// Create a new product scheme
export const createProductScheme = async (req: Request, res: Response) => {
  try {
    const {
      schemePercentage,
      slab1MinCb,
      slab1MaxCb,
      slab1Percent,
      slab2MinCb,
      slab2MaxCb,
      slab2Percent,
      slab3MinCb,
      slab3MaxCb,
      slab3Percent,
      slab4MinCb,
      slab4MaxCb,
      slab4Percent,
      startDate: startDateRaw,
      endDate: endDateRaw,
      isActive,
      productId,
    } = req.body;

    const startDate = normalizeSchemeStart(startDateRaw);
    const endDate = normalizeSchemeEnd(endDateRaw);

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check for overlapping schemes for the same product
    const overlappingScheme = await prisma.productScheme.findFirst({
      where: {
        productId,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    if (overlappingScheme) {
      return res.status(409).json({
        message:
          "A scheme already exists for this product within the specified date range",
      });
    }

    const productScheme = await prisma.productScheme.create({
      data: {
        // Keep legacy field in sync for older UIs, but slab values are the source of truth.
        schemePercentage: schemePercentage ?? slab1Percent ?? 0,
        slab1MinCb,
        slab1MaxCb,
        slab1Percent,
        slab2MinCb: slab2MinCb ?? null,
        slab2MaxCb: slab2MaxCb ?? null,
        slab2Percent: slab2Percent ?? null,
        slab3MinCb: slab3MinCb ?? null,
        slab3MaxCb: slab3MaxCb ?? null,
        slab3Percent: slab3Percent ?? null,
        slab4MinCb: slab4MinCb ?? null,
        slab4MaxCb: slab4MaxCb ?? null,
        slab4Percent: slab4Percent ?? null,
        startDate,
        endDate,
        isActive: isActive ?? false,
        productId,
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
          },
        },
      },
    });

    res.status(201).json({ productScheme });
  } catch (error) {
    console.error("Error creating product scheme:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all product schemes with pagination and filtering
export const getProductSchemes = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, productId, isActive } = req.query as any;

    // Convert string values to numbers
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === true || isActive === "true";
    }

    const [productSchemes, total] = await Promise.all([
      prisma.productScheme.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          Product: {
            select: {
              id: true,
              name: true,
              productCode: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.productScheme.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      productSchemes,
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
    console.error("Error fetching product schemes:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single product scheme by ID
export const getProductSchemeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const productScheme = await prisma.productScheme.findUnique({
      where: { id },
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
    });

    if (!productScheme) {
      return res.status(404).json({ message: "Product scheme not found" });
    }

    res.json({ productScheme });
  } catch (error) {
    console.error("Error fetching product scheme:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get active schemes for a specific product
export const getActiveSchemesByProduct = async (
  req: Request,
  res: Response
) => {
  try {
    const { productId } = req.params;
    const { startOfDay, endOfDay } = schemeActiveOn(new Date());

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const activeSchemes = await prisma.productScheme.findMany({
      where: {
        productId,
        isActive: true,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ activeSchemes });
  } catch (error) {
    console.error("Error fetching active schemes:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a product scheme
export const updateProductScheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if product scheme exists
    const existingScheme = await prisma.productScheme.findUnique({
      where: { id },
    });

    if (!existingScheme) {
      return res.status(404).json({ message: "Product scheme not found" });
    }

    // If product is being changed, verify it exists
    if (updateData.productId && updateData.productId !== existingScheme.productId) {
      const product = await prisma.product.findUnique({
        where: { id: updateData.productId },
      });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
    }

    // Check for overlapping schemes if dates are being updated
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate
        ? normalizeSchemeStart(updateData.startDate)
        : existingScheme.startDate;
      const endDate = updateData.endDate
        ? normalizeSchemeEnd(updateData.endDate)
        : existingScheme.endDate;
      const productId = updateData.productId || existingScheme.productId;

      const overlappingScheme = await prisma.productScheme.findFirst({
        where: {
          productId,
          id: { not: id }, // Exclude current scheme
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (overlappingScheme) {
        return res.status(409).json({
          message:
            "A scheme already exists for this product within the specified date range",
        });
      }
    }

    // Keep legacy field in sync when slabs are updated.
    if (updateData.slab1Percent !== undefined && updateData.schemePercentage === undefined) {
      updateData.schemePercentage = updateData.slab1Percent;
    }

    // Normalize date bounds to inclusive IST calendar days
    if (updateData.startDate) {
      updateData.startDate = normalizeSchemeStart(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = normalizeSchemeEnd(updateData.endDate);
    }

    const productScheme = await prisma.productScheme.update({
      where: { id },
      data: updateData,
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
          },
        },
      },
    });

    res.json({ productScheme });
  } catch (error) {
    console.error("Error updating product scheme:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a product scheme
export const deleteProductScheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if product scheme exists
    const existingScheme = await prisma.productScheme.findUnique({
      where: { id },
    });

    if (!existingScheme) {
      return res.status(404).json({ message: "Product scheme not found" });
    }

    await prisma.productScheme.delete({
      where: { id },
    });

    res.json({ message: "Product scheme deleted successfully" });
  } catch (error) {
    console.error("Error deleting product scheme:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Activate/Deactivate a product scheme
export const toggleProductSchemeStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Check if product scheme exists
    const existingScheme = await prisma.productScheme.findUnique({
      where: { id },
    });

    if (!existingScheme) {
      return res.status(404).json({ message: "Product scheme not found" });
    }

    const productScheme = await prisma.productScheme.update({
      where: { id },
      data: { isActive },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
          },
        },
      },
    });

    res.json({ productScheme });
  } catch (error) {
    console.error("Error toggling product scheme status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

