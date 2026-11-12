import type { Prisma, ProductChangeType } from "@prisma/client";

type ProductWithRelations = {
  id: string;
  name: string;
  mrp: number;
  productCode: string;
  lowStockLimit: number;
  overStockLimit: number;
  categoryId: string;
  subCategoryId: string | null;
  grammage: number | null;
  productGroupId: string | null;
  lifeOfProduct: number | null;
  imageUrl: string | null;
  cartonsPerPallet: number | null;
  packetsPerCarton: number | null;
  schemePercentage: number | null;
  plantId: string | null;
  isDiscontinued: boolean | null;
  positionSerialNumber: number | null;
  gstPercentage: number | null;
  costPricePerPacket: number | null;
  costPricePerPacketWithGst: number | null;
  costPricePerCarton: number | null;
  costPricePerCartonWithGst: number | null;
  sellingPricePerPacketForDb: number | null;
  sellingPricePerPacketForDbWithGst: number | null;
  sellingPricePerCartonForDb: number | null;
  sellingPricePerCartonForDbWithGst: number | null;
  marginPercentageForDb: number | null;
  sellingPricePerPacketForRss: number | null;
  sellingPricePerPacketForRssWithGst: number | null;
  sellingPricePerCartonForRss: number | null;
  sellingPricePerCartonForRssWithGst: number | null;
  marginPercentageForRss: number | null;
  marginDiff: number | null;
  festivePricePerPacket: number | null;
  festivePricePerCarton: number | null;
  Category?: { name: string } | null;
  SubCategory?: { name: string } | null;
  ProductGroup?: { name: string } | null;
  Plant?: { name: string } | null;
};

type TagRelationInput =
  | { productTagId: string; ProductTag?: { name: string } | null }
  | { productTagId: string; ProductTag: { name: string } };

export function buildProductChangeSnapshot(
  product: ProductWithRelations,
  tagRelations: TagRelationInput[],
  changeType: ProductChangeType,
  changedAt?: Date
): Prisma.ProductChangeHistoryCreateInput {
  return {
    ...buildProductChangeSnapshotFields(product, tagRelations, changeType, changedAt),
    Product: { connect: { id: product.id } },
  };
}

export function buildProductChangeSnapshotRow(
  product: ProductWithRelations,
  tagRelations: TagRelationInput[],
  changeType: ProductChangeType,
  changedAt?: Date
): Prisma.ProductChangeHistoryCreateManyInput {
  return {
    ...buildProductChangeSnapshotFields(product, tagRelations, changeType, changedAt),
    productId: product.id,
  };
}

function buildProductChangeSnapshotFields(
  product: ProductWithRelations,
  tagRelations: TagRelationInput[],
  changeType: ProductChangeType,
  changedAt?: Date
): Omit<Prisma.ProductChangeHistoryCreateManyInput, "productId"> {
  const tagIds = tagRelations.map((r) => r.productTagId);
  const tagNames = tagRelations.map(
    (r) => r.ProductTag?.name ?? r.productTagId
  );

  return {
    changeType,
    changedAt: changedAt ?? new Date(),
    name: product.name,
    mrp: product.mrp,
    productCode: product.productCode,
    lowStockLimit: product.lowStockLimit,
    overStockLimit: product.overStockLimit,
    categoryId: product.categoryId,
    subCategoryId: product.subCategoryId,
    grammage: product.grammage,
    productGroupId: product.productGroupId,
    lifeOfProduct: product.lifeOfProduct,
    imageUrl: product.imageUrl,
    cartonsPerPallet: product.cartonsPerPallet,
    packetsPerCarton: product.packetsPerCarton,
    schemePercentage: product.schemePercentage,
    plantId: product.plantId,
    isDiscontinued: product.isDiscontinued,
    positionSerialNumber: product.positionSerialNumber,
    gstPercentage: product.gstPercentage,
    costPricePerPacket: product.costPricePerPacket,
    costPricePerPacketWithGst: product.costPricePerPacketWithGst,
    costPricePerCarton: product.costPricePerCarton,
    costPricePerCartonWithGst: product.costPricePerCartonWithGst,
    sellingPricePerPacketForDb: product.sellingPricePerPacketForDb,
    sellingPricePerPacketForDbWithGst: product.sellingPricePerPacketForDbWithGst,
    sellingPricePerCartonForDb: product.sellingPricePerCartonForDb,
    sellingPricePerCartonForDbWithGst: product.sellingPricePerCartonForDbWithGst,
    marginPercentageForDb: product.marginPercentageForDb,
    sellingPricePerPacketForRss: product.sellingPricePerPacketForRss,
    sellingPricePerPacketForRssWithGst: product.sellingPricePerPacketForRssWithGst,
    sellingPricePerCartonForRss: product.sellingPricePerCartonForRss,
    sellingPricePerCartonForRssWithGst: product.sellingPricePerCartonForRssWithGst,
    marginPercentageForRss: product.marginPercentageForRss,
    marginDiff: product.marginDiff,
    festivePricePerPacket: product.festivePricePerPacket,
    festivePricePerCarton: product.festivePricePerCarton,
    categoryName: product.Category?.name ?? null,
    subCategoryName: product.SubCategory?.name ?? null,
    productGroupName: product.ProductGroup?.name ?? null,
    plantName: product.Plant?.name ?? null,
    tagIds,
    tagNames,
  };
}
