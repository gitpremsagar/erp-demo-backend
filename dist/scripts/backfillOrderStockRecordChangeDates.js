"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Reset order-linked StockRecord.changeDate to the actual write time (createdAt).
 * Fixes rows that were stamped with order date instead of deduction time.
 *
 * From backend root:
 *   npm run backfill:order-stock-record-dates
 *   npm run backfill:order-stock-record-dates -- --dry-run
 */
const prisma_1 = require("../lib/prisma");
const stockRecordChangeMeta_1 = require("../lib/stockRecordChangeMeta");
const openingStockSnapshot_1 = require("../lib/openingStockSnapshot");
const schemeDates_1 = require("../lib/schemeDates");
const ORDER_LEDGER_REASONS = ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"];
const DEFAULT_LOOKBACK_DAYS = 30;
function parseArgs() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const lookbackIdx = args.indexOf("--lookback-days");
    const lookbackDays = lookbackIdx >= 0 && args[lookbackIdx + 1]
        ? Math.max(1, parseInt(args[lookbackIdx + 1], 10) || DEFAULT_LOOKBACK_DAYS)
        : DEFAULT_LOOKBACK_DAYS;
    return { dryRun, lookbackDays };
}
async function main() {
    const { dryRun, lookbackDays } = parseArgs();
    const todayYmd = (0, schemeDates_1.toIstYmd)(new Date());
    const windowStart = (0, schemeDates_1.istDayStart)((0, openingStockSnapshot_1.addIstDays)(todayYmd, -(lookbackDays - 1)));
    const records = await prisma_1.prisma.stockRecord.findMany({
        where: {
            orderId: { not: null },
            reason: { in: [...ORDER_LEDGER_REASONS] },
            createdAt: { gte: windowStart },
            changeDate: { not: null },
        },
        select: {
            id: true,
            changeInStock: true,
            changeDate: true,
            createdAt: true,
            reason: true,
            orderId: true,
        },
        orderBy: { createdAt: "asc" },
    });
    const toFix = records.filter((r) => {
        if (!r.changeDate)
            return false;
        return (0, schemeDates_1.toIstYmd)(r.changeDate) !== (0, schemeDates_1.toIstYmd)(r.createdAt);
    });
    console.log(`Found ${toFix.length} order ledger row(s) with changeDate IST day != createdAt IST day (of ${records.length} in last ${lookbackDays} days)`);
    if (toFix.length === 0) {
        console.log("Nothing to update.");
        return;
    }
    for (const row of toFix) {
        const corrected = (0, stockRecordChangeMeta_1.toChangeDateIst)(row.createdAt);
        console.log(`  ${row.id} ${row.reason} order=${row.orderId} changeDate ${(0, schemeDates_1.toIstYmd)(row.changeDate)} -> ${(0, schemeDates_1.toIstYmd)(corrected)} (createdAt)`);
        if (dryRun)
            continue;
        const meta = (0, stockRecordChangeMeta_1.buildStockRecordChangeFields)({
            changeInStock: row.changeInStock,
            changeDate: row.createdAt,
        });
        await prisma_1.prisma.stockRecord.update({
            where: { id: row.id },
            data: meta,
        });
    }
    if (dryRun) {
        console.log("Dry run — no rows updated.");
        return;
    }
    console.log(`Updated ${toFix.length} row(s). Rebuilding recent opening stock snapshots...`);
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
//# sourceMappingURL=backfillOrderStockRecordChangeDates.js.map