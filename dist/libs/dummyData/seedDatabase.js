"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = require("../../lib/prisma");
const stockRecordChangeMeta_1 = require("../../lib/stockRecordChangeMeta");
const defaultCategories_1 = require("./defaultCategories");
const defaultTags_1 = require("./defaultTags");
const defaultProducts_1 = require("./defaultProducts");
const defaultOrders_1 = require("./defaultOrders");
const defaultOrderItems_1 = require("./defaultOrderItems");
const defaultVehicles_1 = require("./defaultVehicles");
const defaultVehicleTypes = ["TRUCK", "PICKUP", "OTHER"];
// Matches legacy OrderStatus enum for dynamic OrderStatusType seeding
const defaultOrderStatusTypes = [
    { name: "PENDING", displayName: "Pending", sortOrder: 1 },
    { name: "MODIFYING", displayName: "Modifying", sortOrder: 2 },
    { name: "PACKING_PENDING", displayName: "Packing Pending", sortOrder: 3 },
    { name: "PACKING", displayName: "Packing", sortOrder: 4 },
    { name: "APPROVAL_PENDING", displayName: "Approval Pending", sortOrder: 5 },
    { name: "BILLED", displayName: "Billed", sortOrder: 6 },
    { name: "SHIPPING_PENDING", displayName: "Shipping Pending", sortOrder: 7 },
    { name: "SHIPPING", displayName: "Shipping", sortOrder: 8 },
    { name: "DELIVERED", displayName: "Delivered", sortOrder: 9 },
    { name: "COMPLETED", displayName: "Completed", sortOrder: 10 },
];
const seedDatabase = async () => {
    try {
        console.log("🌱 Starting database seeding...");
        // 1. Create admin user first
        console.log("👤 Creating admin user...");
        const adminEmail = "admin@edigitalindia.com";
        const existingAdmin = await prisma_1.prisma.user.findUnique({
            where: { email: adminEmail },
        });
        let adminUser = existingAdmin;
        if (!existingAdmin) {
            const hashedPassword = await bcrypt_1.default.hash("admin123", 10);
            adminUser = await prisma_1.prisma.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: "System Administrator",
                    phone: "9999999999",
                    userType: "ADMIN",
                },
            });
            console.log("✅ Created admin user");
            console.log("📧 Email: admin@edigitalindia.com");
            console.log("🔑 Password: admin123");
        }
        else {
            console.log("⏭️  Admin user already exists");
        }
        // Create sample customer user for orders
        console.log("👤 Creating sample customer user...");
        const customerEmail = "customer@example.com";
        const existingCustomer = await prisma_1.prisma.user.findUnique({
            where: { email: customerEmail },
        });
        if (!existingCustomer) {
            const hashedPassword = await bcrypt_1.default.hash("customer123", 10);
            await prisma_1.prisma.user.create({
                data: {
                    email: customerEmail,
                    password: hashedPassword,
                    name: "Sample Customer",
                    phone: "8888888888",
                    userType: "CUSTOMER",
                },
            });
            console.log("✅ Created sample customer user");
            console.log("📧 Email: customer@example.com");
            console.log("🔑 Password: customer123");
        }
        else {
            console.log("⏭️  Sample customer user already exists");
        }
        // 2. Seed categories (limit to 5)
        console.log("📂 Seeding categories (max 5)...");
        const categoryMap = new Map(); // name -> id mapping
        const categoriesToSeed = defaultCategories_1.defaultCategories.slice(0, 5);
        for (const category of categoriesToSeed) {
            const existingCategory = await prisma_1.prisma.category.findUnique({
                where: { name: category.name },
            });
            if (!existingCategory) {
                const createdCategory = await prisma_1.prisma.category.create({
                    data: category,
                });
                categoryMap.set(category.name, createdCategory.id);
                console.log(`✅ Created category: ${category.name}`);
            }
            else {
                categoryMap.set(category.name, existingCategory.id);
                console.log(`⏭️  Category already exists: ${category.name}`);
            }
        }
        // 4. Seed tags (limit to 5)
        console.log("🏷️  Seeding tags (max 5)...");
        const tagMap = new Map(); // name -> id mapping
        for (const tag of defaultTags_1.defaultTags) {
            const existingTag = await prisma_1.prisma.productTag.findFirst({
                where: { name: tag.name },
            });
            if (!existingTag) {
                const createdTag = await prisma_1.prisma.productTag.create({
                    data: tag,
                });
                tagMap.set(tag.name, createdTag.id);
                console.log(`✅ Created tag: ${tag.name}`);
            }
            else {
                tagMap.set(tag.name, existingTag.id);
                console.log(`⏭️  Tag already exists: ${tag.name}`);
            }
        }
        // 4b. Seed vehicle types
        console.log("🚙 Seeding vehicle types...");
        const vehicleTypeMap = new Map(); // name -> id
        for (const name of defaultVehicleTypes) {
            const existing = await prisma_1.prisma.vehicleType.findFirst({
                where: { name },
            });
            if (!existing) {
                const created = await prisma_1.prisma.vehicleType.create({ data: { name } });
                vehicleTypeMap.set(name, created.id);
                console.log(`✅ Created vehicle type: ${name}`);
            }
            else {
                vehicleTypeMap.set(name, existing.id);
                console.log(`⏭️  Vehicle type already exists: ${name}`);
            }
        }
        // 4c. Seed order status types (dynamic status lookup)
        console.log("📋 Seeding order status types...");
        const orderStatusTypeMap = new Map(); // name -> id
        for (const ost of defaultOrderStatusTypes) {
            const existing = await prisma_1.prisma.orderStatusType.findFirst({
                where: { name: ost.name },
            });
            if (!existing) {
                const created = await prisma_1.prisma.orderStatusType.create({
                    data: { name: ost.name, displayName: ost.displayName, sortOrder: ost.sortOrder },
                });
                orderStatusTypeMap.set(ost.name, created.id);
                console.log(`✅ Created order status type: ${ost.name}`);
            }
            else {
                orderStatusTypeMap.set(ost.name, existing.id);
                console.log(`⏭️  Order status type already exists: ${ost.name}`);
            }
        }
        // 5. Seed vehicles (limit to 5)
        console.log("🚛 Seeding vehicles (max 5)...");
        const vehicleMap = new Map(); // vehicleNumber -> id mapping
        const vehiclesToSeed = defaultVehicles_1.defaultVehicles.slice(0, 5);
        for (const vehicle of vehiclesToSeed) {
            const vehicleTypeId = vehicleTypeMap.get(vehicle.vehicleTypeName);
            if (!vehicleTypeId) {
                console.log(`❌ Vehicle type not found for vehicle: ${vehicle.vehicleName}`);
                continue;
            }
            const existingVehicle = await prisma_1.prisma.vehicle.findUnique({
                where: { vehicleNumber: vehicle.vehicleNumber },
            });
            if (!existingVehicle) {
                const createdVehicle = await prisma_1.prisma.vehicle.create({
                    data: {
                        vehicleName: vehicle.vehicleName,
                        vehicleNumber: vehicle.vehicleNumber,
                        vehicleTypeId,
                        capacity: vehicle.capacity,
                    },
                });
                vehicleMap.set(vehicle.vehicleNumber, createdVehicle.id);
                console.log(`✅ Created vehicle: ${vehicle.vehicleName} (${vehicle.vehicleNumber})`);
            }
            else {
                vehicleMap.set(vehicle.vehicleNumber, existingVehicle.id);
                console.log(`⏭️  Vehicle already exists: ${vehicle.vehicleName} (${vehicle.vehicleNumber})`);
            }
        }
        // 6. Seed products (limit to 5)
        console.log("🛍️  Seeding products (max 5)...");
        const productMap = new Map(); // productCode -> id mapping
        const productsToSeed = defaultProducts_1.defaultProducts.slice(0, 5);
        for (const product of productsToSeed) {
            const categoryId = categoryMap.get(product.categoryName);
            if (!categoryId) {
                console.log(`❌ Category not found for product: ${product.name}`);
                continue;
            }
            const existingProduct = await prisma_1.prisma.product.findUnique({
                where: { productCode: product.productCode },
            });
            if (!existingProduct) {
                const createdProduct = await prisma_1.prisma.product.create({
                    data: {
                        name: product.name,
                        mrp: product.mrp,
                        productCode: product.productCode,
                        lowStockLimit: product.lowStockLimit,
                        overStockLimit: product.overStockLimit,
                        grammage: product.grammage,
                        imageUrl: product.imageUrl,
                        categoryId: categoryId,
                    },
                });
                productMap.set(product.productCode, createdProduct.id);
                console.log(`✅ Created product: ${product.name} (${product.productCode})`);
            }
            else {
                productMap.set(product.productCode, existingProduct.id);
                console.log(`⏭️  Product already exists: ${product.name} (${product.productCode})`);
            }
        }
        // 6.5. Create or get default plant for stock batches
        console.log("🏭 Creating default plant...");
        let defaultPlant = await prisma_1.prisma.plant.findFirst({
            where: { name: "Default Plant" },
        });
        if (!defaultPlant) {
            defaultPlant = await prisma_1.prisma.plant.create({
                data: {
                    name: "Default Plant",
                    location: "Default Location",
                },
            });
            console.log("✅ Created default plant");
        }
        else {
            console.log("⏭️  Default plant already exists");
        }
        // 7. Seed stock entries for products
        console.log("📦 Seeding stock entries...");
        for (const product of productsToSeed) {
            const productId = productMap.get(product.productCode);
            if (!productId)
                continue;
            // Check if stock already exists for this product
            const existingStock = await prisma_1.prisma.stockBatch.findFirst({
                where: { productId: productId },
            });
            if (!existingStock && product.stock && product.stock > 0) {
                const manufacturingDate = new Date();
                const arrivalDate = new Date();
                const expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months validity
                const stock = await prisma_1.prisma.stockBatch.create({
                    data: {
                        productId: productId,
                        manufacturingDate: manufacturingDate,
                        arrivalDate: arrivalDate,
                        expiryDate: expiryDate,
                        stockQuantity: product.stock,
                    },
                });
                const changeMeta = (0, stockRecordChangeMeta_1.buildStockRecordChangeFields)({
                    changeInStock: product.stock,
                    changeDate: arrivalDate,
                });
                // Create stock record for the initial stock entry
                await prisma_1.prisma.stockRecord.create({
                    data: {
                        productId: productId,
                        stockBatchId: stock.id,
                        changeInStock: product.stock,
                        createdBy: adminUser.id,
                        reason: "ARRIVAL_FROM_SUPPLIER",
                        ...changeMeta,
                    },
                });
                console.log(`✅ Created stock entry for: ${product.name} (${product.stock} units)`);
            }
        }
        // 8. Seed orders (limit to 5)
        console.log("📋 Seeding orders (max 5)...");
        const orderMap = new Map(); // orderIndex -> id mapping
        const ordersToSeed = defaultOrders_1.defaultOrders.slice(0, 5);
        for (let i = 0; i < ordersToSeed.length; i++) {
            const order = ordersToSeed[i];
            // Find customer by email
            const customer = await prisma_1.prisma.user.findUnique({
                where: { email: order.customerEmail },
            });
            if (!customer) {
                console.log(`❌ Customer not found for order ${i + 1}: ${order.customerEmail}`);
                continue;
            }
            // Create delivery address if provided
            let deliveryAddressId;
            if (order.deliveryAddress) {
                const deliveryAddress = await prisma_1.prisma.deliveryAddress.create({
                    data: {
                        userId: customer.id,
                        address: order.deliveryAddress,
                        default: false,
                    },
                });
                deliveryAddressId = deliveryAddress.id;
            }
            // Get vehicle ID if assigned
            let vehicleId;
            if (order.vehicleNumber) {
                vehicleId = vehicleMap.get(order.vehicleNumber);
            }
            // Create order
            const createdOrder = await prisma_1.prisma.order.create({
                data: {
                    status: order.status,
                    totalPrice: order.totalPrice,
                    orderDate: order.orderDate,
                    customerId: customer.id,
                    deliveryAddressId: deliveryAddressId,
                    vehicleId: vehicleId,
                },
            });
            orderMap.set(i, createdOrder.id);
            console.log(`✅ Created order ${i + 1}: ${order.status} - ₹${order.totalPrice}`);
        }
        // 9. Seed order items (limit to 5)
        console.log("🛒 Seeding order items (max 5)...");
        const orderItemsToSeed = defaultOrderItems_1.defaultOrderItems.slice(0, 5);
        for (const orderItem of orderItemsToSeed) {
            const orderId = orderMap.get(orderItem.orderIndex);
            if (!orderId) {
                console.log(`❌ Order not found for order item: ${orderItem.productCode}`);
                continue;
            }
            // Find product by product code
            const productId = productMap.get(orderItem.productCode);
            if (!productId) {
                console.log(`❌ Product not found for order item: ${orderItem.productCode}`);
                continue;
            }
            // Find customer from the order
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                include: { Customer: true },
            });
            if (!order) {
                console.log(`❌ Order not found for order item: ${orderItem.productCode}`);
                continue;
            }
            // Create order item
            await prisma_1.prisma.orderItem.create({
                data: {
                    orderId: orderId,
                    productId: productId,
                    quantity: orderItem.quantity,
                    deliveryDate: orderItem.deliveryDate,
                    orderCompleted: orderItem.orderCompleted,
                    customerId: order.Customer.id,
                },
            });
            console.log(`✅ Created order item: ${orderItem.productCode} x${orderItem.quantity} for order ${orderItem.orderIndex + 1}`);
        }
        console.log("🎉 Database seeding completed successfully!");
    }
    catch (error) {
        console.error("❌ Error seeding database:", error);
        throw error;
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
};
exports.seedDatabase = seedDatabase;
// Run seeding if this file is executed directly
if (require.main === module) {
    (0, exports.seedDatabase)()
        .then(() => {
        console.log("Seeding completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Seeding failed:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=seedDatabase.js.map