"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateProductExternalStock = exports.updateProductExternalStock = exports.getProductChangeHistory = exports.getProductSalesAndForecastHistory = exports.getProductsForDistributor = exports.getCurrentActiveScheme = exports.getProductStats = exports.deleteProduct = exports.updateProduct = exports.getProductById = exports.getLastSoldByCustomer = exports.getDistributorOrderProductsForOrderUpdate = exports.getDistributorOrderProducts = exports.getProductLookup = exports.getProducts = exports.createProduct = void 0;
const prisma_1 = require("../lib/prisma");
const productChangeSnapshot_1 = require("../lib/productChangeSnapshot");
const schemeDates_1 = require("../lib/schemeDates");
const openingStockSnapshot_1 = require("../lib/openingStockSnapshot");
const dailyStockStatus_1 = require("../lib/dailyStockStatus");
const productListAggregates_1 = require("../lib/productListAggregates");
const productFilters_1 = require("../lib/productFilters");
const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";
/** All-time latest completed order item per product for one customer. */
async function getLastCompletedOrderItemByProduct(customerId, productIds) {
    const lastByProductId = new Map();
    if (productIds && productIds.length === 0)
        return lastByProductId;
    const allTimeLastOrders = await prisma_1.prisma.orderItem.findMany({
        where: {
            customerId,
            ...(productIds ? { productId: { in: productIds } } : {}),
            OR: [
                { orderCompleted: true },
                { Order: { orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID } },
            ],
        },
        select: {
            id: true,
            productId: true,
            quantity: true,
            orderDate: true,
            createdAt: true,
        },
    });
    for (const oi of allTimeLastOrders) {
        const current = lastByProductId.get(oi.productId);
        const currentTime = current
            ? new Date(current.orderDate ?? current.createdAt).getTime()
            : -Infinity;
        const nextTime = new Date(oi.orderDate ?? oi.createdAt).getTime();
        if (!current || nextTime > currentTime) {
            lastByProductId.set(oi.productId, oi);
        }
    }
    return lastByProductId;
}
// Create a new product
const createProduct = async (req, res) => {
    try {
        const { name, mrp, productCode, lowStockLimit, overStockLimit, categoryId, subCategoryId, grammage, imageUrl, productGroupId, tagIds, 
        // New fields
        lifeOfProduct, cartonsPerPallet, packetsPerCarton, schemePercentage, plantId, costPricePerPacket, costPricePerPacketWithGst, costPricePerCarton, costPricePerCartonWithGst, gstPercentage, sellingPricePerPacketForDb, sellingPricePerPacketForDbWithGst, sellingPricePerCartonForDb, sellingPricePerCartonForDbWithGst, marginPercentageForDb, sellingPricePerPacketForRss, sellingPricePerPacketForRssWithGst, sellingPricePerCartonForRss, sellingPricePerCartonForRssWithGst, marginPercentageForRss, isDiscontinued, positionSerialNumber, festivePricePerPacket, } = req.body;
        //calculate margin diff
        const marginDiff = marginPercentageForDb - marginPercentageForRss;
        // Validate GST percentage when provided.
        if (gstPercentage !== undefined &&
            (gstPercentage < 0 || gstPercentage > 100)) {
            return res
                .status(400)
                .json({ message: "GST percentage must be between 0 and 100" });
        }
        // Validate festive price when provided
        if (festivePricePerPacket !== undefined && festivePricePerPacket !== null && festivePricePerPacket < 0) {
            return res
                .status(400)
                .json({ message: "Festive price per packet cannot be negative" });
        }
        // Check if product code already exists
        const existingProduct = await prisma_1.prisma.product.findUnique({
            where: { productCode },
        });
        if (existingProduct) {
            return res.status(409).json({ message: "Product code already exists" });
        }
        // Verify that category exists
        const category = await prisma_1.prisma.category.findUnique({
            where: { id: categoryId },
        });
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        // Verify subcategory belongs to the selected category when provided
        if (subCategoryId) {
            const subCategory = await prisma_1.prisma.subCategory.findUnique({
                where: { id: subCategoryId },
            });
            if (!subCategory) {
                return res.status(404).json({ message: "Sub-category not found" });
            }
            if (subCategory.categoryId !== categoryId) {
                return res.status(400).json({
                    message: "Sub-category does not belong to the selected category",
                });
            }
        }
        // Verify that product group exists if provided
        if (productGroupId) {
            const productGroup = await prisma_1.prisma.productGroup.findUnique({
                where: { id: productGroupId },
            });
            if (!productGroup) {
                return res.status(404).json({ message: "Product group not found" });
            }
        }
        // Verify that plant exists if provided
        if (plantId) {
            const plant = await prisma_1.prisma.plant.findUnique({
                where: { id: plantId },
            });
            if (!plant) {
                return res.status(404).json({ message: "Plant not found" });
            }
        }
        // Create product and tag relations in a transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Create the product
            const product = await tx.product.create({
                data: {
                    name,
                    mrp,
                    productCode,
                    lowStockLimit: lowStockLimit || 0,
                    overStockLimit: overStockLimit || 0,
                    categoryId,
                    ...(subCategoryId ? { subCategoryId } : {}),
                    grammage,
                    imageUrl,
                    productGroupId,
                    // New fields
                    lifeOfProduct,
                    cartonsPerPallet,
                    packetsPerCarton,
                    schemePercentage,
                    plantId,
                    costPricePerPacket,
                    costPricePerPacketWithGst,
                    costPricePerCarton,
                    costPricePerCartonWithGst,
                    gstPercentage,
                    sellingPricePerPacketForDb,
                    sellingPricePerPacketForDbWithGst,
                    sellingPricePerCartonForDb,
                    sellingPricePerCartonForDbWithGst,
                    marginPercentageForDb,
                    sellingPricePerPacketForRss,
                    sellingPricePerPacketForRssWithGst,
                    sellingPricePerCartonForRss,
                    sellingPricePerCartonForRssWithGst,
                    marginPercentageForRss,
                    marginDiff,
                    ...(festivePricePerPacket != null
                        ? {
                            festivePricePerPacket,
                            festivePricePerCarton: packetsPerCarton && packetsPerCarton > 0
                                ? parseFloat((festivePricePerPacket * packetsPerCarton).toFixed(4))
                                : null,
                        }
                        : {}),
                    ...(isDiscontinued !== undefined ? { isDiscontinued } : {}),
                    ...(positionSerialNumber !== undefined
                        ? { positionSerialNumber }
                        : {}),
                },
                include: {
                    Category: true,
                    SubCategory: true,
                    ProductGroup: true,
                    Plant: true,
                    ProductScheme: true,
                },
            });
            // Create product tag relations if tagIds are provided
            const tagRelations = [];
            if (tagIds && tagIds.length > 0) {
                // Verify that all tag IDs exist
                const existingTags = await tx.productTag.findMany({
                    where: { id: { in: tagIds } },
                });
                if (existingTags.length !== tagIds.length) {
                    throw new Error("One or more tag IDs do not exist");
                }
                // Create the relations
                for (const tag of existingTags) {
                    await tx.productTagRelation.create({
                        data: {
                            productId: product.id,
                            productTagId: tag.id,
                        },
                    });
                    tagRelations.push({
                        productTagId: tag.id,
                        ProductTag: { name: tag.name },
                    });
                }
            }
            await tx.productChangeHistory.create({
                data: (0, productChangeSnapshot_1.buildProductChangeSnapshot)(product, tagRelations, "CREATE"),
            });
            return { product, tagRelations };
        });
        res.status(201).json({
            product: result.product,
            tagRelations: result.tagRelations,
        });
    }
    catch (error) {
        console.error("Error creating product:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createProduct = createProduct;
const PRODUCT_LIST_SELECT = {
    id: true,
    name: true,
    mrp: true,
    productCode: true,
    lowStockLimit: true,
    overStockLimit: true,
    categoryId: true,
    subCategoryId: true,
    createdAt: true,
    updatedAt: true,
    grammage: true,
    productGroupId: true,
    lifeOfProduct: true,
    cartonsPerPallet: true,
    packetsPerCarton: true,
    schemePercentage: true,
    plantId: true,
    isDiscontinued: true,
    positionSerialNumber: true,
    gstPercentage: true,
    costPricePerPacket: true,
    costPricePerPacketWithGst: true,
    costPricePerCarton: true,
    costPricePerCartonWithGst: true,
    sellingPricePerPacketForDb: true,
    sellingPricePerPacketForDbWithGst: true,
    sellingPricePerCartonForDb: true,
    sellingPricePerCartonForDbWithGst: true,
    marginPercentageForDb: true,
    sellingPricePerPacketForRss: true,
    sellingPricePerPacketForRssWithGst: true,
    sellingPricePerCartonForRss: true,
    sellingPricePerCartonForRssWithGst: true,
    marginPercentageForRss: true,
    marginDiff: true,
    Category: { select: { id: true, name: true } },
    ProductGroup: { select: { id: true, name: true } },
    Plant: { select: { id: true, name: true } },
};
const PRODUCT_FULL_INCLUDE = {
    Category: { select: { id: true, name: true } },
    SubCategory: { select: { id: true, name: true } },
    ProductGroup: { select: { id: true, name: true } },
    Plant: { select: { id: true, name: true } },
    ProductTagRelation: {
        include: {
            ProductTag: { select: { id: true, name: true } },
        },
    },
    StockBatch: {
        where: { stockQuantity: { gt: 0 } },
        select: {
            id: true,
            manufacturingDate: true,
            arrivalDate: true,
            expiryDate: true,
            stockQuantity: true,
        },
    },
    ProductScheme: {
        where: { isActive: true },
        select: {
            id: true,
            productId: true,
            schemePercentage: true,
            slab1MinCb: true,
            slab1MaxCb: true,
            slab1Percent: true,
            slab2MinCb: true,
            slab2MaxCb: true,
            slab2Percent: true,
            slab3MinCb: true,
            slab3MaxCb: true,
            slab3Percent: true,
            slab4MinCb: true,
            slab4MaxCb: true,
            slab4Percent: true,
            startDate: true,
            endDate: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    },
};
// Get all products with pagination and filtering
const getProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, categoryId, subCategoryId, productGroupId, minPrice, maxPrice, minMrp, maxMrp, minGrammage, maxGrammage, productTagIds, excludeDiscontinued, hideZeroQuantity, view, } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        const isListView = view === "list";
        const where = {};
        const andParts = [];
        if (search) {
            const escapedSearch = (0, productFilters_1.escapeMongoContains)(String(search));
            andParts.push({
                OR: [
                    { name: { contains: escapedSearch, mode: "insensitive" } },
                    { productCode: { contains: escapedSearch, mode: "insensitive" } },
                ],
            });
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (subCategoryId) {
            where.subCategoryId = subCategoryId;
        }
        if (productGroupId) {
            where.productGroupId = productGroupId;
        }
        const effectiveMinMrp = minMrp ?? minPrice;
        const effectiveMaxMrp = maxMrp ?? maxPrice;
        if (effectiveMinMrp !== undefined || effectiveMaxMrp !== undefined) {
            where.mrp = {};
            if (effectiveMinMrp !== undefined)
                where.mrp.gte = Number(effectiveMinMrp);
            if (effectiveMaxMrp !== undefined)
                where.mrp.lte = Number(effectiveMaxMrp);
        }
        if (minGrammage !== undefined || maxGrammage !== undefined) {
            where.grammage = {};
            if (minGrammage !== undefined)
                where.grammage.gte = Number(minGrammage);
            if (maxGrammage !== undefined)
                where.grammage.lte = Number(maxGrammage);
        }
        if (productTagIds) {
            const tagIds = Array.isArray(productTagIds)
                ? productTagIds
                : productTagIds.split(",").map((id) => id.trim());
            where.ProductTagRelation = {
                some: {
                    productTagId: { in: tagIds },
                },
            };
        }
        if (excludeDiscontinued === "true") {
            andParts.push(productFilters_1.NOT_DISCONTINUED_PRODUCT_WHERE);
        }
        if (andParts.length > 0) {
            where.AND = andParts;
        }
        if (hideZeroQuantity === "true") {
            where.StockBatch = {
                some: { stockQuantity: { gt: 0 } },
            };
        }
        const productRows = isListView
            ? await prisma_1.prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                select: PRODUCT_LIST_SELECT,
                orderBy: { createdAt: "desc" },
            })
            : await prisma_1.prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                include: PRODUCT_FULL_INCLUDE,
                orderBy: { createdAt: "desc" },
            });
        const productIds = productRows.map((product) => product.id);
        let products;
        if (isListView) {
            const [lastOrderByProductId, stockByProductId, schemesByProductId] = await Promise.all([
                (0, productListAggregates_1.fetchLastOrderDateByProductId)(productIds),
                (0, productListAggregates_1.fetchInStockSummaryByProductId)(productIds),
                (0, productListAggregates_1.fetchActiveSchemesByProductId)(productIds),
            ]);
            products = productRows.map((product) => {
                const stock = stockByProductId.get(product.id);
                const lastOrderDate = lastOrderByProductId.get(product.id) ?? null;
                const oldestArrivalDate = stock?.oldestArrivalDate ?? null;
                const nearestExpiryDate = stock?.nearestExpiryDate ?? null;
                const stockQuantity = stock?.stockQuantity ?? 0;
                return {
                    ...product,
                    ProductTagRelation: [],
                    ProductScheme: schemesByProductId.get(product.id) ?? [],
                    stockQuantity,
                    oldestArrivalDate,
                    nearestExpiryDate,
                    lastOrderDate,
                    StockBatch: stockQuantity > 0
                        ? [
                            {
                                id: product.id,
                                manufacturingDate: oldestArrivalDate,
                                arrivalDate: oldestArrivalDate,
                                expiryDate: nearestExpiryDate,
                                stockQuantity,
                            },
                        ]
                        : [],
                    OrderItem: lastOrderDate ? [{ orderDate: lastOrderDate }] : [],
                };
            });
        }
        else {
            const lastOrderByProductId = await (0, productListAggregates_1.fetchLastOrderDateByProductId)(productIds);
            products = productRows.map((product) => {
                const lastOrderDate = lastOrderByProductId.get(product.id) ?? null;
                return {
                    ...product,
                    lastOrderDate,
                    OrderItem: lastOrderDate ? [{ orderDate: lastOrderDate }] : [],
                };
            });
        }
        const total = isListView
            ? productRows.length
            : await prisma_1.prisma.product.count({ where });
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching products:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProducts = getProducts;
/** Slim catalog for purchase autosuggest / Excel import — id, name, productCode only. */
const getProductLookup = async (req, res) => {
    try {
        const products = await prisma_1.prisma.product.findMany({
            select: { id: true, name: true, productCode: true },
            orderBy: { name: "asc" },
        });
        res.json({ products });
    }
    catch (error) {
        console.error("Error fetching product lookup:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductLookup = getProductLookup;
const getDistributorOrderProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, productTagIds, distributorId, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { productCode: { contains: search, mode: "insensitive" } },
            ];
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.mrp = {};
            if (minPrice !== undefined)
                where.mrp.gte = minPrice;
            if (maxPrice !== undefined)
                where.mrp.lte = maxPrice;
        }
        if (productTagIds) {
            // Handle both single tag ID and multiple tag IDs
            const tagIds = Array.isArray(productTagIds)
                ? productTagIds
                : productTagIds.split(",").map((id) => id.trim());
            where.ProductTagRelation = {
                some: {
                    productTagId: {
                        in: tagIds,
                    },
                },
            };
        }
        // Sales officers and distributors must not see discontinued products (admins still do).
        const userType = req.user?.userType;
        if (userType === "SALES_OFFICER" || userType === "CUSTOMER") {
            where.AND = [
                {
                    OR: [
                        { isDiscontinued: false },
                        { isDiscontinued: null },
                        { isDiscontinued: { isSet: false } },
                    ],
                },
            ];
        }
        // Only show products with stock quantity > 0
        // where.StockBatch = {
        //   some: {
        //     stockQuantity: {
        //       gt: 0,
        //     },
        //   },
        // };
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setHours(0, 0, 0, 0);
        // Fetch products with their order items
        const [productsData, total] = await Promise.all([
            prisma_1.prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    Category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    ProductGroup: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    Plant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    ProductTagRelation: {
                        include: {
                            ProductTag: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    StockBatch: {
                        select: {
                            id: true,
                            manufacturingDate: true,
                            arrivalDate: true,
                            expiryDate: true,
                            stockQuantity: true,
                        },
                    },
                    ProductScheme: {
                        orderBy: {
                            createdAt: "desc",
                        },
                    },
                    ForecastItem: {
                        where: {
                            distributorId,
                            forecastDate: {
                                gte: twoMonthsAgo,
                            },
                        },
                        select: {
                            id: true,
                            forecastDate: true,
                            quantity: true,
                        },
                        orderBy: {
                            forecastDate: "desc",
                        },
                    },
                    OrderItem: {
                        where: {
                            customerId: distributorId,
                            orderDate: {
                                gte: twoMonthsAgo,
                            },
                        },
                        select: {
                            id: true,
                            quantity: true,
                            orderDate: true,
                        },
                        orderBy: {
                            orderDate: "desc",
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.product.count({ where }),
        ]);
        // `OrderItem` is intentionally restricted to the recent window (used for current-month totals).
        // For the "never sold" marker we need the true latest order for this distributor across all time.
        const productIds = productsData.map((p) => p.id);
        const lastOrderItemByProductId = distributorId
            ? await getLastCompletedOrderItemByProduct(distributorId, productIds)
            : new Map();
        const products = productsData.map((product) => {
            const last = lastOrderItemByProductId.get(product.id);
            return {
                ...product,
                LastOrderItem: last
                    ? [
                        {
                            id: last.id,
                            quantity: last.quantity,
                            orderDate: (last.orderDate ?? last.createdAt),
                        },
                    ]
                    : [],
            };
        });
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching products:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getDistributorOrderProducts = getDistributorOrderProducts;
/**
 * Get products for a specific distributor order (modify-order view).
 * This endpoint is similar to getDistributorOrderProducts but additionally
 * returns an `availableForOrder` field per product which is calculated as:
 * current remaining stock in batches + quantity reserved for the given order.
 */
const getDistributorOrderProductsForOrderUpdate = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, productTagIds, } = req.query;
        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }
        // Find order to determine distributor (customer) id
        const order = await prisma_1.prisma.order.findUnique({
            where: { id: orderId },
            select: { customerId: true },
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const distributorId = order.customerId;
        // Collect reserved quantities for this order per product
        const orderItems = await prisma_1.prisma.orderItem.findMany({
            where: { orderId },
            select: {
                productId: true,
                quantity: true,
            },
        });
        const reservedByProductId = {};
        for (const item of orderItems) {
            reservedByProductId[item.productId] =
                (reservedByProductId[item.productId] || 0) + item.quantity;
        }
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Build where clause
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { productCode: { contains: search, mode: "insensitive" } },
            ];
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.mrp = {};
            if (minPrice !== undefined)
                where.mrp.gte = minPrice;
            if (maxPrice !== undefined)
                where.mrp.lte = maxPrice;
        }
        if (productTagIds) {
            // Handle both single tag ID and multiple tag IDs
            const tagIds = Array.isArray(productTagIds)
                ? productTagIds
                : productTagIds.split(",").map((id) => id.trim());
            where.ProductTagRelation = {
                some: {
                    productTagId: {
                        in: tagIds,
                    },
                },
            };
        }
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        twoMonthsAgo.setHours(0, 0, 0, 0);
        const [productsData, total] = await Promise.all([
            prisma_1.prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    Category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    ProductGroup: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    Plant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    ProductTagRelation: {
                        include: {
                            ProductTag: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    StockBatch: {
                        select: {
                            id: true,
                            manufacturingDate: true,
                            arrivalDate: true,
                            expiryDate: true,
                            stockQuantity: true,
                        },
                    },
                    ProductScheme: {
                        orderBy: {
                            createdAt: "desc",
                        },
                    },
                    ForecastItem: {
                        where: {
                            distributorId,
                            forecastDate: {
                                gte: twoMonthsAgo,
                            },
                        },
                        select: {
                            id: true,
                            forecastDate: true,
                            quantity: true,
                        },
                        orderBy: {
                            forecastDate: "desc",
                        },
                    },
                    OrderItem: {
                        where: {
                            customerId: distributorId,
                            orderDate: {
                                gte: twoMonthsAgo,
                            },
                        },
                        select: {
                            id: true,
                            quantity: true,
                            orderDate: true,
                        },
                        orderBy: {
                            orderDate: "desc",
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.product.count({ where }),
        ]);
        const productIds = productsData.map((p) => p.id);
        const lastOrderItemByProductId = distributorId
            ? await getLastCompletedOrderItemByProduct(distributorId, productIds)
            : new Map();
        const products = productsData.map((product) => {
            const last = lastOrderItemByProductId.get(product.id);
            const lastOrderItem = last
                ? [
                    {
                        id: last.id,
                        quantity: last.quantity,
                        orderDate: (last.orderDate ?? last.createdAt),
                    },
                ]
                : [];
            const remainingStock = product.StockBatch?.reduce((sum, batch) => sum + (batch.stockQuantity || 0), 0) || 0;
            const reservedForThisOrder = reservedByProductId[product.id] || 0;
            const availableForOrder = remainingStock + reservedForThisOrder;
            return {
                ...product,
                LastOrderItem: lastOrderItem,
                availableForOrder,
            };
        });
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching products for order:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getDistributorOrderProductsForOrderUpdate = getDistributorOrderProductsForOrderUpdate;
/**
 * Last completed sale date per product for one customer, rolled up by product group:
 * every product in a group gets the latest sale of any product in that group.
 * Products without a group use their own sales. Never-sold products are omitted.
 */
const getLastSoldByCustomer = async (req, res) => {
    try {
        const { customerId } = req.query;
        if (!customerId || typeof customerId !== "string") {
            return res.status(400).json({ message: "customerId is required" });
        }
        const [lastByProductId, groupedProducts] = await Promise.all([
            getLastCompletedOrderItemByProduct(customerId),
            prisma_1.prisma.product.findMany({
                where: { productGroupId: { not: null } },
                select: { id: true, productGroupId: true },
            }),
        ]);
        const lastSoldMs = new Map();
        for (const [productId, item] of lastByProductId) {
            lastSoldMs.set(productId, new Date(item.orderDate ?? item.createdAt).getTime());
        }
        const latestByGroup = new Map();
        for (const p of groupedProducts) {
            const own = lastSoldMs.get(p.id);
            if (own === undefined || !p.productGroupId)
                continue;
            const prev = latestByGroup.get(p.productGroupId);
            if (prev === undefined || own > prev)
                latestByGroup.set(p.productGroupId, own);
        }
        const lastSold = {};
        for (const [productId, ms] of lastSoldMs) {
            lastSold[productId] = new Date(ms).toISOString();
        }
        for (const p of groupedProducts) {
            const groupMs = p.productGroupId ? latestByGroup.get(p.productGroupId) : undefined;
            if (groupMs !== undefined)
                lastSold[p.id] = new Date(groupMs).toISOString();
        }
        res.json({ lastSold });
    }
    catch (error) {
        console.error("Error fetching last sold by customer:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getLastSoldByCustomer = getLastSoldByCustomer;
// Get a single product by ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await prisma_1.prisma.product.findUnique({
            where: { id },
            include: {
                Category: true,
                SubCategory: true,
                ProductGroup: true,
                Plant: true,
                ProductTagRelation: {
                    include: {
                        ProductTag: true,
                    },
                },
                StockBatch: true,
                StockRecord: {
                    orderBy: { createdAt: "desc" },
                },
                ProductScheme: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json({ product });
    }
    catch (error) {
        console.error("Error fetching product:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductById = getProductById;
// Update a product
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Check if product exists
        const existingProduct = await prisma_1.prisma.product.findUnique({
            where: { id },
        });
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        // If product code is being updated, check for uniqueness
        if (updateData.productCode &&
            updateData.productCode !== existingProduct.productCode) {
            const duplicateProduct = await prisma_1.prisma.product.findUnique({
                where: { productCode: updateData.productCode },
            });
            if (duplicateProduct) {
                return res.status(409).json({ message: "Product code already exists" });
            }
        }
        // Verify that category exists if it's being updated
        if (updateData.categoryId) {
            const category = await prisma_1.prisma.category.findUnique({
                where: { id: updateData.categoryId },
            });
            if (!category) {
                return res.status(404).json({ message: "Category not found" });
            }
        }
        const nextCategoryId = updateData.categoryId ?? existingProduct.categoryId;
        // Explicit null clears subcategory; otherwise validate when provided
        if (updateData.subCategoryId === null) {
            updateData.subCategoryId = null;
        }
        else if (updateData.subCategoryId) {
            const subCategory = await prisma_1.prisma.subCategory.findUnique({
                where: { id: updateData.subCategoryId },
            });
            if (!subCategory) {
                return res.status(404).json({ message: "Sub-category not found" });
            }
            if (subCategory.categoryId !== nextCategoryId) {
                return res.status(400).json({
                    message: "Sub-category does not belong to the selected category",
                });
            }
        }
        else if (updateData.categoryId &&
            updateData.categoryId !== existingProduct.categoryId &&
            updateData.subCategoryId === undefined) {
            // Category changed without a new subcategory — clear stale assignment
            updateData.subCategoryId = null;
        }
        // Verify that product group exists if it's being updated
        if (updateData.productGroupId) {
            const productGroup = await prisma_1.prisma.productGroup.findUnique({
                where: { id: updateData.productGroupId },
            });
            if (!productGroup) {
                return res.status(404).json({ message: "Product group not found" });
            }
        }
        // Verify that plant exists if it's being updated
        if (updateData.plantId) {
            const plant = await prisma_1.prisma.plant.findUnique({
                where: { id: updateData.plantId },
            });
            if (!plant) {
                return res.status(404).json({ message: "Plant not found" });
            }
        }
        // Verify that scheme percentage is between 0 and 100
        if (updateData.schemePercentage) {
            if (updateData.schemePercentage < 0 ||
                updateData.schemePercentage > 100) {
                return res
                    .status(400)
                    .json({ message: "Scheme percentage must be between 0 and 100" });
            }
        }
        // Verify that GST percentage is between 0 and 100 when provided.
        if (updateData.gstPercentage !== undefined) {
            if (updateData.gstPercentage < 0 || updateData.gstPercentage > 100) {
                return res
                    .status(400)
                    .json({ message: "GST percentage must be between 0 and 100" });
            }
        }
        // Validate festive price when provided
        if (updateData.festivePricePerPacket !== undefined && updateData.festivePricePerPacket !== null) {
            if (updateData.festivePricePerPacket < 0) {
                return res
                    .status(400)
                    .json({ message: "Festive price per packet cannot be negative" });
            }
            // Auto-calculate festive price per carton
            const ppc = updateData.packetsPerCarton ?? existingProduct.packetsPerCarton;
            if (ppc && ppc > 0) {
                updateData.festivePricePerCarton = parseFloat((updateData.festivePricePerPacket * ppc).toFixed(4));
            }
        }
        // Handle tag updates if provided
        const tagIdsToUpdate = updateData.tagIds;
        if (tagIdsToUpdate) {
            delete updateData.tagIds;
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            if (tagIdsToUpdate) {
                await tx.productTagRelation.deleteMany({
                    where: { productId: id },
                });
                const existingTags = await tx.productTag.findMany({
                    where: { id: { in: tagIdsToUpdate } },
                });
                if (existingTags.length !== tagIdsToUpdate.length) {
                    throw new Error("One or more tag IDs do not exist");
                }
                for (const tag of existingTags) {
                    await tx.productTagRelation.create({
                        data: {
                            productId: id,
                            productTagId: tag.id,
                        },
                    });
                }
            }
            const product = await tx.product.update({
                where: { id },
                data: updateData,
                include: {
                    Category: true,
                    SubCategory: true,
                    ProductGroup: true,
                    Plant: true,
                    ProductTagRelation: {
                        include: {
                            ProductTag: true,
                        },
                    },
                    ProductScheme: {
                        orderBy: { createdAt: "desc" },
                    },
                },
            });
            const tagRelationsForSnapshot = product.ProductTagRelation.map((r) => ({
                productTagId: r.productTagId,
                ProductTag: r.ProductTag,
            }));
            await tx.productChangeHistory.create({
                data: (0, productChangeSnapshot_1.buildProductChangeSnapshot)(product, tagRelationsForSnapshot, "UPDATE"),
            });
            return { product, tagRelations: product.ProductTagRelation };
        });
        res.json({ product: result.product, tagRelations: result.tagRelations });
    }
    catch (error) {
        if (error instanceof Error &&
            error.message === "One or more tag IDs do not exist") {
            return res.status(400).json({ message: error.message });
        }
        console.error("Error updating product:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProduct = updateProduct;
// Delete a product
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if product exists
        const existingProduct = await prisma_1.prisma.product.findUnique({
            where: { id },
        });
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Check if product is used in any orders
        const orderItems = await prisma_1.prisma.orderItem.findMany({
            where: { productId: id },
        });
        if (orderItems.length > 0) {
            return res.status(422).json({
                message: `Cannot delete product as it is associated with ${orderItems.length} existing orders.
          Please delete following orders first: \n${orderItems
                    .map((orderItem) => orderItem.orderId)
                    .join("\n")}`,
            });
        }
        // Check if product is used in any forecasts
        const forecastItems = await prisma_1.prisma.forecastItem.findMany({
            where: { productId: id },
        });
        if (forecastItems.length > 0) {
            return res.status(422).json({
                message: `Cannot delete product as it is associated with ${forecastItems.length} existing forecasts.
          Please delete following forecasts first: \n${forecastItems
                    .map((forecastItem) => forecastItem.forecastId)
                    .join("\n")}`,
            });
        }
        const purchaseInvoiceItems = await prisma_1.prisma.purchaseInvoiceItem.findMany({
            where: { productId: id },
            select: { id: true, purchaseInvoiceId: true },
        });
        if (purchaseInvoiceItems.length > 0) {
            return res.status(422).json({
                message: `Cannot delete product as it is on ${purchaseInvoiceItems.length} purchase invoice line(s). Remove or adjust purchase invoices first: \n${[
                    ...new Set(purchaseInvoiceItems.map((row) => row.purchaseInvoiceId)),
                ].join("\n")}`,
            });
        }
        const salesReturnItems = await prisma_1.prisma.salesReturnItem.findMany({
            where: { productId: id },
            select: { id: true, salesReturnId: true },
        });
        if (salesReturnItems.length > 0) {
            return res.status(422).json({
                message: `Cannot delete product as it is on ${salesReturnItems.length} sales return line(s). Remove or resolve sales returns first: \n${[
                    ...new Set(salesReturnItems.map((row) => row.salesReturnId)),
                ].join("\n")}`,
            });
        }
        const creditNoteItems = await prisma_1.prisma.creditNoteItem.findMany({
            where: { productId: id },
            select: { id: true, creditNoteId: true },
        });
        if (creditNoteItems.length > 0) {
            return res.status(422).json({
                message: `Cannot delete product as it is on ${creditNoteItems.length} credit note line(s). Remove or resolve credit notes first: \n${[
                    ...new Set(creditNoteItems.map((row) => row.creditNoteId)),
                ].join("\n")}`,
            });
        }
        const stockBatchCount = await prisma_1.prisma.stockBatch.count({
            where: { productId: id },
        });
        const stockRecordCount = await prisma_1.prisma.stockRecord.count({
            where: { productId: id },
        });
        if (stockBatchCount > 0 || stockRecordCount > 0) {
            return res.status(400).json({
                message: "Cannot hard-delete product with stock history. Mark it as discontinued (isDiscontinued) instead so StockBatch and StockRecord rows are preserved for audit and stock-status reports.",
            });
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.purchaseStockBatch.deleteMany({ where: { productId: id } });
            await tx.openingStock.deleteMany({ where: { productId: id } });
            await tx.productScheme.deleteMany({ where: { productId: id } });
            await tx.productTagRelation.deleteMany({ where: { productId: id } });
            await tx.product.delete({ where: { id } });
        });
        res.json({ message: "Product deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting product:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteProduct = deleteProduct;
// Get product statistics
const getProductStats = async (req, res) => {
    try {
        const [totalProducts, totalValue, lowStockProducts] = await Promise.all([
            prisma_1.prisma.product.count(),
            prisma_1.prisma.product.aggregate({
                _sum: {
                    mrp: true,
                },
            }),
            // Count products with low stock (based on lowStockLimit field)
            prisma_1.prisma.product.count({
                where: {
                    lowStockLimit: {
                        gt: 0,
                    },
                },
            }),
        ]);
        const averagePrice = totalProducts > 0 ? totalValue._sum.mrp / totalProducts : 0;
        res.json({
            stats: {
                totalProducts,
                lowStockProducts,
                totalValue: totalValue._sum.mrp || 0,
                averagePrice: Math.round(averagePrice),
            },
        });
    }
    catch (error) {
        console.error("Error fetching product stats:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductStats = getProductStats;
// Get current active scheme for a product
const getCurrentActiveScheme = async (req, res) => {
    try {
        const { id } = req.params;
        const { startOfDay, endOfDay } = (0, schemeDates_1.schemeActiveOn)(new Date());
        const cbCountRaw = req.query?.cbCount;
        const cbCount = Number.isFinite(Number(cbCountRaw))
            ? Number(cbCountRaw)
            : 1;
        // Check if product exists
        const product = await prisma_1.prisma.product.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                productCode: true,
            },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Get the current active scheme for this product
        const activeScheme = await prisma_1.prisma.productScheme.findFirst({
            where: {
                productId: id,
                isActive: true,
                startDate: { lte: endOfDay },
                endDate: { gte: startOfDay },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const getEffectiveSchemePercentageForCb = (scheme) => {
            if (!scheme)
                return 0;
            const slabs = [
                { minCb: scheme.slab1MinCb, maxCb: scheme.slab1MaxCb, percent: scheme.slab1Percent },
                { minCb: scheme.slab2MinCb, maxCb: scheme.slab2MaxCb, percent: scheme.slab2Percent },
                { minCb: scheme.slab3MinCb, maxCb: scheme.slab3MaxCb, percent: scheme.slab3Percent },
                { minCb: scheme.slab4MinCb, maxCb: scheme.slab4MaxCb, percent: scheme.slab4Percent },
            ]
                .filter((s) => s.minCb !== null &&
                s.minCb !== undefined &&
                s.maxCb !== null &&
                s.maxCb !== undefined &&
                s.percent !== null &&
                s.percent !== undefined)
                .sort((a, b) => a.minCb - b.minCb);
            // Backward compatibility: if slabs are missing, use legacy schemePercentage.
            if (slabs.length === 0)
                return scheme.schemePercentage ?? 0;
            const match = slabs.find((s) => cbCount >= s.minCb && cbCount <= s.maxCb);
            if (match)
                return match.percent;
            const first = slabs[0];
            const last = slabs[slabs.length - 1];
            // Below first slab minimum, scheme should not apply.
            if (cbCount < first.minCb)
                return 0;
            if (cbCount > last.maxCb)
                return last.percent;
            return 0;
        };
        res.json({
            product,
            activeScheme: activeScheme || null,
            effectiveSchemePercentage: activeScheme
                ? getEffectiveSchemePercentageForCb(activeScheme)
                : 0,
        });
    }
    catch (error) {
        console.error("Error fetching current active scheme:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCurrentActiveScheme = getCurrentActiveScheme;
// Get products for distributors - only basic product information with pagination
const getProductsForDistributor = async (req, res) => {
    try {
        const { page = 1, limit = 1000, search, categoryId, distributorId, } = req.query;
        // Convert string values to numbers
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        // Calculate date threshold for recent sales history (last 2 months)
        // const twoMonthsAgo = new Date();
        // twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        // twoMonthsAgo.setHours(0, 0, 0, 0);
        /** Distributor catalog: omit discontinued only. Uses explicit AND/OR — Prisma+Mongo top-level `NOT` on newer
         * booleans often drops legacy documents where `isDiscontinued` was never persisted. */
        const andConditions = [];
        if (search) {
            andConditions.push({
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { productCode: { contains: search, mode: "insensitive" } },
                ],
            });
        }
        if (categoryId) {
            andConditions.push({ categoryId });
        }
        andConditions.push({
            OR: [
                { isDiscontinued: false },
                { isDiscontinued: null },
                { isDiscontinued: { isSet: false } },
            ],
        });
        const where = andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
        // Only show products with stock quantity > 0
        // where.StockBatch = {
        //   some: {
        //     stockQuantity: {
        //       gt: 0,
        //     },
        //   },
        // };
        // // Build forecast item where clause
        // const forecastItemWhere: any = {};
        // if (distributorId) {
        //   forecastItemWhere.distributorId = distributorId;
        //   forecastItemWhere.forecastDate = {
        //     //last 3 months
        //     gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        //   };
        // }
        // // Build order item where clause for distributor's orders
        // const orderItemWhere: any = {};
        // if (distributorId) {
        //   orderItemWhere.Order = {
        //     customerId: distributorId,
        //     orderDate: {
        //       //last 3 months
        //       gte: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        //     },
        //   };
        // }
        const [productsData, total] = await Promise.all([
            prisma_1.prisma.product.findMany({
                where,
                skip,
                take: limitNum,
                select: {
                    id: true,
                    productCode: true,
                    name: true,
                    mrp: true,
                    grammage: true,
                    lifeOfProduct: true,
                    packetsPerCarton: true,
                    schemePercentage: true,
                    gstPercentage: true,
                    costPricePerCarton: true,
                    costPricePerCartonWithGst: true,
                    sellingPricePerPacketForDb: true,
                    sellingPricePerPacketForDbWithGst: true,
                    sellingPricePerCartonForDb: true,
                    sellingPricePerCartonForDbWithGst: true,
                    sellingPricePerPacketForRss: true,
                    sellingPricePerPacketForRssWithGst: true,
                    sellingPricePerCartonForRss: true,
                    sellingPricePerCartonForRssWithGst: true,
                    Category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    // Minimal sales history for computing "last sold" information per distributor
                    OrderItem: distributorId
                        ? {
                            where: {
                                customerId: distributorId,
                                OR: [
                                    { orderCompleted: true },
                                    { Order: { orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID } },
                                ],
                            },
                            select: {
                                id: true,
                                orderDate: true,
                                quantity: true,
                            },
                            orderBy: {
                                orderDate: "desc",
                            },
                            take: 1,
                        }
                        : undefined,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.product.count({ where }),
        ]);
        // Shape response to include LastOrderItem (used by frontend for "days since last sale")
        const products = productsData.map((product) => ({
            ...product,
            LastOrderItem: product.OrderItem && product.OrderItem.length > 0
                ? [
                    {
                        id: product.OrderItem[0].id,
                        orderDate: product.OrderItem[0].orderDate,
                    },
                ]
                : [],
        }));
        const totalPages = Math.ceil(total / limitNum);
        res.json({
            products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
        });
    }
    catch (error) {
        console.error("Error fetching products for distributor:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductsForDistributor = getProductsForDistributor;
// Get sales history and forecast history for a product for a specific distributor
const getProductSalesAndForecastHistory = async (req, res) => {
    try {
        const { productId } = req.params;
        const { distributorId, startDate, endDate } = req.query;
        if (!productId) {
            res.status(400).json({ message: "Product ID is required" });
            return;
        }
        if (!distributorId) {
            res.status(400).json({ message: "Distributor ID is required" });
            return;
        }
        let dateFrom;
        let dateTo;
        if (startDate && endDate) {
            dateFrom = new Date(startDate);
            dateTo = new Date(endDate);
            if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
                res.status(400).json({
                    message: "Invalid startDate or endDate; use ISO date strings",
                });
                return;
            }
            if (dateFrom > dateTo) {
                res.status(400).json({
                    message: "startDate must be before or equal to endDate",
                });
                return;
            }
        }
        else {
            dateTo = new Date();
            dateFrom = new Date();
            dateFrom.setMonth(dateFrom.getMonth() - 3);
        }
        const [forecastItems, orderItems] = await Promise.all([
            prisma_1.prisma.forecastItem.findMany({
                where: {
                    productId,
                    distributorId,
                    forecastDate: { gte: dateFrom, lte: dateTo },
                },
                select: {
                    id: true,
                    distributorId: true,
                    forecastId: true,
                    forecastDate: true,
                    quantity: true,
                    createdAt: true,
                },
                orderBy: { forecastDate: "desc" },
            }),
            prisma_1.prisma.orderItem.findMany({
                where: {
                    productId,
                    customerId: distributorId,
                    Order: {
                        orderDate: { gte: dateFrom, lte: dateTo },
                    },
                },
                select: {
                    id: true,
                    orderId: true,
                    productId: true,
                    quantity: true,
                    createdAt: true,
                    Order: {
                        select: { orderDate: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);
        res.json({
            forecastItems,
            orderItems,
        });
    }
    catch (error) {
        console.error("Error fetching product sales and forecast history:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductSalesAndForecastHistory = getProductSalesAndForecastHistory;
// Get change history for a product
const getProductChangeHistory = async (req, res) => {
    try {
        const { productId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, productCode: true },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const [history, total] = await Promise.all([
            prisma_1.prisma.productChangeHistory.findMany({
                where: { productId },
                orderBy: { changedAt: "desc" },
                skip,
                take: limit,
            }),
            prisma_1.prisma.productChangeHistory.count({ where: { productId } }),
        ]);
        res.json({
            product,
            history,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("Error fetching product change history:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getProductChangeHistory = getProductChangeHistory;
function parseOptionalNonNegInt(value, fieldName) {
    if (value === undefined)
        return { ok: true, value: undefined };
    if (value === null || value === "")
        return { ok: true, value: null };
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return {
            ok: false,
            message: `${fieldName} must be a non-negative integer or null`,
        };
    }
    return { ok: true, value: n };
}
function parseOptionalRemark(value) {
    if (value === undefined)
        return { ok: true, value: undefined };
    if (value === null)
        return { ok: true, value: null };
    if (typeof value !== "string") {
        return { ok: false, message: "Remark must be a string or null" };
    }
    return { ok: true, value: value };
}
/** Patch date-scoped stock-status extras (DailyStockStatus). Requires body.date. */
const updateProductExternalStock = async (req, res) => {
    try {
        const { id } = req.params;
        const dateStr = (req.body?.date ??
            req.query?.date ??
            "").trim();
        if (!dateStr) {
            return res.status(400).json({
                message: "date (YYYY-MM-DD) is required in body or query",
            });
        }
        if (!(0, openingStockSnapshot_1.isIstYmd)(dateStr)) {
            return res.status(400).json({ message: "date must be YYYY-MM-DD" });
        }
        const existing = await prisma_1.prisma.product.findUnique({
            where: { id },
            select: { id: true, name: true, productCode: true },
        });
        if (!existing) {
            return res.status(404).json({ message: "Product not found" });
        }
        const parsed = (0, dailyStockStatus_1.parseDailyStockStatusBody)(req.body ?? {});
        if (!parsed.ok) {
            return res.status(400).json({ message: parsed.message });
        }
        const row = await (0, dailyStockStatus_1.upsertDailyStockStatus)({
            dateStr,
            productId: id,
            patch: parsed.patch,
        });
        const fields = (0, dailyStockStatus_1.mapDailyStockStatusFields)(row);
        res.json({
            date: dateStr,
            product: {
                id: existing.id,
                name: existing.name,
                productCode: existing.productCode,
                ...fields,
                tallyQtyUpdatedAt: row.tallyQtyUpdatedAt,
                dmsQtyUpdatedAt: row.dmsQtyUpdatedAt,
            },
        });
    }
    catch (error) {
        console.error("Error updating product external stock:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProductExternalStock = updateProductExternalStock;
/** Bulk overwrite Tally or DMS quantities for a date (DailyStockStatus). */
const bulkUpdateProductExternalStock = async (req, res) => {
    try {
        const { source, rows, date } = req.body;
        const dateStr = (date ?? "").trim() || (0, schemeDates_1.toIstYmd)(new Date());
        if (!(0, openingStockSnapshot_1.isIstYmd)(dateStr)) {
            return res.status(400).json({ message: "date must be YYYY-MM-DD" });
        }
        if (source !== "tally" && source !== "dms") {
            return res
                .status(400)
                .json({ message: 'source must be "tally" or "dms"' });
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            return res
                .status(400)
                .json({ message: "rows must be a non-empty array" });
        }
        const updates = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row?.productId || typeof row.productId !== "string") {
                return res
                    .status(400)
                    .json({ message: `rows[${i}].productId is required` });
            }
            const parsed = parseOptionalNonNegInt(row.quantity, `rows[${i}].quantity`);
            if (!parsed.ok || parsed.value === undefined || parsed.value === null) {
                return res.status(400).json({
                    message: `rows[${i}].quantity must be a non-negative integer`,
                });
            }
            updates.push({ productId: row.productId, quantity: parsed.value });
        }
        const results = [];
        for (const { productId, quantity } of updates) {
            const row = await (0, dailyStockStatus_1.upsertDailyStockStatus)({
                dateStr,
                productId,
                patch: source === "tally"
                    ? { tallyQuantity: quantity }
                    : { dmsQuantity: quantity },
            });
            results.push(row);
        }
        res.json({
            date: dateStr,
            updated: results.length,
            source,
        });
    }
    catch (error) {
        console.error("Error bulk-updating product external stock:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.bulkUpdateProductExternalStock = bulkUpdateProductExternalStock;
//# sourceMappingURL=product.controller.js.map