import type { Prisma } from "@prisma/client";

/**
 * Active catalog: omit discontinued only.
 * Prisma+Mongo `{ isDiscontinued: { not: true } }` drops documents where the
 * boolean was never persisted (see getProductsForDistributor).
 */
export const NOT_DISCONTINUED_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  OR: [
    { isDiscontinued: false },
    { isDiscontinued: null },
    { isDiscontinued: { isSet: false } },
  ],
};

/** Prisma Mongo `contains` is a regex; escape so `(`, `.`, etc. match literally. */
export function escapeMongoContains(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
