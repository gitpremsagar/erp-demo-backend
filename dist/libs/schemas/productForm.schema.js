"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductQuerySchema = exports.UpdateProductSchema = exports.CreateProductSchema = void 0;
const zod_1 = require("zod");
exports.CreateProductSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .min(1, "Product name is required")
        .max(200, "Product name must be at most 200 characters long")
        .trim(),
    mrp: zod_1.z
        .number()
        .min(0, "MRP cannot be negative"),
    productCode: zod_1.z
        .string()
        .min(1, "Product code is required")
        .max(50, "Product code must be at most 50 characters long")
        .trim(),
    lowStockLimit: zod_1.z
        .number()
        .int("Low stock limit must be an integer")
        .min(0, "Low stock limit cannot be negative")
        .optional(),
    overStockLimit: zod_1.z
        .number()
        .int("Over stock limit must be an integer")
        .min(0, "Over stock limit cannot be negative")
        .optional(),
    categoryId: zod_1.z
        .string()
        .min(24, "Invalid category ID")
        .max(24, "Invalid category ID"),
    subCategoryId: zod_1.z
        .string()
        .min(24, "Invalid sub-category ID")
        .max(24, "Invalid sub-category ID")
        .nullish(),
    grammage: zod_1.z
        .number()
        .min(0, "Grammage cannot be negative")
        .optional(),
    imageUrl: zod_1.z
        .string()
        .url("Invalid image URL format")
        .trim()
        .optional(),
    productGroupId: zod_1.z
        .string()
        .min(24, "Invalid product group ID")
        .max(24, "Invalid product group ID")
        .optional(),
    tagIds: zod_1.z.array(zod_1.z.string().min(24, "Invalid tag ID").max(24, "Invalid tag ID")).optional(),
    // New fields
    lifeOfProduct: zod_1.z
        .number()
        .min(0, "Life of product cannot be negative")
        .optional(),
    // Packaging Information
    cartonsPerPallet: zod_1.z
        .number()
        .int("Cartons per pallet must be an integer")
        .min(0, "Cartons per pallet cannot be negative")
        .optional(),
    packetsPerCarton: zod_1.z
        .number()
        .int("Packets per carton must be an integer")
        .min(0, "Packets per carton cannot be negative")
        .optional(),
    schemePercentage: zod_1.z
        .number()
        .min(0, "Scheme percentage cannot be negative")
        .max(100, "Scheme percentage cannot exceed 100")
        .optional(),
    plantId: zod_1.z
        .string()
        .min(24, "Invalid plant ID")
        .max(24, "Invalid plant ID")
        .optional(),
    // Pricing Information
    costPricePerPacket: zod_1.z
        .number()
        .min(0, "Cost price per packet cannot be negative")
        .optional(),
    costPricePerPacketWithGst: zod_1.z
        .number()
        .min(0, "Cost price per packet with GST cannot be negative")
        .optional(),
    costPricePerCarton: zod_1.z
        .number()
        .min(0, "Cost price per carton cannot be negative")
        .optional(),
    costPricePerCartonWithGst: zod_1.z
        .number()
        .min(0, "Cost price per carton with GST cannot be negative")
        .optional(),
    gstPercentage: zod_1.z
        .number()
        .min(0, "GST percentage cannot be negative")
        .max(100, "GST percentage cannot exceed 100")
        .optional(),
    // Selling Price Information for Distributors (DB)
    sellingPricePerPacketForDb: zod_1.z
        .number()
        .min(0, "Selling price per packet for DB cannot be negative")
        .optional(),
    sellingPricePerPacketForDbWithGst: zod_1.z
        .number()
        .min(0, "Selling price per packet for DB with GST cannot be negative")
        .optional(),
    sellingPricePerCartonForDb: zod_1.z
        .number()
        .min(0, "Selling price per carton for DB cannot be negative")
        .optional(),
    sellingPricePerCartonForDbWithGst: zod_1.z
        .number()
        .min(0, "Selling price per carton for DB with GST cannot be negative")
        .optional(),
    marginPercentageForDb: zod_1.z
        .number()
        .optional(),
    // Selling Price Information for Distributors (RSS)
    sellingPricePerPacketForRss: zod_1.z
        .number()
        .min(0, "Selling price per packet for RSS cannot be negative")
        .optional(),
    sellingPricePerPacketForRssWithGst: zod_1.z
        .number()
        .min(0, "Selling price per packet for RSS with GST cannot be negative")
        .optional(),
    sellingPricePerCartonForRss: zod_1.z
        .number()
        .min(0, "Selling price per carton for RSS cannot be negative")
        .optional(),
    sellingPricePerCartonForRssWithGst: zod_1.z
        .number()
        .min(0, "Selling price per carton for RSS with GST cannot be negative")
        .optional(),
    marginPercentageForRss: zod_1.z
        .number()
        .optional(),
    marginDiff: zod_1.z
        .number()
        .optional(),
    festivePricePerPacket: zod_1.z
        .number()
        .min(0, "Festive price per packet cannot be negative")
        .optional(),
    festivePricePerCarton: zod_1.z
        .number()
        .min(0, "Festive price per carton cannot be negative")
        .optional(),
    isDiscontinued: zod_1.z.boolean().optional(),
    positionSerialNumber: zod_1.z
        .number()
        .int("Position serial number must be an integer")
        .min(0, "Position serial number cannot be negative")
        .nullish(),
});
exports.UpdateProductSchema = exports.CreateProductSchema.partial();
exports.ProductQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 10),
    search: zod_1.z.string().optional(),
    categoryId: zod_1.z.string().optional(),
    subCategoryId: zod_1.z.string().optional(),
    productGroupId: zod_1.z.string().optional(),
    minPrice: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    maxPrice: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    minMrp: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    maxMrp: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    minGrammage: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    maxGrammage: zod_1.z.string().optional().transform(val => val ? parseInt(val) : undefined),
    productTagIds: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
    excludeDiscontinued: zod_1.z.string().optional(),
    hideZeroQuantity: zod_1.z.string().optional(),
    view: zod_1.z.enum(["list"]).optional(),
});
//# sourceMappingURL=productForm.schema.js.map