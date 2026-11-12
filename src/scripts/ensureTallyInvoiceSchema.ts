/**
 * Ensures Tally invoice fields/indexes exist on MongoDB.
 * prisma db push can fail on unrelated unique indexes (null duplicates);
 * this script applies only what we need for tallyInvoiceId.
 *
 * Run: npx ts-node src/scripts/ensureTallyInvoiceSchema.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create sparse unique index so multiple nulls are allowed, but non-null IDs are unique.
  await prisma.$runCommandRaw({
    createIndexes: "Order",
    indexes: [
      {
        key: { tallyInvoiceId: 1 },
        name: "Order_tallyInvoiceId_sparse_key",
        unique: true,
        sparse: true,
      },
    ],
  });
  console.log("Created sparse unique index Order_tallyInvoiceId_sparse_key");

  // Ensure counter collection + unique FY index (inserting a doc creates the collection).
  const existing = await prisma.tallyInvoiceCounter.findFirst();
  if (!existing) {
    // Collection may not exist yet; createIndexes on empty name works after first write.
    // Write and delete a seed row for current FY placeholder, or just rely on upsert later.
    console.log("TallyInvoiceCounter has no rows yet (ok — created on first allocate).");
  }

  try {
    await prisma.$runCommandRaw({
      createIndexes: "TallyInvoiceCounter",
      indexes: [
        {
          key: { financialYear: 1 },
          name: "TallyInvoiceCounter_financialYear_key",
          unique: true,
        },
      ],
    });
    console.log("Created unique index TallyInvoiceCounter_financialYear_key");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists") || msg.includes("IndexOptionsConflict")) {
      console.log("TallyInvoiceCounter financialYear index already exists");
    } else {
      // Collection may not exist until first insert — create via upsert
      await prisma.tallyInvoiceCounter.upsert({
        where: { financialYear: "__bootstrap__" },
        create: { financialYear: "__bootstrap__", nextNumber: 1 },
        update: {},
      });
      await prisma.tallyInvoiceCounter.delete({ where: { financialYear: "__bootstrap__" } });
      await prisma.$runCommandRaw({
        createIndexes: "TallyInvoiceCounter",
        indexes: [
          {
            key: { financialYear: 1 },
            name: "TallyInvoiceCounter_financialYear_key",
            unique: true,
          },
        ],
      });
      console.log("Bootstrapped TallyInvoiceCounter and created unique index");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
