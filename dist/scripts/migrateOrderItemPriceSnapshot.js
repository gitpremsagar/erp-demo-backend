"use strict";
/**
 * Migrates legacy OrderItem fields unitPricePerCarton, unitPricePerPacket, gstPercent
 * to sparse Product-mirror snapshot fields + pricingTier + packetsPerCarton.
 *
 * Run from backend root after prisma db push / generate:
 *   npx ts-node src/scripts/migrateOrderItemPriceSnapshot.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const orderItemPriceSnapshot_1 = require("../lib/orderItemPriceSnapshot");
function toObjectIdString(v) {
    if (typeof v === "string")
        return v;
    if (v && typeof v === "object" && "$oid" in v) {
        return v.$oid;
    }
    throw new Error(`Unsupported id shape: ${JSON.stringify(v)}`);
}
function legacyPricingPayload(dbCategory, unitPricePerCarton, unitPricePerPacket, gstPct, packetsPerCarton) {
    const gstPercentage = gstPct ?? 0;
    const carton = unitPricePerCarton ?? 0;
    const packet = unitPricePerPacket ?? 0;
    const ppc = packetsPerCarton ?? null;
    if (dbCategory === "RSS") {
        return {
            pricingTier: client_1.OrderItemPricingTier.RSS,
            gstPercentage,
            packetsPerCarton: ppc,
            costPricePerCarton: null,
            costPricePerPacket: null,
            sellingPricePerCartonForDb: null,
            sellingPricePerPacketForDb: null,
            sellingPricePerCartonForRss: (0, orderItemPriceSnapshot_1.deriveCartonRateFromPacket)(packet, carton, ppc),
            sellingPricePerPacketForRss: packet,
        };
    }
    if (dbCategory === "SS") {
        return {
            pricingTier: client_1.OrderItemPricingTier.SS,
            gstPercentage,
            packetsPerCarton: ppc,
            costPricePerCarton: (0, orderItemPriceSnapshot_1.deriveCartonRateFromPacket)(packet, carton, ppc),
            costPricePerPacket: packet,
            sellingPricePerCartonForDb: null,
            sellingPricePerPacketForDb: null,
            sellingPricePerCartonForRss: null,
            sellingPricePerPacketForRss: null,
        };
    }
    return {
        pricingTier: client_1.OrderItemPricingTier.DB,
        gstPercentage,
        packetsPerCarton: ppc,
        costPricePerCarton: null,
        costPricePerPacket: null,
        sellingPricePerCartonForDb: (0, orderItemPriceSnapshot_1.deriveCartonRateFromPacket)(packet, carton, ppc),
        sellingPricePerPacketForDb: packet,
        sellingPricePerCartonForRss: null,
        sellingPricePerPacketForRss: null,
    };
}
function asOrderItemDocArray(raw) {
    if (Array.isArray(raw)) {
        return raw;
    }
    const cursor = raw && typeof raw === "object" && "cursor" in raw
        ? raw.cursor
        : undefined;
    if (cursor?.firstBatch && Array.isArray(cursor.firstBatch)) {
        return cursor.firstBatch;
    }
    if (raw &&
        typeof raw === "object" &&
        "documents" in raw &&
        Array.isArray(raw.documents)) {
        return raw.documents;
    }
    return [];
}
async function backfillMissingPacketsPerCarton() {
    const withTier = await prisma_1.prisma.orderItem.findMany({
        where: { pricingTier: { not: null } },
        select: { id: true, productId: true, packetsPerCarton: true },
    });
    const need = withTier.filter((r) => r.packetsPerCarton == null);
    if (need.length === 0) {
        console.log("No OrderItems need packetsPerCarton backfill.");
        return;
    }
    const productIds = [...new Set(need.map((r) => r.productId))];
    const products = await prisma_1.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, packetsPerCarton: true },
    });
    const pmap = new Map(products.map((p) => [p.id, p.packetsPerCarton ?? null]));
    let n = 0;
    for (const row of need) {
        await prisma_1.prisma.orderItem.update({
            where: { id: row.id },
            data: { packetsPerCarton: pmap.get(row.productId) ?? null },
        });
        n++;
        if (n % 200 === 0)
            console.log(`… packetsPerCarton backfill ${n}/${need.length}`);
    }
    console.log(`Backfilled packetsPerCarton on ${n} OrderItem(s).`);
}
async function main() {
    const rawItems = asOrderItemDocArray(await prisma_1.prisma.orderItem.findRaw({
        filter: {
            $and: [
                {
                    $or: [
                        { unitPricePerCarton: { $exists: true } },
                        { gstPercent: { $exists: true } },
                    ],
                },
                {
                    $or: [{ pricingTier: { $exists: false } }, { pricingTier: null }],
                },
            ],
        },
    }));
    console.log(`Found ${rawItems.length} legacy OrderItem document(s) (unitPrice/gstPercent).`);
    let migrated = 0;
    let errors = 0;
    for (const doc of rawItems) {
        try {
            const id = toObjectIdString(doc._id);
            const orderId = toObjectIdString(doc.orderId);
            const productId = toObjectIdString(doc.productId);
            const order = await prisma_1.prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    Customer: {
                        select: { CustomerDetail: { select: { dbCategory: true } } },
                    },
                },
            });
            const dbCategory = (0, orderItemPriceSnapshot_1.resolveDbCategory)(order?.Customer ?? null);
            const product = await prisma_1.prisma.product.findUnique({
                where: { id: productId },
                select: { packetsPerCarton: true },
            });
            await prisma_1.prisma.orderItem.update({
                where: { id },
                data: legacyPricingPayload(dbCategory, doc.unitPricePerCarton, doc.unitPricePerPacket, doc.gstPercent, product?.packetsPerCarton ?? null),
            });
            await prisma_1.prisma.$runCommandRaw({
                update: "OrderItem",
                updates: [
                    {
                        q: { _id: { $oid: id } },
                        u: {
                            $unset: {
                                unitPricePerCarton: "",
                                unitPricePerPacket: "",
                                gstPercent: "",
                            },
                        },
                        multi: false,
                    },
                ],
            });
            migrated++;
            if (migrated % 100 === 0) {
                console.log(`… migrated ${migrated}`);
            }
        }
        catch (e) {
            errors++;
            console.error("migrate item failed:", e);
        }
    }
    console.log(`Legacy migrate done. Migrated=${migrated}, errors=${errors}.`);
    await backfillMissingPacketsPerCarton();
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
//# sourceMappingURL=migrateOrderItemPriceSnapshot.js.map