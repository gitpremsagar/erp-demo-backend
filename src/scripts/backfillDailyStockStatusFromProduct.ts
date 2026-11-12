/**
 * One-off: copy current Product stock-status extras into today's DailyStockStatus.
 *
 * From backend root:
 *   npm run backfill:daily-stock-status
 */
import { prisma } from "../lib/prisma";
import { toIstYmd } from "../lib/schemeDates";
import {
  dailyStockStatusDayBounds,
  upsertDailyStockStatus,
  type DailyStockStatusPatch,
} from "../lib/dailyStockStatus";

async function main() {
  const today = toIstYmd(new Date());
  const { snapshotDate } = dailyStockStatusDayBounds(today);
  console.log(`Backfilling DailyStockStatus for ${today} (${snapshotDate.toISOString()})...`);

  const products = await prisma.product.findMany({
    select: {
      id: true,
      productCode: true,
      allocation: true,
      dip: true,
      pendingQuantity: true,
      arsQuantity: true,
      manualOrderQuantity: true,
      requirement: true,
      tallyQuantity: true,
      tallyRemark: true,
      dmsQuantity: true,
      dmsRemark: true,
      tallyQtyUpdatedAt: true,
      dmsQtyUpdatedAt: true,
    },
  });

  let upserted = 0;
  let skipped = 0;

  for (const p of products) {
    const patch: DailyStockStatusPatch = {};
    if (p.allocation != null) patch.allocation = p.allocation;
    if (p.dip != null) patch.dip = p.dip;
    if (p.pendingQuantity != null) patch.pendingQuantity = p.pendingQuantity;
    if (p.arsQuantity != null) patch.arsQuantity = p.arsQuantity;
    if (p.manualOrderQuantity != null) {
      patch.manualOrderQuantity = p.manualOrderQuantity;
    }
    if (p.requirement != null) patch.requirement = p.requirement;
    if (p.tallyQuantity != null) patch.tallyQuantity = p.tallyQuantity;
    if (p.tallyRemark != null && p.tallyRemark.trim() !== "") {
      patch.tallyRemark = p.tallyRemark;
    }
    if (p.dmsQuantity != null) patch.dmsQuantity = p.dmsQuantity;
    if (p.dmsRemark != null && p.dmsRemark.trim() !== "") {
      patch.dmsRemark = p.dmsRemark;
    }

    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    await upsertDailyStockStatus({
      dateStr: today,
      productId: p.id,
      patch,
    });
    upserted += 1;
  }

  console.log(`Done. upserted=${upserted} skippedEmpty=${skipped} totalProducts=${products.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
