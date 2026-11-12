/**
 * One-off script: set orderStatusTypeId to a given value on all orders.
 * Run from backend root: npx ts-node src/scripts/setOrderStatusTypeId.ts
 */

import { prisma } from "../lib/prisma";

const ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";

async function main() {
  const result = await prisma.order.updateMany({
    data: { orderStatusTypeId: ORDER_STATUS_TYPE_ID },
  });
  console.log(`Updated ${result.count} order(s) with orderStatusTypeId = "${ORDER_STATUS_TYPE_ID}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
