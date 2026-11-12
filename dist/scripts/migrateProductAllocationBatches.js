"use strict";
/**
 * One-off: migrate ProductAllocation.stockBatchId into ProductAllocationBatch join docs,
 * then unset stockBatchId on ProductAllocation.
 *
 * Run from backend root (after prisma generate / db push):
 *   npx ts-node src/scripts/migrateProductAllocationBatches.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
function oidString(value) {
    if (!value)
        return null;
    if (typeof value === "string")
        return value;
    if (value.$oid)
        return value.$oid;
    return String(value);
}
async function main() {
    const findResult = (await prisma_1.prisma.$runCommandRaw({
        find: "ProductAllocation",
        filter: { stockBatchId: { $exists: true } },
        projection: { _id: 1, stockBatchId: 1 },
    }));
    const docs = findResult.cursor?.firstBatch ?? [];
    console.log(`Found ${docs.length} allocation(s) with legacy stockBatchId.`);
    let created = 0;
    let skipped = 0;
    for (const doc of docs) {
        const allocationId = oidString(doc._id);
        const stockBatchId = oidString(doc.stockBatchId);
        if (!allocationId || !stockBatchId) {
            skipped += 1;
            continue;
        }
        const existing = await prisma_1.prisma.productAllocationBatch.findUnique({
            where: { stockBatchId },
            select: { id: true },
        });
        if (existing) {
            skipped += 1;
        }
        else {
            await prisma_1.prisma.productAllocationBatch.create({
                data: {
                    allocationId,
                    stockBatchId,
                },
            });
            created += 1;
        }
    }
    const unsetResult = (await prisma_1.prisma.$runCommandRaw({
        update: "ProductAllocation",
        updates: [
            {
                q: { stockBatchId: { $exists: true } },
                u: { $unset: { stockBatchId: "" } },
                multi: true,
            },
        ],
    }));
    console.log(`Created ${created} ProductAllocationBatch row(s); skipped ${skipped}.`);
    console.log(`Unset stockBatchId on ${unsetResult.nModified ?? unsetResult.n ?? 0} allocation(s).`);
    console.log("Done.");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
//# sourceMappingURL=migrateProductAllocationBatches.js.map