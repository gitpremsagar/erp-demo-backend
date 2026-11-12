"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderTwoSideDistanceSelect = void 0;
exports.resolveOrderTwoSideDistance = resolveOrderTwoSideDistance;
function resolveOrderTwoSideDistance(order) {
    const linked = order.DeliveryAddress;
    if (linked && linked.userId === order.customerId) {
        return linked.twoSideDistance;
    }
    const defaultAddressDistance = order.Customer?.DeliveryAddress?.[0]?.twoSideDistance;
    if (defaultAddressDistance != null) {
        return defaultAddressDistance;
    }
    return order.Customer?.CustomerDetail?.[0]?.twoSideDistance ?? 0;
}
exports.orderTwoSideDistanceSelect = {
    customerId: true,
    DeliveryAddress: { select: { twoSideDistance: true, userId: true } },
    Customer: {
        select: {
            CustomerDetail: { select: { dbName: true, twoSideDistance: true }, take: 1 },
            DeliveryAddress: {
                where: { default: true },
                select: { twoSideDistance: true },
                take: 1,
            },
        },
    },
};
//# sourceMappingURL=orderTwoSideDistance.js.map