"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * One-time backfill script:
 * - Creates `DeliveryAddress` rows from legacy `CustomerDetail.address`
 * - Sets `default=true` for the created address per customer (if the customer has no delivery addresses yet)
 * - Updates existing orders with `deliveryAddressId = null` to use the customer's default delivery address
 *
 * Run from backend root:
 *   npx ts-node src/scripts/backfillDeliveryAddresses.ts
 */
const prisma_1 = require("../lib/prisma");
function pickBestDeliveryAddressId(addresses) {
    const defaults = addresses.filter((a) => a.default);
    if (defaults.length > 0)
        return defaults[0].id;
    return addresses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.id;
}
async function main() {
    // 1) Build a legacy address map per user (customer/distributor)
    const customerDetails = await prisma_1.prisma.customerDetail.findMany({
        select: {
            dbUserId: true,
            address: true,
        },
    });
    const userIdToLegacyAddress = new Map();
    for (const detail of customerDetails) {
        const addr = (detail.address ?? "").trim();
        if (!addr)
            continue;
        if (!userIdToLegacyAddress.has(detail.dbUserId)) {
            userIdToLegacyAddress.set(detail.dbUserId, addr);
        }
    }
    const userIds = [...userIdToLegacyAddress.keys()];
    if (userIds.length === 0) {
        console.log("No legacy CustomerDetail.address values found to backfill.");
        return;
    }
    // 2) Determine which customers already have delivery addresses
    const existingDeliveryAddresses = await prisma_1.prisma.deliveryAddress.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true, default: true, createdAt: true },
    });
    const existingByUserId = new Map();
    for (const da of existingDeliveryAddresses) {
        const arr = existingByUserId.get(da.userId) ?? [];
        arr.push(da);
        existingByUserId.set(da.userId, arr);
    }
    // 3) Create missing delivery addresses (1 per customer for backfill)
    const createOps = [];
    for (const userId of userIds) {
        const existing = existingByUserId.get(userId);
        if (existing && existing.length > 0)
            continue;
        const legacyAddress = userIdToLegacyAddress.get(userId);
        if (!legacyAddress)
            continue;
        createOps.push(prisma_1.prisma.deliveryAddress.create({
            data: {
                userId,
                address: legacyAddress,
                default: true,
            },
        }));
    }
    const created = createOps.length > 0 ? await Promise.all(createOps) : [];
    console.log(`Created ${created.length} delivery address row(s).`);
    // 4) Refresh delivery addresses for all affected users
    const allDeliveryAddresses = await prisma_1.prisma.deliveryAddress.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true, default: true, createdAt: true },
    });
    const bestAddressIdByUserId = new Map();
    for (const userId of userIds) {
        const addresses = allDeliveryAddresses.filter((a) => a.userId === userId);
        const bestId = pickBestDeliveryAddressId(addresses);
        if (bestId)
            bestAddressIdByUserId.set(userId, bestId);
    }
    // 5) Backfill orders that don't have an associated deliveryAddressId yet
    const ordersToUpdate = await prisma_1.prisma.order.findMany({
        where: { deliveryAddressId: null },
        select: { id: true, customerId: true, deliveryAddressId: true },
    });
    let updatedCount = 0;
    for (const order of ordersToUpdate) {
        const bestDeliveryAddressId = bestAddressIdByUserId.get(order.customerId);
        if (!bestDeliveryAddressId)
            continue;
        await prisma_1.prisma.order.update({
            where: { id: order.id },
            data: { deliveryAddressId: bestDeliveryAddressId },
        });
        updatedCount++;
    }
    console.log(`Updated ${updatedCount}/${ordersToUpdate.length} order(s) with deliveryAddressId from backfilled default address.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
//# sourceMappingURL=backfillDeliveryAddresses.js.map