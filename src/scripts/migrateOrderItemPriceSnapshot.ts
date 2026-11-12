/**
 * Migrates legacy OrderItem fields unitPricePerCarton, unitPricePerPacket, gstPercent
 * to sparse Product-mirror snapshot fields + pricingTier + packetsPerCarton.
 *
 * Run from backend root after prisma db push / generate:
 *   npx ts-node src/scripts/migrateOrderItemPriceSnapshot.ts
 */

import "dotenv/config";
import { OrderItemPricingTier } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { deriveCartonRateFromPacket, resolveDbCategory } from "../lib/orderItemPriceSnapshot";

function toObjectIdString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "$oid" in (v as Record<string, unknown>)) {
    return (v as { $oid: string }).$oid;
  }
  throw new Error(`Unsupported id shape: ${JSON.stringify(v)}`);
}

function legacyPricingPayload(
  dbCategory: string,
  unitPricePerCarton: number | null | undefined,
  unitPricePerPacket: number | null | undefined,
  gstPct: number | null | undefined,
  packetsPerCarton: number | null | undefined
): {
  pricingTier: OrderItemPricingTier;
  gstPercentage: number;
  packetsPerCarton: number | null;
  costPricePerCarton: number | null;
  costPricePerPacket: number | null;
  sellingPricePerCartonForDb: number | null;
  sellingPricePerPacketForDb: number | null;
  sellingPricePerCartonForRss: number | null;
  sellingPricePerPacketForRss: number | null;
} {
  const gstPercentage = gstPct ?? 0;
  const carton = unitPricePerCarton ?? 0;
  const packet = unitPricePerPacket ?? 0;
  const ppc = packetsPerCarton ?? null;

  if (dbCategory === "RSS") {
    return {
      pricingTier: OrderItemPricingTier.RSS,
      gstPercentage,
      packetsPerCarton: ppc,
      costPricePerCarton: null,
      costPricePerPacket: null,
      sellingPricePerCartonForDb: null,
      sellingPricePerPacketForDb: null,
      sellingPricePerCartonForRss: deriveCartonRateFromPacket(packet, carton, ppc),
      sellingPricePerPacketForRss: packet,
    };
  }
  if (dbCategory === "SS") {
    return {
      pricingTier: OrderItemPricingTier.SS,
      gstPercentage,
      packetsPerCarton: ppc,
      costPricePerCarton: deriveCartonRateFromPacket(packet, carton, ppc),
      costPricePerPacket: packet,
      sellingPricePerCartonForDb: null,
      sellingPricePerPacketForDb: null,
      sellingPricePerCartonForRss: null,
      sellingPricePerPacketForRss: null,
    };
  }
  return {
    pricingTier: OrderItemPricingTier.DB,
    gstPercentage,
    packetsPerCarton: ppc,
    costPricePerCarton: null,
    costPricePerPacket: null,
    sellingPricePerCartonForDb: deriveCartonRateFromPacket(packet, carton, ppc),
    sellingPricePerPacketForDb: packet,
    sellingPricePerCartonForRss: null,
    sellingPricePerPacketForRss: null,
  };
}

function asOrderItemDocArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }
  const cursor =
    raw && typeof raw === "object" && "cursor" in (raw as object)
      ? (raw as { cursor?: { firstBatch?: unknown } }).cursor
      : undefined;
  if (cursor?.firstBatch && Array.isArray(cursor.firstBatch)) {
    return cursor.firstBatch as Record<string, unknown>[];
  }
  if (
    raw &&
    typeof raw === "object" &&
    "documents" in (raw as object) &&
    Array.isArray((raw as { documents: unknown }).documents)
  ) {
    return (raw as { documents: Record<string, unknown>[] }).documents;
  }
  return [];
}

async function backfillMissingPacketsPerCarton(): Promise<void> {
  const withTier = await prisma.orderItem.findMany({
    where: { pricingTier: { not: null } },
    select: { id: true, productId: true, packetsPerCarton: true },
  });
  const need = withTier.filter((r) => r.packetsPerCarton == null);
  if (need.length === 0) {
    console.log("No OrderItems need packetsPerCarton backfill.");
    return;
  }
  const productIds = [...new Set(need.map((r) => r.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, packetsPerCarton: true },
  });
  const pmap = new Map(products.map((p) => [p.id, p.packetsPerCarton ?? null]));
  let n = 0;
  for (const row of need) {
    await prisma.orderItem.update({
      where: { id: row.id },
      data: { packetsPerCarton: pmap.get(row.productId) ?? null },
    });
    n++;
    if (n % 200 === 0) console.log(`… packetsPerCarton backfill ${n}/${need.length}`);
  }
  console.log(`Backfilled packetsPerCarton on ${n} OrderItem(s).`);
}

async function main() {
  const rawItems = asOrderItemDocArray(
    await prisma.orderItem.findRaw({
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
    })
  );

  console.log(`Found ${rawItems.length} legacy OrderItem document(s) (unitPrice/gstPercent).`);

  let migrated = 0;
  let errors = 0;

  for (const doc of rawItems) {
    try {
      const id = toObjectIdString(doc._id);
      const orderId = toObjectIdString(doc.orderId);
      const productId = toObjectIdString(doc.productId);
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          Customer: {
            select: { CustomerDetail: { select: { dbCategory: true } } },
          },
        },
      });
      const dbCategory = resolveDbCategory(order?.Customer ?? null);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { packetsPerCarton: true },
      });

      await prisma.orderItem.update({
        where: { id },
        data: legacyPricingPayload(
          dbCategory,
          doc.unitPricePerCarton as number | null | undefined,
          doc.unitPricePerPacket as number | null | undefined,
          doc.gstPercent as number | null | undefined,
          product?.packetsPerCarton ?? null
        ),
      });

      await prisma.$runCommandRaw({
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
    } catch (e) {
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
    await prisma.$disconnect();
  });
