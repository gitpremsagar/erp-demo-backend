/**
 * One-time backfill: create an initial CREATE snapshot for every product
 * that does not yet have change history.
 *
 * Run from backend root:
 *   npm run backfill:product-history
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildProductChangeSnapshotRow } from "../lib/productChangeSnapshot";

const BATCH_SIZE = 500;

async function main() {
  console.log("Loading products...");
  const [products, existingHistory] = await Promise.all([
    prisma.product.findMany({
      include: {
        Category: true,
        ProductGroup: true,
        Plant: true,
        ProductTagRelation: {
          include: { ProductTag: true },
        },
      },
    }),
    prisma.productChangeHistory.findMany({
      select: { productId: true },
      distinct: ["productId"],
    }),
  ]);

  const productIdsWithHistory = new Set(
    existingHistory.map((row) => row.productId)
  );

  const rows: Prisma.ProductChangeHistoryCreateManyInput[] = [];

  for (const product of products) {
    if (productIdsWithHistory.has(product.id)) {
      continue;
    }

    const tagRelations = product.ProductTagRelation.map((r) => ({
      productTagId: r.productTagId,
      ProductTag: r.ProductTag,
    }));

    rows.push(
      buildProductChangeSnapshotRow(
        product,
        tagRelations,
        "CREATE",
        product.createdAt ?? new Date()
      )
    );
  }

  const skipped = products.length - rows.length;

  if (rows.length === 0) {
    console.log(
      `Backfill complete. Processed: 0, Skipped: ${skipped}, Errors: 0`
    );
    return;
  }

  console.log(`Inserting ${rows.length} history rows in batches of ${BATCH_SIZE}...`);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.productChangeHistory.createMany({
        data: batch,
      });
      processed += result.count;
    } catch (err) {
      errors += batch.length;
      console.error(
        `Failed to insert batch starting at index ${i} (${batch.length} rows):`,
        err
      );
    }
  }

  console.log(
    `Backfill complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
