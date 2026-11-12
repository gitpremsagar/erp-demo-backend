export type OrderTwoSideDistanceSource = {
  customerId: string;
  DeliveryAddress: { twoSideDistance: number; userId: string } | null;
  Customer?: {
    CustomerDetail?: { twoSideDistance: number }[];
    DeliveryAddress?: { twoSideDistance: number }[];
  };
};

export function resolveOrderTwoSideDistance(
  order: OrderTwoSideDistanceSource
): number {
  const linked = order.DeliveryAddress;
  if (linked && linked.userId === order.customerId) {
    return linked.twoSideDistance;
  }

  const defaultAddressDistance =
    order.Customer?.DeliveryAddress?.[0]?.twoSideDistance;
  if (defaultAddressDistance != null) {
    return defaultAddressDistance;
  }

  return order.Customer?.CustomerDetail?.[0]?.twoSideDistance ?? 0;
}

export const orderTwoSideDistanceSelect = {
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
} as const;
