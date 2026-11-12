"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Undo spurious RELEASED_FROM_ORDER for Maa Bhawani / Panchrattan MRP 20 on 19-Aug-2026.
 * Stock was assigned on 18-Aug; erroneous release on 19-Aug removed the line without intent.
 *
 *   npx ts-node --transpile-only src/scripts/repairMaaBhawaniPanchrattanRelease.ts
 */
const prisma_1 = require("../lib/prisma");
const orderItemPriceSnapshot_1 = require("../lib/orderItemPriceSnapshot");
const openingStockSnapshot_1 = require("../lib/openingStockSnapshot");
const ORDER_ID = "6a8446ca409dbaed90f450b1";
const PRODUCT_ID = "6a79785844315dcd5cb7e0cd";
const RELEASE_RECORD_ID = "6a85369ac99b5ee37e880082";
const BATCH_ID = "6a7c1b4a34e1a93f5ba0f281";
const QTY = 10;
const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";
const productSelect = {
    id: true,
    gstPercentage: true,
    packetsPerCarton: true,
    costPricePerCarton: true,
    costPricePerPacket: true,
    sellingPricePerCartonForDb: true,
    sellingPricePerPacketForDb: true,
    sellingPricePerCartonForRss: true,
    sellingPricePerPacketForRss: true,
};
async function main() {
    const release = await prisma_1.prisma.stockRecord.findUnique({
        where: { id: RELEASE_RECORD_ID },
        select: { id: true, orderId: true, productId: true, changeInStock: true },
    });
    if (!release) {
        console.log("Release record not found — already repaired or removed.");
        return;
    }
    const existingItem = await prisma_1.prisma.orderItem.findFirst({
        where: { orderId: ORDER_ID, productId: PRODUCT_ID },
    });
    if (existingItem) {
        console.log("Order item already exists — skipping repair.");
        return;
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.stockRecord.delete({ where: { id: RELEASE_RECORD_ID } });
        const batch = await tx.stockBatch.findUniqueOrThrow({
            where: { id: BATCH_ID },
            select: { stockQuantity: true },
        });
        if (batch.stockQuantity < QTY) {
            throw new Error(`Batch ${BATCH_ID} has insufficient stock (${batch.stockQuantity}) to re-reserve ${QTY}`);
        }
        await tx.stockBatch.update({
            where: { id: BATCH_ID },
            data: { stockQuantity: { decrement: QTY } },
        });
        const order = await tx.order.findUniqueOrThrow({
            where: { id: ORDER_ID },
            select: { customerId: true, orderDate: true, orderStatusTypeId: true },
        });
        const [product, customer] = await Promise.all([
            tx.product.findUniqueOrThrow({
                where: { id: PRODUCT_ID },
                select: { ...productSelect },
            }),
            tx.user.findUnique({
                where: { id: order.customerId },
                select: { CustomerDetail: { select: { dbCategory: true } } },
            }),
        ]);
        const snap = (0, orderItemPriceSnapshot_1.buildOrderItemPriceSnapshot)(product, (0, orderItemPriceSnapshot_1.resolveDbCategory)(customer));
        const isCompleted = order.orderStatusTypeId === COMPLETED_ORDER_STATUS_TYPE_ID;
        await tx.orderItem.create({
            data: {
                orderId: ORDER_ID,
                productId: PRODUCT_ID,
                quantity: QTY,
                customerId: order.customerId,
                orderCompleted: isCompleted,
                orderDate: order.orderDate,
                ...snap,
            },
        });
    });
    console.log("Repaired: deleted spurious release, re-reserved batch qty, restored order line item.");
    const { dates, productCount } = await (0, openingStockSnapshot_1.rebuildRecentOpeningStockSnapshots)();
    console.log(`Opening stock rebuilt for: ${dates.join(", ")} (${productCount} products)`);
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
//# sourceMappingURL=repairMaaBhawaniPanchrattanRelease.js.map