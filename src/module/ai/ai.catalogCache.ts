import { prisma } from "../../lib/prisma";

export interface CatalogProduct {
  id: string;
  name: string;
  productCode: string;
  mrp: number;
  gstPercentage: number | null;
  packetsPerCarton: number | null;
  costPricePerCarton: number | null;
  costPricePerPacket: number | null;
  sellingPricePerCartonForDb: number | null;
  sellingPricePerPacketForDb: number | null;
  sellingPricePerCartonForRss: number | null;
  sellingPricePerPacketForRss: number | null;
  festivePricePerPacket: number | null;
  festivePricePerCarton: number | null;
  cartonsPerPallet: number | null;
  lifeOfProduct: number | null;
  lowStockLimit: number;
  isDiscontinued: boolean | null;
}

export interface CatalogTransporter {
  id: string;
  name: string;
}

export interface CatalogStatusType {
  id: string;
  name: string;
  displayName: string | null;
  sortOrder: number;
}

export interface Catalog {
  products: CatalogProduct[];
  transporters: CatalogTransporter[];
  statusTypes: CatalogStatusType[];
  loadedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: Catalog | null = null;

export async function getCatalog(force = false): Promise<Catalog> {
  if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached;
  }

  const [products, transporters, statusTypes] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        productCode: true,
        mrp: true,
        gstPercentage: true,
        packetsPerCarton: true,
        costPricePerCarton: true,
        costPricePerPacket: true,
        sellingPricePerCartonForDb: true,
        sellingPricePerPacketForDb: true,
        sellingPricePerCartonForRss: true,
        sellingPricePerPacketForRss: true,
        festivePricePerPacket: true,
        festivePricePerCarton: true,
        cartonsPerPallet: true,
        lifeOfProduct: true,
        lowStockLimit: true,
        isDiscontinued: true,
      },
      take: 20000,
    }),
    prisma.transporter.findMany({
      select: { id: true, name: true },
      take: 5000,
    }),
    prisma.orderStatusType.findMany({
      select: { id: true, name: true, displayName: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  cached = {
    products,
    transporters,
    statusTypes,
    loadedAt: Date.now(),
  };
  return cached;
}

export function invalidateCatalogCache(): void {
  cached = null;
}
