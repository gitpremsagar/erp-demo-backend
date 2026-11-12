import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Create a new product group
export const createProductGroup = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    // Check if product group name already exists
    const existingGroup = await prisma.productGroup.findFirst({
      where: { name },
    });

    if (existingGroup) {
      return res.status(409).json({ message: "Product group with this name already exists" });
    }

    const productGroup = await prisma.productGroup.create({
      data: { name },
    });

    res.status(201).json({ productGroup });
  } catch (error) {
    console.error("Error creating product group:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all product groups with pagination and filtering
export const getProductGroups = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 1000,
      search,
    } = req.query as any;

    // Convert string values to numbers
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [productGroups, total] = await Promise.all([
      prisma.productGroup.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              Product: true,
            },
          },
        },
      }),
      prisma.productGroup.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      productGroups,
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
    console.error("Error fetching product groups:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get a single product group by ID
export const getProductGroupById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const productGroup = await prisma.productGroup.findUnique({
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
        _count: {
          select: {
            Product: true,
          },
        },
      },
    });

    if (!productGroup) {
      return res.status(404).json({ message: "Product group not found" });
    }

    res.json({ productGroup });
  } catch (error) {
    console.error("Error fetching product group:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a product group
export const updateProductGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Check if product group exists
    const existingGroup = await prisma.productGroup.findUnique({
      where: { id },
    });

    if (!existingGroup) {
      return res.status(404).json({ message: "Product group not found" });
    }

    // If name is being updated, check for uniqueness
    if (name && name !== existingGroup.name) {
      const duplicateGroup = await prisma.productGroup.findFirst({
        where: { name },
      });

      if (duplicateGroup) {
        return res.status(409).json({ message: "Product group with this name already exists" });
      }
    }

    const productGroup = await prisma.productGroup.update({
      where: { id },
      data: { name },
      include: {
        _count: {
          select: {
            Product: true,
          },
        },
      },
    });

    res.json({ productGroup });
  } catch (error) {
    console.error("Error updating product group:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a product group
export const deleteProductGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if product group exists
    const existingGroup = await prisma.productGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            Product: true,
          },
        },
      },
    });

    if (!existingGroup) {
      return res.status(404).json({ message: "Product group not found" });
    }

    // Cascade update: Set productGroupId to null for all affected products
    // Then delete the product group
    const affectedProductsCount = existingGroup._count.Product;
    
    await prisma.$transaction(async (tx) => {
      // Update all products that reference this product group
      if (affectedProductsCount > 0) {
        await tx.product.updateMany({
          where: { productGroupId: id },
          data: { productGroupId: null },
        });
      }

      // Delete the product group
      await tx.productGroup.delete({
        where: { id },
      });
    });

    const message = affectedProductsCount > 0
      ? `Product group deleted successfully. ${affectedProductsCount} product(s) had their product group reference removed.`
      : "Product group deleted successfully";

    res.json({ message });
  } catch (error) {
    console.error("Error deleting product group:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get product group statistics
export const getProductGroupStats = async (req: Request, res: Response) => {
  try {
    const [totalGroups, mostUsedGroups, emptyGroups] = await Promise.all([
      prisma.productGroup.count(),
      prisma.productGroup.findMany({
        include: {
          _count: {
            select: {
              Product: true,
            },
          },
        },
        orderBy: {
          Product: {
            _count: "desc",
          },
        },
        take: 5,
      }),
      prisma.productGroup.findMany({
        where: {
          Product: {
            none: {},
          },
        },
        include: {
          _count: {
            select: {
              Product: true,
            },
          },
        },
      }),
    ]);

    res.json({
      stats: {
        totalGroups,
        mostUsedGroups,
        emptyGroupsCount: emptyGroups.length,
        emptyGroups,
      },
    });
  } catch (error) {
    console.error("Error fetching product group stats:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

