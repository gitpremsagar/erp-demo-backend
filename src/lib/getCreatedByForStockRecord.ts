import type { Request } from "express";
import { prisma } from "./prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";

/** Resolve createdBy for StockRecord: req.user or first ADMIN/SUPER_ADMIN user. */
export async function getCreatedByForStockRecord(req: Request): Promise<string> {
  const user = (req as AuthenticatedRequest).user as { id?: string } | undefined;
  if (user?.id) return user.id;
  const admin = await prisma.user.findFirst({
    where: { userType: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user found for StockRecord createdBy");
  return admin.id;
}
