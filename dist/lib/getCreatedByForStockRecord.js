"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCreatedByForStockRecord = getCreatedByForStockRecord;
const prisma_1 = require("./prisma");
/** Resolve createdBy for StockRecord: req.user or first ADMIN/SUPER_ADMIN user. */
async function getCreatedByForStockRecord(req) {
    const user = req.user;
    if (user?.id)
        return user.id;
    const admin = await prisma_1.prisma.user.findFirst({
        where: { userType: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
    });
    if (!admin)
        throw new Error("No admin user found for StockRecord createdBy");
    return admin.id;
}
//# sourceMappingURL=getCreatedByForStockRecord.js.map