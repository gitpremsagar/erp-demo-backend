import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type InStockSummary = {
  stockQuantity: number;
  oldestArrivalDate: Date | null;
  nearestExpiryDate: Date | null;
};

export async function fetchLastOrderDateByProductId(
  productIds: string[]
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (productIds.length === 0) return map;

  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { in: productIds } },
    _max: { orderDate: true },
  });

  for (const row of rows) {
    if (row._max.orderDate) {
      map.set(row.productId, row._max.orderDate);
    }
  }
  return map;
}

export async function fetchInStockSummaryByProductId(
  productIds: string[]
): Promise<Map<string, InStockSummary>> {
  const map = new Map<string, InStockSummary>();
  if (productIds.length === 0) return map;

  const rows = await prisma.stockBatch.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      stockQuantity: { gt: 0 },
    },
    _sum: { stockQuantity: true },
    _min: { arrivalDate: true, expiryDate: true },
  });

  for (const row of rows) {
    map.set(row.productId, {
      stockQuantity: row._sum.stockQuantity ?? 0,
      oldestArrivalDate: row._min.arrivalDate,
      nearestExpiryDate: row._min.expiryDate,
    });
  }
  return map;
}

const LIST_SCHEME_SELECT = {
  id: true,
  productId: true,
  schemePercentage: true,
  slab1MinCb: true,
  slab1MaxCb: true,
  slab1Percent: true,
  slab2MinCb: true,
  slab2MaxCb: true,
  slab2Percent: true,
  slab3MinCb: true,
  slab3MaxCb: true,
  slab3Percent: true,
  slab4MinCb: true,
  slab4MaxCb: true,
  slab4Percent: true,
  startDate: true,
  endDate: true,
  isActive: true,
} as const;

type ListScheme = Prisma.ProductSchemeGetPayload<{
  select: typeof LIST_SCHEME_SELECT;
}>;

export async function fetchActiveSchemesByProductId(
  productIds: string[]
): Promise<Map<string, ListScheme[]>> {
  const map = new Map<string, ListScheme[]>();
  if (productIds.length === 0) return map;

  const schemes = await prisma.productScheme.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
    },
    select: LIST_SCHEME_SELECT,
  });

  for (const scheme of schemes) {
    const list = map.get(scheme.productId);
    if (list) list.push(scheme);
    else map.set(scheme.productId, [scheme]);
  }
  return map;
}
