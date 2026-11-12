"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProductChangeSnapshot = buildProductChangeSnapshot;
exports.buildProductChangeSnapshotRow = buildProductChangeSnapshotRow;
function buildProductChangeSnapshot(product, tagRelations, changeType, changedAt) {
    return {
        ...buildProductChangeSnapshotFields(product, tagRelations, changeType, changedAt),
        Product: { connect: { id: product.id } },
    };
}
function buildProductChangeSnapshotRow(product, tagRelations, changeType, changedAt) {
    return {
        ...buildProductChangeSnapshotFields(product, tagRelations, changeType, changedAt),
        productId: product.id,
    };
}
function buildProductChangeSnapshotFields(product, tagRelations, changeType, changedAt) {
    const tagIds = tagRelations.map((r) => r.productTagId);
    const tagNames = tagRelations.map((r) => r.ProductTag?.name ?? r.productTagId);
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
//# sourceMappingURL=productChangeSnapshot.js.map