"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOT_DISCONTINUED_PRODUCT_WHERE = void 0;
exports.escapeMongoContains = escapeMongoContains;
/**
 * Active catalog: omit discontinued only.
 * Prisma+Mongo `{ isDiscontinued: { not: true } }` drops documents where the
 * boolean was never persisted (see getProductsForDistributor).
 */
exports.NOT_DISCONTINUED_PRODUCT_WHERE = {
    OR: [
        { isDiscontinued: false },
        { isDiscontinued: null },
        { isDiscontinued: { isSet: false } },
    ],
};
/** Prisma Mongo `contains` is a regex; escape so `(`, `.`, etc. match literally. */
function escapeMongoContains(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//# sourceMappingURL=productFilters.js.map