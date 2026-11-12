import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z
    .string()
    .min(1, "Product name is required")
    .max(200, "Product name must be at most 200 characters long")
    .trim(),
  mrp: z
    .number()
    .min(0, "MRP cannot be negative"),
  productCode: z
    .string()
    .min(1, "Product code is required")
    .max(50, "Product code must be at most 50 characters long")
    .trim(),
  lowStockLimit: z
    .number()
    .int("Low stock limit must be an integer")
    .min(0, "Low stock limit cannot be negative")
    .optional(),
  overStockLimit: z
    .number()
    .int("Over stock limit must be an integer")
    .min(0, "Over stock limit cannot be negative")
    .optional(),
  categoryId: z
    .string()
    .min(24, "Invalid category ID")
    .max(24, "Invalid category ID"),
  subCategoryId: z
    .string()
    .min(24, "Invalid sub-category ID")
    .max(24, "Invalid sub-category ID")
    .nullish(),
  grammage: z
    .number()
    .min(0, "Grammage cannot be negative")
    .optional(),
  imageUrl: z
    .string()
    .url("Invalid image URL format")
    .trim()
    .optional(),
  productGroupId: z
    .string()
    .min(24, "Invalid product group ID")
    .max(24, "Invalid product group ID")
    .optional(),
  tagIds: z.array(z.string().min(24, "Invalid tag ID").max(24, "Invalid tag ID")).optional(),

  // New fields
  lifeOfProduct: z
    .number()
    .min(0, "Life of product cannot be negative")
    .optional(),

  // Packaging Information
  cartonsPerPallet: z
    .number()
    .int("Cartons per pallet must be an integer")
    .min(0, "Cartons per pallet cannot be negative")
    .optional(),
  packetsPerCarton: z
    .number()
    .int("Packets per carton must be an integer")
    .min(0, "Packets per carton cannot be negative")
    .optional(),
  schemePercentage: z
    .number()
    .min(0, "Scheme percentage cannot be negative")
    .max(100, "Scheme percentage cannot exceed 100")
    .optional(),
  plantId: z
    .string()
    .min(24, "Invalid plant ID")
    .max(24, "Invalid plant ID")
    .optional(),

  // Pricing Information
  costPricePerPacket: z
    .number()
    .min(0, "Cost price per packet cannot be negative")
    .optional(),
  costPricePerPacketWithGst: z
    .number()
    .min(0, "Cost price per packet with GST cannot be negative")
    .optional(),
  costPricePerCarton: z
    .number()
    .min(0, "Cost price per carton cannot be negative")
    .optional(),
  costPricePerCartonWithGst: z
    .number()
    .min(0, "Cost price per carton with GST cannot be negative")
    .optional(),
  gstPercentage: z
    .number()
    .min(0, "GST percentage cannot be negative")
    .max(100, "GST percentage cannot exceed 100")
    .optional(),

  // Selling Price Information for Distributors (DB)
  sellingPricePerPacketForDb: z
    .number()
    .min(0, "Selling price per packet for DB cannot be negative")
    .optional(),
  sellingPricePerPacketForDbWithGst: z
    .number()
    .min(0, "Selling price per packet for DB with GST cannot be negative")
    .optional(),
  sellingPricePerCartonForDb: z
    .number()
    .min(0, "Selling price per carton for DB cannot be negative")
    .optional(),
  sellingPricePerCartonForDbWithGst: z
    .number()
    .min(0, "Selling price per carton for DB with GST cannot be negative")
    .optional(),
  marginPercentageForDb: z
    .number()
    .optional(),

  // Selling Price Information for Distributors (RSS)
  sellingPricePerPacketForRss: z
    .number()
    .min(0, "Selling price per packet for RSS cannot be negative")
    .optional(),
  sellingPricePerPacketForRssWithGst: z
    .number()
    .min(0, "Selling price per packet for RSS with GST cannot be negative")
    .optional(),
  sellingPricePerCartonForRss: z
    .number()
    .min(0, "Selling price per carton for RSS cannot be negative")
    .optional(),
  sellingPricePerCartonForRssWithGst: z
    .number()
    .min(0, "Selling price per carton for RSS with GST cannot be negative")
    .optional(),
  marginPercentageForRss: z
    .number()
    .optional(),

  marginDiff: z
    .number()
    .optional(),

  festivePricePerPacket: z
    .number()
    .min(0, "Festive price per packet cannot be negative")
    .optional(),
  festivePricePerCarton: z
    .number()
    .min(0, "Festive price per carton cannot be negative")
    .optional(),

  isDiscontinued: z.boolean().optional(),

  positionSerialNumber: z
    .number()
    .int("Position serial number must be an integer")
    .min(0, "Position serial number cannot be negative")
    .nullish(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  productGroupId: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  minMrp: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxMrp: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  minGrammage: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxGrammage: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  productTagIds: z.union([z.string(), z.array(z.string())]).optional(),
  excludeDiscontinued: z.string().optional(),
  hideZeroQuantity: z.string().optional(),
  view: z.enum(["list"]).optional(),
});
