/**
 * One-off: map ENTERED -> ARRIVED in MongoDB (legacy value removed from Prisma enum).
 * Run from backend root: npm run script:migrate-purchase-entered-to-arrived
 */

import { prisma } from "../lib/prisma";

const COLLECTIONS = ["Purchase", "StockBatch", "PurchaseStockBatch"] as const;

async function migrateCollection(collection: (typeof COLLECTIONS)[number]) {
  const result = (await prisma.$runCommandRaw({
    update: collection,
    updates: [
      {
        q: { purchaseTransportStatus: "ENTERED" },
        u: { $set: { purchaseTransportStatus: "ARRIVED" } },
        multi: true,
      },
    ],
  })) as { n?: number; nModified?: number };

  const modified = result.nModified ?? result.n ?? 0;
  console.log(`Updated ${modified} document(s) in ${collection}.`);
  return modified;
}

async function main() {
  let total = 0;
  for (const collection of COLLECTIONS) {
    total += await migrateCollection(collection);
  }
  console.log(`Done. Total documents updated: ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
