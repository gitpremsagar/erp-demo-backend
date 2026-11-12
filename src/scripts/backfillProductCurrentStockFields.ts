/**
 * One-off: copy latest OpeningStock extras onto Product current-status fields.
 * Reads leftover OpeningStock Mongo fields even after they were dropped from Prisma.
 *
 * From backend root:
 *   npm run backfill:product-current-stock-fields
 */
import { prisma } from "../lib/prisma";

type OpeningExtraDoc = {
  productId?: { $oid?: string } | string;
  snapshotDate?: { $date?: string } | string | Date;
  allocation?: number | null;
  dip?: number | null;
  pendingQuantity?: number | null;
  requirement?: number | null;
  tallyQuantity?: number | null;
  remarks?: string | null;
};

function oidString(value: { $oid?: string } | string | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function asDate(value: OpeningExtraDoc["snapshotDate"]): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value.$date) {
    const d = new Date(value.$date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function loadOpeningExtras(): Promise<OpeningExtraDoc[]> {
  const docs: OpeningExtraDoc[] = [];
  let cursorId: unknown = null;
  for (;;) {
    const command = cursorId
      ? { getMore: cursorId, collection: "OpeningStock" }
      : {
          find: "OpeningStock",
          filter: {},
          projection: {
            productId: 1,
            snapshotDate: 1,
            allocation: 1,
            dip: 1,
            pendingQuantity: 1,
            requirement: 1,
            tallyQuantity: 1,
            remarks: 1,
          },
          batchSize: 500,
        };
    const result = (await prisma.$runCommandRaw(command)) as {
      cursor?: {
        id?: unknown;
        firstBatch?: OpeningExtraDoc[];
        nextBatch?: OpeningExtraDoc[];
      };
    };
    const batch =
      result.cursor?.firstBatch ?? result.cursor?.nextBatch ?? [];
    docs.push(...batch);
    cursorId = result.cursor?.id;
    if (!cursorId || cursorId === 0 || cursorId === "0") break;
  }
  return docs;
}

async function main() {
  console.log("Loading OpeningStock extras...");
  const openingRows = await loadOpeningExtras();

  const latestByProduct = new Map<
    string,
    { snapshotDate: Date; doc: OpeningExtraDoc }
  >();
  for (const row of openingRows) {
    const productId = oidString(row.productId);
    const snapshotDate = asDate(row.snapshotDate);
    if (!productId || !snapshotDate) continue;
    const existing = latestByProduct.get(productId);
    if (!existing || snapshotDate > existing.snapshotDate) {
      latestByProduct.set(productId, { snapshotDate, doc: row });
    }
  }

  const products = await prisma.product.findMany({
    select: {
      id: true,
      allocation: true,
      dip: true,
      pendingQuantity: true,
      requirement: true,
      tallyQuantity: true,
      tallyRemark: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const latest = latestByProduct.get(product.id)?.doc;
    if (!latest) {
      skipped += 1;
      continue;
    }

    const data: {
      allocation?: number | null;
      dip?: number | null;
      pendingQuantity?: number | null;
      requirement?: number | null;
      tallyQuantity?: number | null;
      tallyRemark?: string | null;
    } = {};

    if (product.allocation == null && latest.allocation != null) {
      data.allocation = latest.allocation;
    }
    if (product.dip == null && latest.dip != null) {
      data.dip = latest.dip;
    }
    if (product.pendingQuantity == null && latest.pendingQuantity != null) {
      data.pendingQuantity = latest.pendingQuantity;
    }
    if (product.requirement == null && latest.requirement != null) {
      data.requirement = latest.requirement;
    }
    if (product.tallyQuantity == null && latest.tallyQuantity != null) {
      data.tallyQuantity = latest.tallyQuantity;
    }
    const remarks = latest.remarks?.trim() || null;
    if (product.tallyRemark == null && remarks) {
      data.tallyRemark = remarks;
    }

    if (Object.keys(data).length === 0) {
      skipped += 1;
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data,
    });
    updated += 1;
  }

  console.log(`Updated ${updated} product(s); skipped ${skipped}.`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
