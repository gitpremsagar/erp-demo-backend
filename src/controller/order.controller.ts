import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { applyStockLedgerDelta } from "../lib/applyStockLedgerDelta";
import { getCreatedByForStockRecord } from "../lib/getCreatedByForStockRecord";
import { buildOrderItemPriceSnapshot, resolveDbCategory } from "../lib/orderItemPriceSnapshot";
import { buildStockRecordChangeFields, defaultChangeDateIst } from "../lib/stockRecordChangeMeta";
import {
  resolveTallyInvoiceId,
  resolveManualTallyInvoiceIdUpdate,
  normalizeTallyInvoiceId,
  ensureCounterAtLeast,
  assertTallyInvoiceIdAvailable,
} from "../lib/tallyInvoiceId";
import { getMisSalesHistoryEarliestYmd, schemeActiveOn } from "../lib/schemeDates";
import {
  hasOrderItemQuantityChanges,
  isVerifiedOrderItemEditLocked,
  ORDER_ITEM_EDIT_LOCKED_MESSAGE,
} from "../lib/orderItemEditLock";
import {
  buildOrderItemQtyDeltas,
  propagateOpeningStockAfterOrderQtyChange,
} from "../lib/propagateOpeningStockAfterOrderQtyChange";

function relatedDocumentLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function relatedDocumentsMessage(creditNoteCount: number, salesReturnCount: number): string {
  const counted: string[] = [];
  const generic: string[] = [];
  if (creditNoteCount > 0) {
    counted.push(relatedDocumentLabel(creditNoteCount, "credit note", "credit notes"));
    generic.push(creditNoteCount === 1 ? "credit note" : "credit notes");
  }
  if (salesReturnCount > 0) {
    counted.push(relatedDocumentLabel(salesReturnCount, "sales return", "sales returns"));
    generic.push(salesReturnCount === 1 ? "sales return" : "sales returns");
  }
  const docs = counted.join(" and ");
  const genericDocs = generic.join(" and ");
  return `This order cannot be deleted because it has ${docs}. Delete the related ${genericDocs} first, then try again.`;
}

async function countOrderRelatedDocuments(orderId: string) {
  const [creditNoteCount, salesReturnCount] = await Promise.all([
    prisma.creditNote.count({ where: { orderId } }),
    prisma.salesReturn.count({ where: { orderId } }),
  ]);
  return { creditNoteCount, salesReturnCount };
}

function relatedDocumentsPayload(creditNoteCount: number, salesReturnCount: number) {
  return {
    message: relatedDocumentsMessage(creditNoteCount, salesReturnCount),
    creditNoteCount,
    salesReturnCount,
  };
}

function isRelatedDocumentsConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    meta?: { relation_name?: string; model_a_name?: string; model_b_name?: string };
  };
  if (e.code !== "P2014") return false;
  const relation = e.meta?.relation_name ?? "";
  const models = `${e.meta?.model_a_name ?? ""} ${e.meta?.model_b_name ?? ""}`;
  return (
    relation.includes("CreditNote") ||
    relation.includes("SalesReturn") ||
    models.includes("CreditNote") ||
    models.includes("SalesReturn")
  );
}

// Order status type IDs (from OrderStatusType collection - anshGroupErp.OrderStatusType)
const PENDING_ORDER_STATUS_TYPE_ID = "699f1bcc58a2f2472223b361";
const MODIFYING_ORDER_STATUS_TYPE_ID = "699f1bff58a2f2472223b362";
const COMPLETED_ORDER_STATUS_TYPE_ID = "699fac111dcdb78a50623ee9";

interface OrderItemInput {
  productId: string;
  quantity: number;
  /** Admin-set per-line discount % (scheme-like). Omit to leave unchanged on update. */
  itemDiscountPercent?: number | null;
  /** Whether to use festive price for this item. */
  isFestivePrice?: boolean;
}

/** Normalize for write: 0/null → null; undefined means caller should omit/preserve. */
function normalizeItemDiscountPercent(
  value: number | null | undefined
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === 0) return null;
  return value;
}

function itemDiscountPercentForWrite(
  incoming: number | null | undefined,
  existing?: number | null
): number | null {
  const normalized = normalizeItemDiscountPercent(incoming);
  if (normalized !== undefined) return normalized;
  return existing ?? null;
}

async function withSalesHistoryDriver<T extends { driverId: string | null }>(
  orders: T[]
): Promise<Array<T & { Driver: { id: string; name: string } | null }>> {
  const driverIds = [
    ...new Set(orders.map((o) => o.driverId).filter((id): id is string => Boolean(id))),
  ];
  const drivers =
    driverIds.length === 0
      ? []
      : await prisma.user.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true },
      });
  const nameById = new Map(drivers.map((d) => [d.id, d.name]));
  return orders.map((o) => ({
    ...o,
    Driver: o.driverId
      ? { id: o.driverId, name: nameById.get(o.driverId) ?? "" }
      : null,
  }));
}

export const createOrder = async (req: Request, res: Response) => {
  try {
    // console.log("createOrder req.body", req.body);
    const currentUser = (req as AuthenticatedRequest).user as { id?: string; userType?: string } | undefined;
    const isRestrictedCreator =
      currentUser?.userType === "SALES_OFFICER" || currentUser?.userType === "CUSTOMER";

    // Sales officers and distributors may only create unverified Pending drafts; admin-only fields are ignored.
    const requestBody = isRestrictedCreator
      ? {
        customerId: req.body.customerId,
        orderItems: req.body.orderItems,
        orderDate: req.body.orderDate,
        deliveryAddressId: req.body.deliveryAddressId,
        orderGeneratorId: currentUser!.id,
        orderStatusTypeId: PENDING_ORDER_STATUS_TYPE_ID,
        isVerifiedByAdmin: false,
      }
      : req.body;

    const {
      customerId,
      orderItems,
      vehicleId,
      driverId,
      orderGeneratorId,
      orderDate,
      orderStatusTypeId,
      isVerifiedByAdmin,
      deliveryAddressId,
      tallyInvoiceId,
      discountPercent,
      cashDiscountPercent,
      narration,
      dmsInvoiceNumber,
      tripNumber,
      sheetTag,
      tallyValue,
      dmsValue,
      diffReason,
      valuesAutoMatched,
      isManuallyConfirmed,
    } = requestBody as {
      customerId: string;
      orderItems: OrderItemInput[];
      vehicleId?: string;
      driverId?: string;
      orderGeneratorId?: string;
      orderDate?: string;
      orderStatusTypeId?: string;
      isVerifiedByAdmin?: boolean;
      deliveryAddressId?: string;
      tallyInvoiceId?: string | null;
      discountPercent?: number | null;
      cashDiscountPercent?: number | null;
      narration?: string | null;
      dmsInvoiceNumber?: string | null;
      tripNumber?: number | null;
      sheetTag?: string | null;
      tallyValue?: number | null;
      dmsValue?: number | null;
      diffReason?: string | null;
      valuesAutoMatched?: boolean | null;
      isManuallyConfirmed?: boolean | null;
    };

    if (!orderItems?.length) {
      return res.status(400).json({ message: "At least one order item is required" });
    }

    const productIds = orderItems.map((item) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length !== productIds.length) {
      return res.status(400).json({ message: "Duplicate product IDs in order items" });
    }

    for (const item of orderItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ message: `Invalid quantity for product ${item.productId}` });
      }
    }

    if (currentUser?.userType === "SALES_OFFICER") {
      const assignment = await prisma.salesOfficerAssignment.findFirst({
        where: { salesOfficerId: currentUser.id, distributorId: customerId },
        select: { id: true },
      });
      if (!assignment) {
        return res.status(403).json({
          message: "You can only create orders for your assigned distributors",
        });
      }
    } else if (currentUser?.userType === "CUSTOMER" && customerId !== currentUser.id) {
      return res.status(403).json({ message: "You can only create orders for yourself" });
    }

    let isAdmin = false;
    let adminId = orderGeneratorId;
    let creatorUserType = currentUser?.userType;

    if (currentUser) {
      isAdmin = currentUser.userType === "ADMIN";
      adminId = currentUser.id ?? orderGeneratorId;
    } else if (orderGeneratorId) {
      const creator = await prisma.user.findUnique({
        where: { id: orderGeneratorId },
        select: { userType: true },
      });
      isAdmin = creator?.userType === "ADMIN";
      adminId = orderGeneratorId;
      creatorUserType = creator?.userType;
    }

    if (!creatorUserType && currentUser?.id) {
      const row = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { userType: true },
      });
      creatorUserType = row?.userType;
    }

    const isFinalizedByDistributor = creatorUserType !== "CUSTOMER";

    const shouldVerifyAndDeductNow =
      isAdmin && (isVerifiedByAdmin === undefined ? true : isVerifiedByAdmin === true);

    const productPriceSelect = {
      id: true,
      name: true,
      productCode: true,
      isDiscontinued: true,
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
    } as const;

    // Build a map of which items want festive pricing
    const festivePriceByProductId = new Map<string, boolean>();
    for (const item of orderItems) {
      if (item.isFestivePrice) {
        festivePriceByProductId.set(item.productId, true);
      }
    }

    // --- Phase 1: All reads OUTSIDE the transaction (parallel) ---
    const validationQueries: Promise<unknown>[] = [
      prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, CustomerDetail: { select: { dbCategory: true } } },
      }),
      prisma.product.findMany({ where: { id: { in: uniqueProductIds } }, select: { ...productPriceSelect } }),
    ];

    if (shouldVerifyAndDeductNow) {
      validationQueries.push(
        prisma.stockBatch.findMany({
          where: {
            productId: { in: uniqueProductIds },
            stockQuantity: { gt: 0 },
            // isArchived: false,
          },
          orderBy: { arrivalDate: "asc" },
        })
      );
    }

    if (orderStatusTypeId) {
      validationQueries.push(
        prisma.orderStatusType.findUnique({ where: { id: orderStatusTypeId }, select: { id: true } })
      );
    }

    if (vehicleId) {
      validationQueries.push(
        prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } })
      );
    }

    if (driverId) {
      validationQueries.push(
        prisma.user.findUnique({ where: { id: driverId }, select: { id: true, userType: true } })
      );
    }

    const [customer, products, ...rest] = await Promise.all(validationQueries);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // If a delivery address is provided, ensure it belongs to the selected customer.
    if (deliveryAddressId) {
      const deliveryAddress = await prisma.deliveryAddress.findFirst({
        where: { id: deliveryAddressId, userId: customerId },
        select: { id: true },
      });

      if (!deliveryAddress) {
        return res.status(400).json({
          message: "Delivery address not found for the selected customer",
        });
      }
    }

    type ProductRowForSnapshot = {
      id: string;
      name: string;
      productCode: string;
      isDiscontinued: boolean;
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
    };
    const productList = products as ProductRowForSnapshot[];
    if (productList.length !== uniqueProductIds.length) {
      const foundIds = new Set(productList.map((p) => p.id));
      const missing = uniqueProductIds.filter((id) => !foundIds.has(id));
      return res.status(404).json({ message: `Products not found: ${missing.join(", ")}` });
    }

    if (isRestrictedCreator) {
      const discontinued = productList.filter((p) => p.isDiscontinued === true);
      if (discontinued.length > 0) {
        const labels = discontinued.map((p) => `${p.name} (${p.productCode})`).join(", ");
        return res.status(400).json({
          message: `Discontinued products cannot be ordered: ${labels}`,
        });
      }
    }

    const dbCategoryForPricing = resolveDbCategory(
      customer as { CustomerDetail?: Array<{ dbCategory?: string | null }> } | null
    );
    const priceSnapshotByProductId = new Map(
      productList.map((p) => [
        p.id,
        buildOrderItemPriceSnapshot(p, dbCategoryForPricing, festivePriceByProductId.get(p.id)),
      ])
    );

    let restIdx = 0;
    type StockBatchRow = { id: string; productId: string; stockQuantity: number; arrivalDate: Date; isArchived: boolean };
    let prefetchedBatches: StockBatchRow[] = [];
    if (shouldVerifyAndDeductNow) {
      prefetchedBatches = rest[restIdx] as StockBatchRow[];
      restIdx++;
    }
    if (orderStatusTypeId) {
      if (!rest[restIdx]) {
        return res.status(404).json({ message: "Order status type not found" });
      }
      restIdx++;
    }
    if (vehicleId) {
      if (!rest[restIdx]) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      restIdx++;
    }
    if (driverId) {
      const driver = rest[restIdx] as { id: string; userType: string } | null | undefined;
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userType !== "DRIVER") {
        return res.status(400).json({ message: "Selected user is not a driver" });
      }
    }

    const productMap = new Map(productList.map((p) => [p.id, p.name]));
    const parsedOrderDate = orderDate ? new Date(orderDate) : new Date();
    const effectiveStatusId = orderStatusTypeId || PENDING_ORDER_STATUS_TYPE_ID;
    const isCompleted = effectiveStatusId === COMPLETED_ORDER_STATUS_TYPE_ID;
    const createdBy = currentUser?.id ?? orderGeneratorId!;

    // --- Phase 2: Pre-compute all stock deduction decisions in memory ---
    // This way the transaction body does ONLY writes — zero reads.
    let stockDeductionPlan: {
      batchId: string;
      newQty: number;
      archive: boolean;
      productId: string;
      deduction: number;
    }[] = [];

    if (shouldVerifyAndDeductNow) {
      const adminItems = orderItems.filter((item) => item.quantity > 0);
      if (adminItems.length > 0) {
        const batchesByProduct = new Map<string, StockBatchRow[]>();
        for (const batch of prefetchedBatches) {
          const arr = batchesByProduct.get(batch.productId) ?? [];
          arr.push(batch);
          batchesByProduct.set(batch.productId, arr);
        }

        for (const item of adminItems) {
          const batches = batchesByProduct.get(item.productId) ?? [];
          const stockAvailable = batches.reduce((sum, b) => sum + b.stockQuantity, 0);
          if (stockAvailable < item.quantity) {
            const productLabel = productMap.get(item.productId) ?? item.productId;
            // console.log("batches", batches);
            return res.status(400).json({
              message: `Insufficient stock for product "${productLabel}". Available: ${stockAvailable}, Required: ${item.quantity}`,
            });
          }

          let remaining = item.quantity;
          for (const batch of batches) {
            if (remaining <= 0) break;
            const deduction = Math.min(batch.stockQuantity, remaining);
            const newQty = batch.stockQuantity - deduction;

            stockDeductionPlan.push({
              batchId: batch.id,
              newQty,
              archive: newQty === 0,
              productId: item.productId,
              deduction,
            });

            batch.stockQuantity = newQty;
            remaining -= deduction;
          }
        }
      }
    }

    const capturePriceSnapshot = shouldVerifyAndDeductNow && stockDeductionPlan.length > 0;

    // --- Phase 3: Transaction — writes only, no reads ---
    const completeOrder = await prisma.$transaction(async (tx) => {
      let resolvedTallyInvoiceId: string | undefined;
      if (shouldVerifyAndDeductNow) {
        resolvedTallyInvoiceId = await resolveTallyInvoiceId(
          tx,
          parsedOrderDate,
          tallyInvoiceId
        );
      } else if (tallyInvoiceId != null && String(tallyInvoiceId).trim() !== "") {
        // Draft: store manual ID only (no auto-allocate)
        const parsed = normalizeTallyInvoiceId(tallyInvoiceId);
        if (parsed) {
          await assertTallyInvoiceIdAvailable(tx, parsed.normalized);
          await ensureCounterAtLeast(tx, parsed.financialYear, parsed.number);
          resolvedTallyInvoiceId = parsed.normalized;
        }
      }

      const newOrder = await tx.order.create({
        data: {
          customerId,
          vehicleId,
          ...(driverId ? { driverId } : {}),
          orderDate: parsedOrderDate,
          orderStatusTypeId: effectiveStatusId,
          orderCreatorId: createdBy,
          isFinalizedByDistributor,
          ...(deliveryAddressId ? { deliveryAddressId } : {}),
          ...(resolvedTallyInvoiceId ? { tallyInvoiceId: resolvedTallyInvoiceId } : {}),
          ...(discountPercent != null && discountPercent !== 0
            ? { discountPercent }
            : {}),
          ...(cashDiscountPercent != null && cashDiscountPercent !== 0
            ? { cashDiscountPercent }
            : {}),
          ...(narration != null && String(narration).trim() !== ""
            ? { narration: String(narration).trim() }
            : {}),
          ...(dmsInvoiceNumber != null && String(dmsInvoiceNumber).trim() !== ""
            ? { dmsInvoiceNumber: String(dmsInvoiceNumber).trim() }
            : {}),
          ...(tripNumber != null ? { tripNumber } : {}),
          ...(sheetTag != null && String(sheetTag).trim() !== ""
            ? { sheetTag: String(sheetTag).trim() }
            : {}),
          ...(tallyValue != null ? { tallyValue } : {}),
          ...(dmsValue != null ? { dmsValue } : {}),
          ...(diffReason != null && String(diffReason).trim() !== ""
            ? { diffReason: String(diffReason).trim() }
            : {}),
          ...(valuesAutoMatched != null ? { valuesAutoMatched } : {}),
          ...(isManuallyConfirmed != null ? { isManuallyConfirmed } : {}),
          ...(shouldVerifyAndDeductNow && adminId
            ? {
              isVerifiedByAdmin: true,
              verifiedByAdminId: adminId,
              verifiedAt: new Date(),
            }
            : {}),
        },
      });

      const writeOps: Promise<unknown>[] = [
        tx.orderItem.createMany({
          data: orderItems.map((item) => {
            const snap = priceSnapshotByProductId.get(item.productId);
            const priceFields = capturePriceSnapshot && snap ? { ...snap } : {};
            return {
              orderId: newOrder.id,
              productId: item.productId,
              quantity: item.quantity,
              customerId,
              orderCompleted: isCompleted,
              orderDate: parsedOrderDate,
              itemDiscountPercent: itemDiscountPercentForWrite(
                item.itemDiscountPercent
              ),
              isFestivePrice: item.isFestivePrice === true ? true : false,
              ...priceFields,
            };
          }),
        }),
      ];

      if (stockDeductionPlan.length > 0) {
        for (const plan of stockDeductionPlan) {
          writeOps.push(
            tx.stockBatch.update({
              where: { id: plan.batchId },
              data: {
                stockQuantity: plan.newQty,
                ...(plan.archive ? { isArchived: true } : {}),
              },
            })
          );
        }

        writeOps.push(
          tx.stockRecord.createMany({
            data: stockDeductionPlan.map((plan) => ({
              productId: plan.productId,
              changeInStock: -plan.deduction,
              createdBy,
              orderId: newOrder.id,
              stockBatchId: plan.batchId,
              reason: "ASSIGNED_TO_ORDER" as const,
              ...buildStockRecordChangeFields({
                changeInStock: -plan.deduction,
                changeDate: defaultChangeDateIst(),
              }),
            })),
          })
        );
      }

      await Promise.all(writeOps);

      // Return the order with all relations in one query instead of a separate post-transaction fetch
      return tx.order.findUniqueOrThrow({
        where: { id: newOrder.id },
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              CustomerDetail: { select: { dbName: true, dbCategory: true } },
            },
          },
          Vehicle: {
            select: {
              id: true,
              vehicleName: true,
              vehicleNumber: true,
              VehicleType: { select: { name: true } },
            },
          },
          DeliveryAddress: true,
          OrderStatusType: true,
          StockRecord: { select: { id: true, reason: true, changeInStock: true, productId: true } },
          OrderItem: {
            include: {
              Product: {
                select: {
                  id: true,
                  name: true,
                  productCode: true,
                  mrp: true,
                  costPricePerCarton: true,
                  costPricePerCartonWithGst: true,
                  sellingPricePerCartonForDb: true,
                  sellingPricePerCartonForDbWithGst: true,
                  sellingPricePerCartonForRss: true,
                  sellingPricePerCartonForRssWithGst: true,
                },
              },
            },
          },
        },
      });
    }, {
      timeout: 90_000,
    });

    return res.status(201).json({ order: completeOrder });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    if (err.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    if (err instanceof Error && (
      err.message.includes("Tally invoice ID") ||
      err.message.includes("Invalid Tally invoice")
    )) {
      return res.status(400).json({ message: err.message });
    }
    console.error("Error creating order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Verify order for stock - Admin-only endpoint.
 * For orders created by sales officers or distributors (no stock deducted at creation),
 * admin can verify stock availability and deduct from stock batches.
 * Uses FIFO logic. Initial stock deduction happens only here, not in update/modification.
 *
 * Accepts optional body: { orderItems, customerId, vehicleId, orderStatusTypeId }
 * When orderItems is provided (e.g. from modify form), replaces order items with these before deducting.
 * When not provided, uses existing order items (e.g. from order detail "Verify Stock" button).
 */
export const verifyOrderForStock = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const {
      orderItems: bodyOrderItems,
      customerId: bodyCustomerId,
      vehicleId: bodyVehicleId,
      driverId: bodyDriverId,
      orderStatusTypeId: bodyOrderStatusTypeId,
      orderDate: bodyOrderDate,
      tallyInvoiceId: bodyTallyInvoiceId,
    } = req.body as {
      orderItems?: OrderItemInput[];
      customerId?: string;
      vehicleId?: string;
      driverId?: string | null;
      orderStatusTypeId?: string | null;
      orderDate?: string;
      tallyInvoiceId?: string | null;
    };

    const currentUser = (req as AuthenticatedRequest).user as { id?: string; userType?: string } | undefined;
    const adminId = currentUser?.id;
    // Note: `requireAdmin` middleware allows ADMIN, SUPER_ADMIN, and MIS.
    // Keep this controller check aligned, otherwise those users can fail here.
    const isAdmin =
      currentUser?.userType === "ADMIN" ||
      currentUser?.userType === "SUPER_ADMIN" ||
      currentUser?.userType === "MIS";

    if (!isAdmin || !adminId) {
      return res.status(403).json({ message: "Admin access required to verify order stock" });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: {
          include: { Product: true },
        },
        OrderStatusType: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (existingOrder.orderStatusTypeId === COMPLETED_ORDER_STATUS_TYPE_ID) {
      return res.status(400).json({
        message: "Cannot verify stock for completed orders",
      });
    }

    if (existingOrder.isVerifiedByAdmin) {
      return res.status(400).json({
        message: "Order stock has already been verified and reserved",
      });
    }

    // Use form orderItems if provided, else existing DB order items
    const itemsToVerify: OrderItemInput[] =
      bodyOrderItems && bodyOrderItems.length > 0
        ? bodyOrderItems
        : (existingOrder.OrderItem ?? []).map((oi) => ({
          productId: oi.productId,
          quantity: oi.quantity,
          itemDiscountPercent: oi.itemDiscountPercent ?? null,
          isFestivePrice: oi.isFestivePrice === true,
        }));

    const filteredItems = itemsToVerify.filter((i) => i.quantity > 0);
    if (filteredItems.length === 0) {
      return res.status(400).json({ message: "Order has no items to verify" });
    }

    const customerIdToUse = bodyCustomerId ?? existingOrder.customerId;
    const vehicleIdToUse = bodyVehicleId !== undefined ? bodyVehicleId : existingOrder.vehicleId;
    const driverIdToUse = bodyDriverId !== undefined ? bodyDriverId : existingOrder.driverId;
    const orderStatusTypeIdToUse =
      bodyOrderStatusTypeId !== undefined ? bodyOrderStatusTypeId : existingOrder.orderStatusTypeId;
    const orderDateToUse = bodyOrderDate ? new Date(bodyOrderDate) : existingOrder.orderDate;

    if (driverIdToUse) {
      const driver = await prisma.user.findUnique({
        where: { id: driverIdToUse },
        select: { id: true, userType: true },
      });
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userType !== "DRIVER") {
        return res.status(400).json({ message: "Selected user is not a driver" });
      }
    }

    const uniqueVerifyProductIds = [...new Set(filteredItems.map((i) => i.productId))];
    const verifyProductSelect = {
      id: true,
      name: true,
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
    } as const;

    const [verifyProducts, verifyCustomer] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: uniqueVerifyProductIds } },
        select: { ...verifyProductSelect },
      }),
      prisma.user.findUnique({
        where: { id: customerIdToUse },
        select: { CustomerDetail: { select: { dbCategory: true } } },
      }),
    ]);

    if (verifyProducts.length !== uniqueVerifyProductIds.length) {
      const found = new Set(verifyProducts.map((p) => p.id));
      const missing = uniqueVerifyProductIds.filter((id) => !found.has(id));
      return res.status(404).json({
        message: `Product(s) not found: ${missing.join(", ")}`,
      });
    }

    const verifyDbCategory = resolveDbCategory(
      verifyCustomer as { CustomerDetail?: Array<{ dbCategory?: string | null }> } | null
    );
    const verifyFestiveByProductId = new Map<string, boolean>();
    for (const item of filteredItems) {
      if (item.isFestivePrice) {
        verifyFestiveByProductId.set(item.productId, true);
      }
    }
    const verifyPriceSnapshotByProductId = new Map(
      verifyProducts.map((p) => [
        p.id,
        buildOrderItemPriceSnapshot(p, verifyDbCategory, verifyFestiveByProductId.get(p.id)),
      ])
    );
    const verifyProductById = new Map(verifyProducts.map((p) => [p.id, p]));

    // Validate stock availability
    for (const item of filteredItems) {
      const product = verifyProductById.get(item.productId);
      const stockBatches = await prisma.stockBatch.findMany({
        where: {
          productId: item.productId,
          stockQuantity: { gt: 0 },
          // isArchived: false,
        },
      });
      const totalAvailableStock = stockBatches.reduce((sum, b) => sum + b.stockQuantity, 0);
      if (totalAvailableStock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ${product?.name ?? item.productId}. Available: ${totalAvailableStock}, Required: ${item.quantity}`,
        });
      }
    }

    await prisma.$transaction(
      async (tx) => {
        let resolvedTallyInvoiceId: string | undefined;
        if (!existingOrder.tallyInvoiceId) {
          resolvedTallyInvoiceId = await resolveTallyInvoiceId(
            tx,
            orderDateToUse,
            bodyTallyInvoiceId
          );
        } else if (bodyTallyInvoiceId !== undefined && bodyTallyInvoiceId !== null && String(bodyTallyInvoiceId).trim() !== "") {
          // Allow overriding on verify if admin supplies a new value
          resolvedTallyInvoiceId = await resolveTallyInvoiceId(
            tx,
            orderDateToUse,
            bodyTallyInvoiceId,
            orderId
          );
        }

        // Update order metadata (including verification fields)
        await tx.order.update({
          where: { id: orderId },
          data: {
            customerId: customerIdToUse,
            vehicleId: vehicleIdToUse,
            driverId: driverIdToUse,
            orderStatusTypeId: orderStatusTypeIdToUse,
            orderDate: orderDateToUse,
            isVerifiedByAdmin: true,
            verifiedByAdminId: adminId,
            verifiedAt: new Date(),
            ...(resolvedTallyInvoiceId ? { tallyInvoiceId: resolvedTallyInvoiceId } : {}),
          },
        });

        // Replace order items when form provided new ones
        if (bodyOrderItems && bodyOrderItems.length > 0) {
          await tx.orderItem.deleteMany({ where: { orderId } });
          const orderItemsData = filteredItems.map((item) => {
            const snap = verifyPriceSnapshotByProductId.get(item.productId)!;
            return {
              orderId,
              productId: item.productId,
              quantity: item.quantity,
              customerId: customerIdToUse,
              orderCompleted: false,
              orderDate: orderDateToUse,
              itemDiscountPercent: itemDiscountPercentForWrite(
                item.itemDiscountPercent
              ),
              isFestivePrice: item.isFestivePrice === true ? true : false,
              ...snap,
            };
          });
          await tx.orderItem.createMany({
            data: orderItemsData,
          });
        }

        // Deduct stock (FIFO)
        const assignedRecordsData: {
          productId: string;
          changeInStock: number;
          createdBy: string;
          orderId: string;
          stockBatchId: string;
          reason: "ASSIGNED_TO_ORDER";
        }[] = [];

        for (const item of filteredItems) {
          const stockBatches = await tx.stockBatch.findMany({
            where: {
              productId: item.productId,
              stockQuantity: { gt: 0 },
              // isArchived: false,
            },
            orderBy: { arrivalDate: "asc" },
          });

          let remainingQuantity = item.quantity;
          for (const stockBatch of stockBatches) {
            if (remainingQuantity <= 0) break;

            if (stockBatch.stockQuantity >= remainingQuantity) {
              await tx.stockBatch.update({
                where: { id: stockBatch.id },
                data: { stockQuantity: stockBatch.stockQuantity - remainingQuantity },
              });
              assignedRecordsData.push({
                productId: item.productId,
                changeInStock: -remainingQuantity,
                createdBy: adminId,
                orderId,
                stockBatchId: stockBatch.id,
                reason: "ASSIGNED_TO_ORDER",
              });
              remainingQuantity = 0;
            } else {
              await tx.stockBatch.update({
                where: { id: stockBatch.id },
                data: { stockQuantity: 0, isArchived: true },
              });
              assignedRecordsData.push({
                productId: item.productId,
                changeInStock: -stockBatch.stockQuantity,
                createdBy: adminId,
                orderId,
                stockBatchId: stockBatch.id,
                reason: "ASSIGNED_TO_ORDER",
              });
              remainingQuantity -= stockBatch.stockQuantity;
            }
          }
        }

        if (assignedRecordsData.length > 0) {
          await tx.stockRecord.createMany({
            data: assignedRecordsData.map((r) => ({
              ...r,
              ...buildStockRecordChangeFields({
                changeInStock: r.changeInStock,
                changeDate: defaultChangeDateIst(),
              }),
            })),
          });
        }

        if (!bodyOrderItems || bodyOrderItems.length === 0) {
          await Promise.all(
            filteredItems.map((item) => {
              const snap = verifyPriceSnapshotByProductId.get(item.productId)!;
              return tx.orderItem.updateMany({
                where: { orderId, productId: item.productId },
                data: { ...snap },
              });
            })
          );
        }
      },
      { timeout: 90000 } // 90 seconds timeout
    );

    const completeOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Customer: { include: { CustomerDetail: { select: { dbName: true } } } },
        Vehicle: { include: { VehicleType: true } },
        DeliveryAddress: true,
        OrderStatusType: true,
        StockRecord: true,
        OrderItem: {
          include: {
            Product: true,
            Customer: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Order stock verified and reserved successfully",
      order: completeOrder,
    });
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes("Tally invoice ID") ||
      error.message.includes("Invalid Tally invoice")
    )) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error verifying order for stock:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create sales history (without stock operations)
// Bulk insert by admin: set isVerifiedByAdmin=true when creator is admin
export const createSalesHistory = async (req: Request, res: Response) => {
  try {
    const { customerId, orderItems, vehicleId, orderDate, orderStatusTypeId, orderGeneratorId, tallyInvoiceId } = req.body;

    let isAdmin = false;
    let verifiedById = orderGeneratorId;
    const currentUser = (req as AuthenticatedRequest).user as { id?: string; userType?: string } | undefined;
    if (currentUser) {
      isAdmin = currentUser.userType === "ADMIN";
      verifiedById = currentUser.id ?? orderGeneratorId;
    } else if (orderGeneratorId) {
      const creator = await prisma.user.findUnique({
        where: { id: orderGeneratorId },
        select: { userType: true },
      });
      isAdmin = creator?.userType === "ADMIN";
      verifiedById = orderGeneratorId;
    }

    if (orderStatusTypeId) {
      const statusType = await prisma.orderStatusType.findUnique({
        where: { id: orderStatusTypeId },
      });
      if (!statusType) {
        return res.status(404).json({ message: "Order status type not found" });
      }
    }

    //Comment it out if needed ===================================================
    // Normalize order date to start of day for comparison
    const normalizedOrderDate = orderDate ? new Date(orderDate) : new Date();
    normalizedOrderDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(normalizedOrderDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check if an order already exists with the same customerId and orderDate
    const existingOrder = await prisma.order.findFirst({
      where: {
        customerId,
        orderDate: {
          gte: normalizedOrderDate,
          lt: nextDay,
        },
      },
    });

    if (existingOrder) {
      return res.status(409).json({
        message: "An order already exists for this customer on the specified date"
      });
    }

    // Check if customer exists
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Check if vehicle exists if provided
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
    }

    // Check if all products exist
    for (const item of orderItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product with ID ${item.productId} not found` });
      }
    }

    //============================================================================

    // Create order and order items in a transaction (without stock operations)
    const order = await prisma.$transaction(async (tx) => {
      const parsedSalesOrderDate = orderDate ? new Date(orderDate) : new Date();
      const resolvedTallyInvoiceId = await resolveTallyInvoiceId(
        tx,
        parsedSalesOrderDate,
        tallyInvoiceId
      );

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          customerId,
          vehicleId,
          orderDate: parsedSalesOrderDate,
          orderStatusTypeId: orderStatusTypeId || COMPLETED_ORDER_STATUS_TYPE_ID,
          tallyInvoiceId: resolvedTallyInvoiceId,
          ...(isAdmin && verifiedById
            ? {
              isVerifiedByAdmin: true,
              verifiedByAdminId: verifiedById,
              verifiedAt: parsedSalesOrderDate,
            }
            : {}),
        },
      });

      // Create order items (without stock updates)
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            customerId,
            orderCompleted: true,
            orderDate: parsedSalesOrderDate,
          },
        });
      }

      return newOrder;
    }, {
      timeout: 90000, // 90 seconds timeout
    });

    // Get the complete order with items
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        Customer: true,
        Vehicle: { include: { VehicleType: true } },
        OrderStatusType: true,
        OrderItem: {
          include: {
            Product: true,
            Customer: true,
          },
        },
      },
    });

    res.status(201).json({ order: completeOrder });
  } catch (error) {
    console.error("Error creating sales history:\n", error);
    if (error instanceof Error && (
      error.message.includes("Tally invoice ID") ||
      error.message.includes("Invalid Tally invoice")
    )) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error });
  }
};

// Get all orders with pagination and filtering
export const getOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user as { userType?: string } | undefined;
    if (user?.userType === "WAREHOUSE_MANAGER") {
      return res.status(403).json({
        message: "Use warehouse manager order endpoints for order listing",
      });
    }

    const {
      page = 1,
      limit = 1000,
      orderStatusTypeId,
      customerId,
      startDate,
      endDate,
      includeAllStatuses,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (orderStatusTypeId) {
      where.orderStatusTypeId = orderStatusTypeId;
    } else if (includeAllStatuses !== "true") {
      where.orderStatusTypeId = { not: COMPLETED_ORDER_STATUS_TYPE_ID };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    // Interpret startDate/endDate as IST calendar day bounds
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) {
        where.orderDate.gte = new Date(
          `${startDate as string}T00:00:00.000+05:30`
        );
      }
      if (endDate) {
        where.orderDate.lte = new Date(
          `${endDate as string}T23:59:59.999+05:30`
        );
      }
    }

    // Hide distributor draft orders (self-service, not yet "Send to SS") from admin listing.
    where.NOT = {
      AND: [
        { isFinalizedByDistributor: false },
        { OrderCreator: { is: { userType: "CUSTOMER" } } },
      ],
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              CustomerDetail: {
                select: {
                  dbName: true,
                  dbCategory: true,
                },
              },
            },
          },
          OrderStatusType: true,
          Vehicle: {
            select: {
              vehicleNumber: true,
              VehicleType: { select: { name: true } },
            },
          },
          OrderItem: {
            select: {
              quantity: true,
              productId: true,
              schemeDiscountPercent: true,
              itemDiscountPercent: true,
              pricingTier: true,
              gstPercentage: true,
              packetsPerCarton: true,
              costPricePerCarton: true,
              costPricePerPacket: true,
              sellingPricePerCartonForDb: true,
              sellingPricePerPacketForDb: true,
              sellingPricePerCartonForRss: true,
              sellingPricePerPacketForRss: true,
              Product: {
                select: {
                  mrp: true,
                  name: true,
                  gstPercentage: true,
                  packetsPerCarton: true,
                  sellingPricePerCartonForRssWithGst: true,
                  sellingPricePerCartonForRss: true,
                  sellingPricePerPacketForRss: true,
                  costPricePerCartonWithGst: true,
                  costPricePerCarton: true,
                  costPricePerPacket: true,
                  sellingPricePerCartonForDbWithGst: true,
                  sellingPricePerCartonForDb: true,
                  sellingPricePerPacketForDb: true,
                  Category: {
                    select: {
                      id: true,
                      name: true,
                      position: true,
                    },
                  },
                },
              },
            },
          },
          OrderCreator: {
            select: {
              id: true,
              name: true,
              userType: true,
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Status types warehouse managers must never see (enforced server-side). */
const WAREHOUSE_MANAGER_HIDDEN_ORDER_STATUS_TYPE_IDS = [
  PENDING_ORDER_STATUS_TYPE_ID,
  MODIFYING_ORDER_STATUS_TYPE_ID,
  COMPLETED_ORDER_STATUS_TYPE_ID,
];

/** Warehouse orders page (board): only these OrderStatusType.name values. */
const WAREHOUSE_ORDERS_PAGE_STATUS_NAMES = ["FINALIZED", "PULLING", "LOADING", "LOADED"] as const;

async function getWarehouseOrdersBoardAllowedStatusTypeIds(): Promise<string[]> {
  const rows = await prisma.orderStatusType.findMany({
    where: { name: { in: [...WAREHOUSE_ORDERS_PAGE_STATUS_NAMES] } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

const warehouseManagerOrdersListInclude = {
  Customer: {
    select: {
      id: true,
      name: true,
      email: true,
      CustomerDetail: {
        select: {
          dbName: true,
          dbCategory: true,
        },
      },
    },
  },
  OrderStatusType: true,
  Vehicle: {
    select: {
      vehicleNumber: true,
      VehicleType: { select: { name: true } },
    },
  },
  OrderItem: {
    select: {
      quantity: true,
      productId: true,
      schemeDiscountPercent: true,
      itemDiscountPercent: true,
      pricingTier: true,
      gstPercentage: true,
      packetsPerCarton: true,
      costPricePerCarton: true,
      costPricePerPacket: true,
      sellingPricePerCartonForDb: true,
      sellingPricePerPacketForDb: true,
      sellingPricePerCartonForRss: true,
      sellingPricePerPacketForRss: true,
      Product: {
        select: {
          mrp: true,
          name: true,
          gstPercentage: true,
          packetsPerCarton: true,
          sellingPricePerCartonForRssWithGst: true,
          sellingPricePerCartonForRss: true,
          sellingPricePerPacketForRss: true,
          costPricePerCartonWithGst: true,
          costPricePerCarton: true,
          costPricePerPacket: true,
          sellingPricePerCartonForDbWithGst: true,
          sellingPricePerCartonForDb: true,
          sellingPricePerPacketForDb: true,
          Category: {
            select: {
              id: true,
              name: true,
              position: true,
            },
          },
        },
      },
    },
  },
  OrderCreator: {
    select: {
      id: true,
      name: true,
      userType: true,
    },
  },
};

function applyIstOrderDateFilter(
  where: Record<string, unknown>,
  startDate?: unknown,
  endDate?: unknown
) {
  if (!startDate && !endDate) return;
  const orderDate: { gte?: Date; lte?: Date } = {};
  if (startDate && typeof startDate === "string") {
    orderDate.gte = new Date(`${startDate}T00:00:00.000+05:30`);
  }
  if (endDate && typeof endDate === "string") {
    orderDate.lte = new Date(`${endDate}T23:59:59.999+05:30`);
  }
  where.orderDate = orderDate;
}

/**
 * Orders for warehouse manager: excludes pending, modifying, and completed.
 * Optional query filters must not widen results into hidden statuses.
 */
export const getOrdersForWarehouseManager = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = req.user as { id?: string; userType?: string };
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const {
      page = 1,
      limit = 1000,
      orderStatusTypeId,
      customerId,
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};

    if (orderStatusTypeId && typeof orderStatusTypeId === "string") {
      if (WAREHOUSE_MANAGER_HIDDEN_ORDER_STATUS_TYPE_IDS.includes(orderStatusTypeId)) {
        return res.status(400).json({
          message: "This order status is not available in the warehouse manager list",
        });
      }
      where.orderStatusTypeId = orderStatusTypeId;
    } else {
      where.orderStatusTypeId = { notIn: WAREHOUSE_MANAGER_HIDDEN_ORDER_STATUS_TYPE_IDS };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate || endDate) {
      applyIstOrderDateFilter(where, startDate, endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: warehouseManagerOrdersListInclude,
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders for warehouse manager:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Warehouse orders board: only Finalized, Pending, and Loading status types (by OrderStatusType.name).
 * Optional orderStatusTypeId must be one of those allowed IDs.
 */
export const getWarehouseManagerOrdersForBoard = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = req.user as { id?: string; userType?: string };
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const {
      page = 1,
      limit = 1000,
      orderStatusTypeId,
      customerId,
      startDate,
      endDate,
    } = req.query;

    const allowedIds = await getWarehouseOrdersBoardAllowedStatusTypeIds();
    if (allowedIds.length === 0) {
      console.warn(
        "Warehouse orders board: no OrderStatusType rows for names",
        WAREHOUSE_ORDERS_PAGE_STATUS_NAMES.join(", ")
      );
    }

    const skip = (Number(page) - 1) * Number(limit);

    if (allowedIds.length === 0) {
      return res.json({
        orders: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: Number(limit),
        },
      });
    }

    const where: Record<string, unknown> = {
      orderStatusTypeId: { in: allowedIds },
    };

    if (orderStatusTypeId && typeof orderStatusTypeId === "string") {
      if (!allowedIds.includes(orderStatusTypeId)) {
        return res.status(400).json({
          message: "This order status is not available on the warehouse orders board",
        });
      }
      where.orderStatusTypeId = orderStatusTypeId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate || endDate) {
      applyIstOrderDateFilter(where, startDate, endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: warehouseManagerOrdersListInclude,
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching warehouse manager orders board:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all orders for the logged-in sales officer (only orders from assigned distributors)
export const getOrdersForSalesOfficer = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = req.user as { id: string; userType?: string };
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const salesOfficerId = user.id;

    const {
      page = 1,
      limit = 1000,
      orderStatusTypeId,
      customerId,
      startDate,
      endDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Get distributor IDs assigned to this sales officer
    const assignments = await prisma.salesOfficerAssignment.findMany({
      where: { salesOfficerId },
      select: { distributorId: true },
    });
    const assignedDistributorIds = assignments.map((a) => a.distributorId);

    // No assigned distributors -> return empty result
    if (assignedDistributorIds.length === 0) {
      return res.json({
        orders: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: Number(limit),
        },
      });
    }

    const where: any = {};

    if (orderStatusTypeId) {
      where.orderStatusTypeId = orderStatusTypeId;
    } else {
      // Default behavior mirrors `getOrders`: exclude completed orders.
      where.orderStatusTypeId = { not: COMPLETED_ORDER_STATUS_TYPE_ID };
    }

    // Always restrict to assigned distributors.
    where.customerId = { in: assignedDistributorIds };

    // If the caller requests a single customer, only honor it when it's assigned.
    if (customerId && assignedDistributorIds.includes(customerId as string)) {
      where.customerId = customerId;
    }

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) {
        where.orderDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.orderDate.lte = new Date(endDate as string);
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              CustomerDetail: {
                select: {
                  dbName: true,
                  dbCategory: true,
                },
              },
            },
          },
          OrderStatusType: true,
          Vehicle: {
            select: {
              vehicleNumber: true,
              VehicleType: { select: { name: true } },
            },
          },
          OrderItem: {
            select: {
              quantity: true,
              productId: true,
              Product: {
                select: {
                  mrp: true,
                  name: true,
                  sellingPricePerCartonForRssWithGst: true,
                  sellingPricePerCartonForRss: true,
                  costPricePerCartonWithGst: true,
                  costPricePerCarton: true,
                  sellingPricePerCartonForDbWithGst: true,
                  sellingPricePerCartonForDb: true,
                  Category: {
                    select: {
                      id: true,
                      name: true,
                      position: true,
                    },
                  },
                },
              },
            },
          },
          OrderCreator: {
            select: {
              id: true,
              name: true,
              userType: true,
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders for sales officer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get sales history (all orders except distributor drafts) with pagination and filtering
export const getSalesHistory = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit,
      customerId,
      startDate,
      endDate,
      deliveryStartDate,
      deliveryEndDate,
      vehicleNumber,
      driverName,
    } = req.query;

    // Date-bounded queries without an explicit limit return all matches (no take).
    const hasExplicitLimit = limit !== undefined && limit !== "";
    const limitNum = hasExplicitLimit ? Math.max(1, Number(limit) || 1000) : 1000;
    const unbounded = Boolean(startDate || endDate) && !hasExplicitLimit;
    const pageNum = Math.max(1, Number(page) || 1);
    const skip = unbounded ? undefined : (pageNum - 1) * limitNum;

    // Hide distributor draft orders (self-service, not yet "Send to SS").
    // Prisma Mongo boolean NOT filters omit documents where the field is unset
    // (legacy completed orders). Exclude by id so those rows still appear.
    const draftOrders = await prisma.order.findMany({
      where: {
        isFinalizedByDistributor: false,
        OrderCreator: { is: { userType: "CUSTOMER" } },
      },
      select: { id: true },
    });
    const where: any = {};
    if (draftOrders.length > 0) {
      where.id = { notIn: draftOrders.map((d) => d.id) };
    }

    if (customerId) {
      where.customerId = customerId;
    }

    let effectiveStartDate =
      typeof startDate === "string" && startDate.trim() ? startDate.trim() : undefined;
    let effectiveEndDate =
      typeof endDate === "string" && endDate.trim() ? endDate.trim() : undefined;

    // MIS may only see the last 3 calendar months on this endpoint (admin Sales History).
    const currentUser = (req as AuthenticatedRequest).user as
      | { userType?: string }
      | undefined;
    if (currentUser?.userType === "MIS") {
      const earliest = getMisSalesHistoryEarliestYmd();
      if (!effectiveStartDate || effectiveStartDate < earliest) {
        effectiveStartDate = earliest;
      }
    }

    // Interpret startDate/endDate as IST (start of day / end of day)
    if (effectiveStartDate || effectiveEndDate) {
      where.orderDate = {};
      if (effectiveStartDate) {
        // Start of day IST (UTC+5:30)
        where.orderDate.gte = new Date(`${effectiveStartDate}T00:00:00.000+05:30`);
      }
      if (effectiveEndDate) {
        // End of day IST
        where.orderDate.lte = new Date(`${effectiveEndDate}T23:59:59.999+05:30`);
      }
    }

    if (deliveryStartDate || deliveryEndDate) {
      where.deliveryDate = {};
      if (deliveryStartDate) {
        where.deliveryDate.gte = new Date(
          `${deliveryStartDate as string}T00:00:00.000+05:30`
        );
      }
      if (deliveryEndDate) {
        where.deliveryDate.lte = new Date(
          `${deliveryEndDate as string}T23:59:59.999+05:30`
        );
      }
    }

    if (typeof vehicleNumber === "string" && vehicleNumber.trim()) {
      where.Vehicle = {
        vehicleNumber: {
          contains: vehicleNumber.trim(),
          mode: "insensitive",
        },
      };
    }

    if (typeof driverName === "string" && driverName.trim()) {
      const matchingDrivers = await prisma.user.findMany({
        where: {
          userType: "DRIVER",
          name: {
            contains: driverName.trim(),
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
      where.driverId = {
        in: matchingDrivers.map((d) => d.id),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        ...(unbounded ? {} : { skip, take: limitNum }),
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              CustomerDetail: {
                select: {
                  dbName: true,
                  dbCategory: true,
                },
              },
            },
          },
          OrderStatusType: true,
          Vehicle: {
            select: {
              id: true,
              vehicleName: true,
              vehicleNumber: true,
            },
          },
          OrderItem: {
            select: {
              quantity: true,
              productId: true,
              Product: {
                select: {
                  mrp: true,
                  name: true,
                  sellingPricePerCartonForRssWithGst: true,
                  sellingPricePerCartonForRss: true,
                  costPricePerCartonWithGst: true,
                  costPricePerCarton: true,
                  sellingPricePerCartonForDbWithGst: true,
                  sellingPricePerCartonForDb: true,
                },
              },
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const ordersOut = await withSalesHistoryDriver(orders);

    const itemsPerPage = unbounded ? total : limitNum;
    const totalPages = unbounded ? 1 : Math.ceil(total / limitNum) || 1;

    res.json({
      orders: ordersOut,
      pagination: {
        currentPage: unbounded ? 1 : pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage,
      },
    });
  } catch (error) {
    console.error("Error fetching sales history:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get sales history for the logged-in sales officer (only orders from assigned distributors)
export const getSalesHistoryForSalesOfficer = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = req.user as { id: string; userType?: string };
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const salesOfficerId = user.id;

    const {
      page = 1,
      limit = 1000,
      customerId,
      startDate,
      endDate,
      deliveryStartDate,
      deliveryEndDate,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Get distributor IDs assigned to this sales officer
    const assignments = await prisma.salesOfficerAssignment.findMany({
      where: { salesOfficerId },
      select: { distributorId: true },
    });
    const assignedDistributorIds = assignments.map((a) => a.distributorId);


    // No assigned distributors -> return empty result
    if (assignedDistributorIds.length === 0) {
      return res.json({
        orders: [],
        pagination: {
          currentPage: Number(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: Number(limit),
        },
      });
    }

    // Build where clause: completed order status type and customerId in assigned distributors
    const where: any = {
      orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID,
      customerId: { in: assignedDistributorIds },
    };

    if (customerId && assignedDistributorIds.includes(customerId as string)) {
      where.customerId = customerId;
    }

    // Interpret startDate/endDate as IST (start of day / end of day)
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) {
        where.orderDate.gte = new Date(`${startDate as string}T00:00:00.000+05:30`);
      }
      if (endDate) {
        where.orderDate.lte = new Date(`${endDate as string}T23:59:59.999+05:30`);
      }
    }

    if (deliveryStartDate || deliveryEndDate) {
      where.deliveryDate = {};
      if (deliveryStartDate) {
        where.deliveryDate.gte = new Date(
          `${deliveryStartDate as string}T00:00:00.000+05:30`
        );
      }
      if (deliveryEndDate) {
        where.deliveryDate.lte = new Date(
          `${deliveryEndDate as string}T23:59:59.999+05:30`
        );
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              CustomerDetail: {
                select: {
                  dbName: true,
                  dbCategory: true,
                },
              },
            },
          },
          OrderStatusType: true,
          Vehicle: {
            select: {
              id: true,
              vehicleName: true,
              vehicleNumber: true,
            },
          },
          OrderItem: {
            select: {
              quantity: true,
              productId: true,
              Product: {
                select: {
                  mrp: true,
                  name: true,
                  sellingPricePerCartonForRssWithGst: true,
                  sellingPricePerCartonForRss: true,
                  costPricePerCartonWithGst: true,
                  costPricePerCarton: true,
                  sellingPricePerCartonForDbWithGst: true,
                  sellingPricePerCartonForDb: true,
                },
              },
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const ordersOut = await withSalesHistoryDriver(orders);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders: ordersOut,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sales history for sales officer:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get orders by driver ID with pagination
export const getOrdersByDriverId = async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { page = 1, limit = 100, orderStatusTypeId } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      driverId,
    };

    if (orderStatusTypeId) {
      where.orderStatusTypeId = orderStatusTypeId;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          Customer: true,
          Vehicle: { include: { VehicleType: true } },
          DeliveryAddress: true,
          OrderStatusType: true,
          OrderItem: {
            include: {
              Product: true,
              Customer: true,
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders by driver ID:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get order statistics
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const [totalOrders, pendingOrders, completedOrders, totalRevenue] =
      await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { orderStatusTypeId: PENDING_ORDER_STATUS_TYPE_ID } }),
        prisma.order.count({ where: { orderStatusTypeId: COMPLETED_ORDER_STATUS_TYPE_ID } }),
        prisma.order.aggregate({
          _sum: {
            totalPrice: true,
          },
        }),
      ]);

    res.json({
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
    });
  } catch (error) {
    console.error("Error fetching order statistics:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

function buildOrderDetailInclude(query: Request["query"]): Record<string, unknown> {
  const {
    includeCustomer = "true",
    includeVehicle = "true",
    includeDeliveryAddress = "true",
    includeOrderItems = "true",
  } = query;

  const include: Record<string, unknown> = {};

  if (includeCustomer === "true") {
    include.Customer = {
      include: {
        CustomerDetail: { select: { dbName: true, dbCategory: true } },
      },
    };
  }

  if (includeVehicle === "true") {
    include.Vehicle = { include: { VehicleType: true } };
  }

  if (includeDeliveryAddress === "true") {
    include.DeliveryAddress = true;
  }

  if (includeOrderItems === "true") {
    include.OrderItem = {
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            imageUrl: true,
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
            Category: {
              select: {
                id: true,
                name: true,
                position: true,
              },
            },
            ForecastItem: true,
          },
        },
      },
    };
  }

  include.OrderStatusType = true;
  include.StockRecord = { select: { id: true, reason: true } };

  return include;
}

// Get a single order by ID (with optional include filters)
export const getOrderById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user as { userType?: string } | undefined;
    if (user?.userType === "WAREHOUSE_MANAGER") {
      return res.status(403).json({
        message: "Use warehouse manager order endpoints for order details",
      });
    }

    const { orderId } = req.params;
    const { orderStatusTypeId } = req.query;

    const include = buildOrderDetailInclude(req.query) as object;

    const where: Record<string, unknown> = {
      id: orderId,
    };

    if (orderStatusTypeId) {
      where.orderStatusTypeId = orderStatusTypeId;
    }

    const order = await prisma.order.findFirst({
      where,
      include,
    });

    res.json({ order });
  } catch (error) {
    console.error("Error fetching order by ID:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Single order for warehouse manager; only statuses allowed on the warehouse orders board. */
export const getWarehouseManagerOrderById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { orderId } = req.params;
    const include = buildOrderDetailInclude(req.query) as object;

    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const allowedIds = await getWarehouseOrdersBoardAllowedStatusTypeIds();
    if (
      !order.orderStatusTypeId ||
      !allowedIds.includes(order.orderStatusTypeId)
    ) {
      return res.status(403).json({
        message: "This order is not available in the warehouse portal",
      });
    }

    res.json({ order });
  } catch (error) {
    console.error("Error fetching order for warehouse manager:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get orders by original order ID (for tracking order modifications)
export const getOrdersByOriginalOrderId = async (
  req: Request,
  res: Response
) => {
  try {
    const { originalOrderId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { originalOrderId },
        skip,
        take: Number(limit),
        include: {
          Customer: true,
          Vehicle: { include: { VehicleType: true } },
          DeliveryAddress: true,
          OrderStatusType: true,
          StockRecord: true,
          OrderItem: {
            include: {
              Product: true,
              Customer: true,
            },
          },
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where: { originalOrderId } }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders by original order ID:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update the associated vehicle of an order.
 * PATCH body: { vehicleId: string | null } — null to remove vehicle assignment.
 */
export const updateOrderVehicle = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { vehicleId } = req.body as { vehicleId: string | null };

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (vehicleId !== null && vehicleId !== undefined) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { vehicleId: vehicleId ?? null },
      include: {
        Customer: {
          select: {
            id: true,
          },
        },
        OrderStatusType: true,
        Vehicle: { select: { vehicleNumber: true } },
      },
    });

    res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order vehicle:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update the associated driver of an order.
 * PATCH body: { driverId: string | null } — null to remove driver assignment.
 * Only allows assigning users with userType DRIVER.
 */
export const updateOrderDriver = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { driverId } = req.body as { driverId: string | null };

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (driverId !== null && driverId !== undefined) {
      const driver = await prisma.user.findUnique({
        where: { id: driverId },
        select: { id: true, userType: true, name: true },
      });
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userType !== "DRIVER") {
        return res.status(400).json({ message: "Selected user is not a driver" });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { driverId: driverId ?? null },
      include: {
        Customer: {
          select: {
            id: true,
          },
        },
        OrderStatusType: true,
        Vehicle: { select: { vehicleNumber: true } },
      },
    });

    res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order driver:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update the delivery date of an order.
 * PATCH body: { deliveryDate: string | null } — ISO date string, or null to clear.
 */
export const updateOrderDeliveryDate = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { deliveryDate } = req.body as { deliveryDate: string | null };

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryDate:
          deliveryDate === null || deliveryDate === undefined
            ? null
            : new Date(deliveryDate),
      },
      include: {
        Customer: {
          select: {
            id: true,
          },
        },
        OrderStatusType: true,
        Vehicle: { select: { vehicleNumber: true } },
      },
    });

    //update the delivery date in order items table
    await prisma.orderItem.updateMany({
      where: { orderId },
      data: {
        deliveryDate: deliveryDate === null || deliveryDate === undefined ? null : new Date(deliveryDate),
      },
    });

    res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order delivery date:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


/**
 * Apply discount (percentage 0–100) to a single order. Admin only.
 * PATCH body: { discountPercent: number }.
 * Discount applies to this order only; final amount is computed on the frontend from Total w.GST.
 */
export const applyOrderDiscount = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { discountPercent } = req.body as { discountPercent: number };

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        // If admin sets 0%, treat it as \"no discount\" and clear the field.
        discountPercent: discountPercent === 0 ? null : discountPercent,
      },
    });

    res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error applying order discount:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update order status (orderStatusTypeId) only.
 * PATCH body: { orderStatusTypeId: string }.
 */
export const updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { orderStatusTypeId } = req.body as { orderStatusTypeId: string };
    const user = req.user as { userType?: string } | undefined;

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const statusType = await prisma.orderStatusType.findUnique({
      where: { id: orderStatusTypeId },
    });
    if (!statusType) {
      return res.status(404).json({ message: "Order status type not found" });
    }

    if (
      user?.userType === "WAREHOUSE_MANAGER" &&
      !WAREHOUSE_ORDERS_PAGE_STATUS_NAMES.includes(
        statusType.name as (typeof WAREHOUSE_ORDERS_PAGE_STATUS_NAMES)[number]
      )
    ) {
      return res.status(403).json({
        message: "Warehouse manager can only set Finalized, Pulling, Loading, or Loaded status",
      });
    }

    const orderInclude = {
      Customer: {
        select: {
          id: true,
          name: true,
          email: true,
          CustomerDetail: { select: { dbName: true, dbCategory: true } },
        },
      },
      OrderStatusType: true,
      Vehicle: { select: { vehicleNumber: true } },
      OrderItem: {
        select: {
          quantity: true,
          productId: true,
          orderCompleted: true,
          Product: {
            select: {
              mrp: true,
              name: true,
              sellingPricePerCartonForRssWithGst: true,
              sellingPricePerCartonForRss: true,
              costPricePerCartonWithGst: true,
              costPricePerCarton: true,
              sellingPricePerCartonForDbWithGst: true,
              sellingPricePerCartonForDb: true,
            },
          },
        },
      },
    } as const;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatusTypeId,
          completionDate: statusType.name === "COMPLETE" ? new Date() : null,
        },
        include: orderInclude,
      });

      switch (statusType.name) {
        case "COMPLETE":
          await tx.orderItem.updateMany({
            where: { orderId },
            data: {
              orderCompleted: true,
            },
          });
          break;
        case "PENDING":
        case "MODIFYING":
        case "FINALIZED":
        case "PULLING":
        case "LOADING":
        case "LOADED":
        case "OUT_FOR_DELIVERY":
        case "REACHED_DESTINATION":
        case "UNLOADING":
        case "UNLOADED":
        case "VEHICLE_COMING_BACK":
        case "VEHICLE_CAME_BACK":        
        default:
          break;
      }

      return order;
    });

    res.status(200).json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update an order (metadata and/or line items with correct stock handling).
 * For MODIFICATION only - order must already be verified. Initial stock deduction is done via verify endpoint.
 *
 * Delta-based update: the request body only contains items that changed.
 * - quantity > 0  : upsert (update or add) — restore old stock for that product if it existed, then deduct new quantity.
 * - quantity === 0 : remove — restore old stock for that product and delete the order item.
 * - Items NOT in the request body are left completely untouched (no stock/item changes).
 */
export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const {
      orderStatusTypeId,
      customerId,
      vehicleId,
      driverId,
      orderUpdaterId,
      deliveryAddressId,
      orderItems,
      orderDate,
      tallyInvoiceId,
    } = req.body as {
      orderStatusTypeId?: string | null;
      customerId?: string;
      vehicleId?: string;
      driverId?: string | null;
      orderUpdaterId?: string;
      deliveryAddressId?: string;
      orderItems?: OrderItemInput[];
      orderDate?: string;
      tallyInvoiceId?: string | null;
    };

    const hasItemChanges = orderItems && orderItems.length > 0;

    if (hasItemChanges) {
      const productIds = orderItems!.map((i) => i.productId);
      const uniqueProductIds = [...new Set(productIds)];
      if (uniqueProductIds.length !== productIds.length) {
        return res.status(400).json({ message: "Duplicate product IDs in order items" });
      }
      for (const item of orderItems!) {
        if (!Number.isInteger(item.quantity) || item.quantity < 0) {
          return res.status(400).json({ message: `Invalid quantity for product ${item.productId}` });
        }
      }
    }

    // --- Phase 1: All reads OUTSIDE the transaction ---
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        orderDate: true,
        orderStatusTypeId: true,
        isVerifiedByAdmin: true,
        verifiedAt: true,
        OrderItem: {
          select: {
            productId: true,
            quantity: true,
            schemeDiscountPercent: true,
            itemDiscountPercent: true,
            isFestivePrice: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (hasItemChanges && !existingOrder.isVerifiedByAdmin) {
      return res.status(400).json({
        message: "Order must be verified first. Use the verify endpoint to verify and deduct stock.",
      });
    }

    if (
      hasItemChanges &&
      hasOrderItemQuantityChanges(orderItems!, existingOrder.OrderItem) &&
      isVerifiedOrderItemEditLocked({
        isVerifiedByAdmin: existingOrder.isVerifiedByAdmin,
        verifiedAt: existingOrder.verifiedAt,
      })
    ) {
      return res.status(400).json({ message: ORDER_ITEM_EDIT_LOCKED_MESSAGE });
    }

    const effectiveStatusId = (orderStatusTypeId !== undefined && orderStatusTypeId !== null)
      ? orderStatusTypeId
      : existingOrder.orderStatusTypeId;
    const isCompleted = effectiveStatusId === COMPLETED_ORDER_STATUS_TYPE_ID;
    const createdBy = (req as AuthenticatedRequest).user
      ? ((req as AuthenticatedRequest).user as { id?: string })?.id ?? orderUpdaterId!
      : orderUpdaterId!;

    const effectiveOrderDate = orderDate ? new Date(orderDate) : existingOrder.orderDate;
    const customerIdToUse = customerId ?? existingOrder.customerId;

    // If a delivery address is provided, ensure it belongs to the (possibly updated) customer.
    if (deliveryAddressId) {
      const deliveryAddress = await prisma.deliveryAddress.findFirst({
        where: { id: deliveryAddressId, userId: customerIdToUse },
        select: { id: true },
      });

      if (!deliveryAddress) {
        return res.status(400).json({
          message: "Delivery address not found for the selected customer",
        });
      }
    }

    if (driverId) {
      const driver = await prisma.user.findUnique({
        where: { id: driverId },
        select: { id: true, userType: true },
      });
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userType !== "DRIVER") {
        return res.status(400).json({ message: "Selected user is not a driver" });
      }
    }

    // For metadata-only updates (no item changes), skip the heavy lifting
    if (!hasItemChanges) {
      try {
        const include = buildOrderDetailInclude({} as unknown as Request["query"]);
        const updatedOrder = await prisma.$transaction(async (tx) => {
          const updateData: Record<string, unknown> = {};
          if (orderStatusTypeId !== undefined) updateData.orderStatusTypeId = orderStatusTypeId;
          if (customerId !== undefined) updateData.customerId = customerId;
          if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
          if (driverId !== undefined) updateData.driverId = driverId;
          if (orderDate !== undefined) updateData.orderDate = effectiveOrderDate;
          if (deliveryAddressId !== undefined) updateData.deliveryAddressId = deliveryAddressId;
          if (tallyInvoiceId !== undefined) {
            const resolved = await resolveManualTallyInvoiceIdUpdate(
              tx,
              tallyInvoiceId,
              orderId
            );
            if (resolved !== undefined) {
              updateData.tallyInvoiceId = resolved;
            }
          }

          if (Object.keys(updateData).length > 0) {
            return tx.order.update({
              where: { id: orderId },
              data: updateData,
              include,
            });
          }

          return tx.order.findUniqueOrThrow({
            where: { id: orderId },
            include,
          });
        });
        return res.json({ order: updatedOrder });
      } catch (metaError) {
        if (metaError instanceof Error && (
          metaError.message.includes("Tally invoice ID") ||
          metaError.message.includes("Invalid Tally invoice")
        )) {
          return res.status(400).json({ message: metaError.message });
        }
        throw metaError;
      }
    }

    // --- Delta logic: split items into removals (qty=0) and upserts (qty>0) ---
    const itemsToRemove = orderItems!.filter((i) => i.quantity === 0);
    const itemsToUpsert = orderItems!.filter((i) => i.quantity > 0);
    const changedProductIds = orderItems!.map((i) => i.productId);
    const upsertProductIds = [...new Set(itemsToUpsert.map((i) => i.productId))];

    // Build a map of existing order items for the changed products
    const existingItemMap = new Map(
      existingOrder.OrderItem
        .filter((oi) => changedProductIds.includes(oi.productId))
        .map((oi) => [oi.productId, oi.quantity])
    );
    const existingItemFullMap = new Map(
      existingOrder.OrderItem
        .filter((oi) => changedProductIds.includes(oi.productId))
        .map((oi) => [oi.productId, oi])
    );

    // Discount-only edits must not restore/re-deduct stock (qty unchanged).
    const itemsQtyChanged = itemsToUpsert.filter((item) => {
      const prevQty = existingItemMap.get(item.productId);
      return prevQty === undefined || prevQty !== item.quantity;
    });
    const stockAffectingProductIds = [
      ...new Set([
        ...itemsToRemove.map((i) => i.productId),
        ...itemsQtyChanged.map((i) => i.productId),
      ]),
    ];
    const qtyChangedProductIds = [...new Set(itemsQtyChanged.map((i) => i.productId))];

    // After the update we need at least one order item remaining
    const unchangedItemCount = existingOrder.OrderItem.filter(
      (oi) => !changedProductIds.includes(oi.productId)
    ).length;
    if (unchangedItemCount + itemsToUpsert.length === 0) {
      return res.status(400).json({ message: "Cannot remove all items from an order" });
    }

    // --- Pre-fetch stock data only for qty-changing line items (parallel, outside tx) ---
    const [existingStockRecords, existingBatchesForRestore, freshBatchesForDeduction] = await Promise.all([
      stockAffectingProductIds.length > 0
        ? prisma.stockRecord.findMany({
        where: {
          orderId,
          productId: { in: stockAffectingProductIds },
          reason: { in: ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"] },
        },
        select: {
          id: true,
          productId: true,
          changeInStock: true,
          stockBatchId: true,
          reason: true,
        },
      })
        : Promise.resolve([]),
      stockAffectingProductIds.length > 0
        ? prisma.stockBatch.findMany({
        where: {
          StockRecord: {
            some: {
              orderId,
              reason: { in: ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"] },
              productId: { in: stockAffectingProductIds },
            },
          },
        },
      })
        : Promise.resolve([]),
      qtyChangedProductIds.length > 0
        ? prisma.stockBatch.findMany({
          where: {
            productId: { in: qtyChangedProductIds },
            isArchived: false,
          },
          orderBy: { arrivalDate: "asc" },
        })
        : Promise.resolve([]),
    ]);

    // --- Phase 2: Pre-compute restore plan from NET outstanding reservation per batch ---
    // (ASSIGNED_TO_ORDER decreases + RELEASED_FROM_ORDER increases; avoid double-restore after prior modifies)
    const restoreBatchMap = new Map(existingBatchesForRestore.map((b) => [b.id, { ...b }]));

    const netReservedByBatch = new Map<
      string,
      { batchId: string; productId: string; net: number }
    >();
    for (const record of existingStockRecords) {
      const cur = netReservedByBatch.get(record.stockBatchId) ?? {
        batchId: record.stockBatchId,
        productId: record.productId,
        net: 0,
      };
      cur.net += record.changeInStock;
      netReservedByBatch.set(record.stockBatchId, cur);
    }

    const restorePlan: {
      batchId: string;
      newQty: number;
      unarchive: boolean;
      productId: string;
      addBack: number;
    }[] = [];
    for (const { batchId, productId, net } of netReservedByBatch.values()) {
      // net < 0 means qty still reserved on this batch for this order
      if (net >= 0) continue;
      const batch = restoreBatchMap.get(batchId);
      if (!batch) continue;

      const addBack = -net;
      const newQty = batch.stockQuantity + addBack;

      restorePlan.push({
        batchId: batch.id,
        newQty,
        unarchive: batch.isArchived,
        productId,
        addBack,
      });

      batch.stockQuantity = newQty;
      batch.isArchived = false;
    }

    // --- Phase 3: Pre-compute deduction plan (only for upsert items) ---
    const batchSnapshotMap = new Map<string, { id: string; productId: string; stockQuantity: number; isArchived: boolean }>();
    for (const b of freshBatchesForDeduction) {
      batchSnapshotMap.set(b.id, { id: b.id, productId: b.productId, stockQuantity: b.stockQuantity, isArchived: b.isArchived });
    }
    for (const plan of restorePlan) {
      const existing = batchSnapshotMap.get(plan.batchId);
      if (existing) {
        existing.stockQuantity = plan.newQty;
        existing.isArchived = false;
      } else {
        const restored = restoreBatchMap.get(plan.batchId);
        if (restored) {
          batchSnapshotMap.set(plan.batchId, {
            id: restored.id,
            productId: restored.productId,
            stockQuantity: plan.newQty,
            isArchived: false,
          });
        }
      }
    }

    const batchesByProduct = new Map<string, { id: string; stockQuantity: number }[]>();
    for (const b of freshBatchesForDeduction) {
      const snapshot = batchSnapshotMap.get(b.id)!;
      if (snapshot.stockQuantity <= 0 || snapshot.isArchived) continue;
      const arr = batchesByProduct.get(snapshot.productId) ?? [];
      arr.push({ id: snapshot.id, stockQuantity: snapshot.stockQuantity });
      batchesByProduct.set(snapshot.productId, arr);
    }
    for (const plan of restorePlan) {
      if (!batchesByProduct.has(plan.productId)) {
        batchesByProduct.set(plan.productId, []);
      }
      const arr = batchesByProduct.get(plan.productId)!;
      if (!arr.some((b) => b.id === plan.batchId)) {
        const snapshot = batchSnapshotMap.get(plan.batchId);
        if (snapshot && snapshot.stockQuantity > 0) {
          arr.push({ id: snapshot.id, stockQuantity: snapshot.stockQuantity });
        }
      }
    }

    const deductionPlan: { batchId: string; newQty: number; archive: boolean; productId: string; deduction: number }[] = [];

    for (const item of itemsQtyChanged) {
      const batches = batchesByProduct.get(item.productId) ?? [];
      const stockAvailable = batches.reduce((sum, b) => sum + b.stockQuantity, 0);
      if (stockAvailable < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product ${item.productId}. Available: ${stockAvailable}, Required: ${item.quantity}`,
        });
      }

      let remaining = item.quantity;
      for (const batch of batches) {
        if (remaining <= 0) break;
        if (batch.stockQuantity <= 0) continue;

        const deduction = Math.min(batch.stockQuantity, remaining);
        const newQty = batch.stockQuantity - deduction;

        deductionPlan.push({
          batchId: batch.id,
          newQty,
          archive: newQty === 0,
          productId: item.productId,
          deduction,
        });

        batch.stockQuantity = newQty;
        remaining -= deduction;
      }
    }

    // --- Phase 4: Transaction — writes only ---
    // customerIdToUse is derived above (possibly from incoming customerId)

    const updateOrderPriceSelect = {
      id: true,
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
    } as const;

    let updateOrderPriceSnapshotByProductId = new Map<
      string,
      ReturnType<typeof buildOrderItemPriceSnapshot>
    >();
    if (itemsToUpsert.length > 0 && upsertProductIds.length > 0) {
      const [updateOrderCustomer, updateOrderProducts] = await Promise.all([
        prisma.user.findUnique({
          where: { id: customerIdToUse },
          select: { CustomerDetail: { select: { dbCategory: true } } },
        }),
        prisma.product.findMany({
          where: { id: { in: upsertProductIds } },
          select: { ...updateOrderPriceSelect },
        }),
      ]);
      if (updateOrderProducts.length !== upsertProductIds.length) {
        return res.status(404).json({ message: "One or more products not found for order update" });
      }
      const updDbCategory = resolveDbCategory(
        updateOrderCustomer as { CustomerDetail?: Array<{ dbCategory?: string | null }> } | null
      );
      const updFestiveByProductId = new Map<string, boolean>();
      for (const item of itemsToUpsert) {
        if (item.isFestivePrice) {
          updFestiveByProductId.set(item.productId, true);
        }
      }
      updateOrderPriceSnapshotByProductId = new Map(
        updateOrderProducts.map((p) => [
          p.id,
          buildOrderItemPriceSnapshot(p, updDbCategory, updFestiveByProductId.get(p.id)),
        ])
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const writeOps: Promise<unknown>[] = [];

        // Update order metadata
        const updateData: Record<string, unknown> = {};
        if (orderStatusTypeId !== undefined) updateData.orderStatusTypeId = orderStatusTypeId;
        if (customerId !== undefined) updateData.customerId = customerId;
        if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
        if (driverId !== undefined) updateData.driverId = driverId;
        if (orderDate !== undefined) updateData.orderDate = effectiveOrderDate;
        if (deliveryAddressId !== undefined) updateData.deliveryAddressId = deliveryAddressId;
        if (tallyInvoiceId !== undefined) {
          const resolved = await resolveManualTallyInvoiceIdUpdate(
            tx,
            tallyInvoiceId,
            orderId
          );
          if (resolved !== undefined) {
            updateData.tallyInvoiceId = resolved;
          }
        }
        if (Object.keys(updateData).length > 0) {
          writeOps.push(tx.order.update({ where: { id: orderId }, data: updateData }));
        }

        // Append-only restore: write RELEASED_FROM_ORDER INCREASE per prior assignment (keep old DECREASEs).
        // Outward/inward daily report uses actual deduction time, not order date.
        for (const plan of restorePlan) {
          if (plan.addBack <= 0) continue;
          await applyStockLedgerDelta({
            db: tx,
            stockBatchId: plan.batchId,
            productId: plan.productId,
            delta: plan.addBack,
            reason: "RELEASED_FROM_ORDER",
            changeDate: defaultChangeDateIst(),
            createdBy,
            orderId,
          });
        }

        // Deduct new quantities with ASSIGNED_TO_ORDER DECREASE rows
        for (const plan of deductionPlan) {
          if (plan.deduction <= 0) continue;
          await applyStockLedgerDelta({
            db: tx,
            stockBatchId: plan.batchId,
            productId: plan.productId,
            delta: -plan.deduction,
            reason: "ASSIGNED_TO_ORDER",
            changeDate: defaultChangeDateIst(),
            createdBy,
            orderId,
          });
        }

        // Replace order items for changed products only (do not delete StockRecords)
        writeOps.push(
          tx.orderItem.deleteMany({
            where: { orderId, productId: { in: changedProductIds } },
          })
        );

        await Promise.all(writeOps);

        // Insert new order items for upsert products (qty > 0 only)
        const insertOps: Promise<unknown>[] = [];

        if (itemsToUpsert.length > 0) {
          insertOps.push(
            tx.orderItem.createMany({
              data: itemsToUpsert.map((item) => {
                const snap = updateOrderPriceSnapshotByProductId.get(item.productId);
                const existing = existingItemFullMap.get(item.productId);
                return {
                  orderId,
                  productId: item.productId,
                  quantity: item.quantity,
                  customerId: customerIdToUse,
                  orderCompleted: isCompleted,
                  orderDate: effectiveOrderDate,
                  schemeDiscountPercent: existing?.schemeDiscountPercent ?? null,
                  itemDiscountPercent: itemDiscountPercentForWrite(
                    item.itemDiscountPercent,
                    existing?.itemDiscountPercent
                  ),
                  isFestivePrice: item.isFestivePrice === true
                    ? true
                    : (existing?.isFestivePrice ?? false),
                  ...(snap ? { ...snap } : {}),
                };
              }),
            })
          );
        }

        // Also update orderDate on unchanged order items if orderDate changed
        if (orderDate !== undefined) {
          const unchangedProductIds = existingOrder.OrderItem
            .filter((oi) => !changedProductIds.includes(oi.productId))
            .map((oi) => oi.productId);
          if (unchangedProductIds.length > 0) {
            insertOps.push(
              tx.orderItem.updateMany({
                where: { orderId, productId: { in: unchangedProductIds } },
                data: { orderDate: effectiveOrderDate },
              })
            );
          }
        }

        if (insertOps.length > 0) {
          await Promise.all(insertOps);
        }

        // Keep OpeningStock snapshots in sync for days after the order date (max last OPENING_STOCK_RECALC_DAYS IST days)
        const stockLineItems = [...itemsToRemove, ...itemsQtyChanged];
        const productDeltas = buildOrderItemQtyDeltas(
          stockLineItems,
          existingOrder.OrderItem.filter((oi) =>
            stockAffectingProductIds.includes(oi.productId)
          )
        );
        if (productDeltas.length > 0) {
          await propagateOpeningStockAfterOrderQtyChange({
            db: tx,
            productDeltas,
            orderDate: effectiveOrderDate,
          });
        }
      },
      { timeout: 90_000 }
    );

    const include = buildOrderDetailInclude({} as unknown as Request["query"]);
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include,
    });

    return res.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order:", error);
    if (error instanceof Error && (
      error.message.includes("Tally invoice ID") ||
      error.message.includes("Invalid Tally invoice")
    )) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Distributor-only: replace line items on an unverified draft order (no stock / FIFO).
 * Separate from `updateOrder` so admin flows stay on PUT /:orderId without requiring distributor JWT there.
 */
export const updateDistributorDraftOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const user = req.user as { id?: string; userType?: string } | undefined;
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (user.userType !== "CUSTOMER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      orderItems,
      vehicleId,
      deliveryAddressId,
      orderDate,
      orderStatusTypeId,
    } = req.body as {
      orderItems: OrderItemInput[];
      vehicleId?: string | null;
      deliveryAddressId?: string | null;
      orderDate?: string;
      orderStatusTypeId?: string | null;
    };

    const productIds = orderItems.map((i) => i.productId);
    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length !== productIds.length) {
      return res.status(400).json({ message: "Duplicate product IDs in order items" });
    }
    for (const item of orderItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          message: "Each order item must have a positive quantity.",
        });
      }
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        orderDate: true,
        orderStatusTypeId: true,
        isVerifiedByAdmin: true,
        isFinalizedByDistributor: true,
        orderCreatorId: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (existingOrder.customerId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (existingOrder.orderCreatorId != null && existingOrder.orderCreatorId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (existingOrder.isVerifiedByAdmin) {
      return res.status(400).json({ message: "Verified orders cannot be edited here." });
    }
    if (existingOrder.isFinalizedByDistributor !== false) {
      return res.status(400).json({
        message: "Only draft orders awaiting submission can be edited.",
      });
    }

    const effectiveStatusId =
      orderStatusTypeId !== undefined && orderStatusTypeId !== null
        ? orderStatusTypeId
        : existingOrder.orderStatusTypeId;
    const isCompleted = effectiveStatusId === COMPLETED_ORDER_STATUS_TYPE_ID;
    const effectiveOrderDate = orderDate ? new Date(orderDate) : existingOrder.orderDate;
    const customerIdToUse = existingOrder.customerId;

    if (deliveryAddressId) {
      const deliveryAddress = await prisma.deliveryAddress.findFirst({
        where: { id: deliveryAddressId, userId: customerIdToUse },
        select: { id: true },
      });
      if (!deliveryAddress) {
        return res.status(400).json({
          message: "Delivery address not found for the selected customer",
        });
      }
    }

    if (vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
      if (!v) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
    }

    const draftProducts = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: {
        id: true,
        name: true,
        productCode: true,
        isDiscontinued: true,
      },
    });
    if (draftProducts.length !== uniqueProductIds.length) {
      const found = new Set(draftProducts.map((p) => p.id));
      const missing = uniqueProductIds.filter((id) => !found.has(id));
      return res.status(404).json({ message: `Products not found: ${missing.join(", ")}` });
    }
    const discontinuedDraft = draftProducts.filter((p) => p.isDiscontinued === true);
    if (discontinuedDraft.length > 0) {
      const labels = discontinuedDraft.map((p) => `${p.name} (${p.productCode})`).join(", ");
      return res.status(400).json({
        message: `Discontinued products cannot be ordered: ${labels}`,
      });
    }

    await prisma.$transaction(
      async (tx) => {
        const updateData: Record<string, unknown> = {};
        if (orderStatusTypeId !== undefined) updateData.orderStatusTypeId = orderStatusTypeId;
        if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
        if (orderDate !== undefined) updateData.orderDate = effectiveOrderDate;
        if (deliveryAddressId !== undefined) updateData.deliveryAddressId = deliveryAddressId;
        if (Object.keys(updateData).length > 0) {
          await tx.order.update({ where: { id: orderId }, data: updateData });
        }
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            customerId: customerIdToUse,
            orderCompleted: isCompleted,
            orderDate: effectiveOrderDate,
            itemDiscountPercent: itemDiscountPercentForWrite(
              item.itemDiscountPercent
            ),
            isFestivePrice: item.isFestivePrice === true ? true : false,
          })),
        });
      },
      { timeout: 90_000 }
    );

    const includeDraft = buildOrderDetailInclude({} as unknown as Request["query"]);
    const updatedDraftOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: includeDraft,
    });
    return res.json({ order: updatedDraftOrder });
  } catch (error) {
    console.error("Error updating distributor draft order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Admin-only: replace line items on an order not yet verified by admin (no stock / FIFO).
 * Verified orders must use PUT /:orderId (`updateOrder`).
 */
export const updateAdminUnverifiedOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const currentUser = req.user as { id?: string; userType?: string } | undefined;
    const isAdmin =
      currentUser?.userType === "ADMIN" ||
      currentUser?.userType === "SUPER_ADMIN" ||
      currentUser?.userType === "MIS";
    if (!isAdmin || !currentUser?.id) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const {
      orderItems,
      vehicleId,
      driverId,
      deliveryAddressId,
      orderDate,
      orderStatusTypeId,
      customerId,
      tallyInvoiceId,
    } = req.body as {
      orderItems: OrderItemInput[];
      vehicleId?: string | null;
      driverId?: string | null;
      deliveryAddressId?: string | null;
      orderDate?: string;
      orderStatusTypeId?: string | null;
      customerId?: string;
      tallyInvoiceId?: string | null;
    };

    const productIds = orderItems.map((i) => i.productId);
    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length !== productIds.length) {
      return res.status(400).json({ message: "Duplicate product IDs in order items" });
    }
    for (const item of orderItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          message: "Each order item must have a positive quantity.",
        });
      }
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        orderDate: true,
        orderStatusTypeId: true,
        isVerifiedByAdmin: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (existingOrder.orderStatusTypeId === COMPLETED_ORDER_STATUS_TYPE_ID) {
      return res.status(400).json({
        message: "Cannot update line items for completed orders",
      });
    }

    if (existingOrder.isVerifiedByAdmin === true) {
      return res.status(400).json({
        message:
          "Order is already verified. Use PUT /orders/:orderId to modify line items with stock adjustments.",
      });
    }

    const effectiveStatusId =
      orderStatusTypeId !== undefined && orderStatusTypeId !== null
        ? orderStatusTypeId
        : existingOrder.orderStatusTypeId;
    const isCompleted = effectiveStatusId === COMPLETED_ORDER_STATUS_TYPE_ID;
    const effectiveOrderDate = orderDate ? new Date(orderDate) : existingOrder.orderDate;
    const customerIdToUse = customerId ?? existingOrder.customerId;

    if (customerId !== undefined) {
      const customer = await prisma.user.findUnique({
        where: { id: customerIdToUse },
        select: { id: true },
      });
      if (!customer) {
        return res.status(400).json({ message: "Customer not found" });
      }
    }

    if (deliveryAddressId) {
      const deliveryAddress = await prisma.deliveryAddress.findFirst({
        where: { id: deliveryAddressId, userId: customerIdToUse },
        select: { id: true },
      });
      if (!deliveryAddress) {
        return res.status(400).json({
          message: "Delivery address not found for the selected customer",
        });
      }
    }

    if (vehicleId) {
      const v = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
      if (!v) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
    }

    if (driverId) {
      const driver = await prisma.user.findUnique({
        where: { id: driverId },
        select: { id: true, userType: true },
      });
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      if (driver.userType !== "DRIVER") {
        return res.status(400).json({ message: "Selected user is not a driver" });
      }
    }

    const adminUnverifiedProducts = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds } },
      select: {
        id: true,
        name: true,
        productCode: true,
        isDiscontinued: true,
      },
    });
    if (adminUnverifiedProducts.length !== uniqueProductIds.length) {
      const found = new Set(adminUnverifiedProducts.map((p) => p.id));
      const missing = uniqueProductIds.filter((id) => !found.has(id));
      return res.status(404).json({ message: `Products not found: ${missing.join(", ")}` });
    }
    const discontinuedAdmin = adminUnverifiedProducts.filter((p) => p.isDiscontinued === true);
    if (discontinuedAdmin.length > 0) {
      const labels = discontinuedAdmin.map((p) => `${p.name} (${p.productCode})`).join(", ");
      return res.status(400).json({
        message: `Discontinued products cannot be ordered: ${labels}`,
      });
    }

    await prisma.$transaction(
      async (tx) => {
        const updateData: Record<string, unknown> = {};
        if (orderStatusTypeId !== undefined) updateData.orderStatusTypeId = orderStatusTypeId;
        if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
        if (driverId !== undefined) updateData.driverId = driverId;
        if (orderDate !== undefined) updateData.orderDate = effectiveOrderDate;
        if (deliveryAddressId !== undefined) updateData.deliveryAddressId = deliveryAddressId;
        if (customerId !== undefined) updateData.customerId = customerIdToUse;
        if (tallyInvoiceId !== undefined) {
          const resolved = await resolveManualTallyInvoiceIdUpdate(
            tx,
            tallyInvoiceId,
            orderId
          );
          if (resolved !== undefined) {
            updateData.tallyInvoiceId = resolved;
          }
        }
        if (Object.keys(updateData).length > 0) {
          await tx.order.update({ where: { id: orderId }, data: updateData });
        }
        await tx.orderItem.deleteMany({ where: { orderId } });
        await tx.orderItem.createMany({
          data: orderItems.map((item) => ({
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            customerId: customerIdToUse,
            orderCompleted: isCompleted,
            orderDate: effectiveOrderDate,
            itemDiscountPercent: itemDiscountPercentForWrite(
              item.itemDiscountPercent
            ),
            isFestivePrice: item.isFestivePrice === true ? true : false,
          })),
        });
      },
      { timeout: 90_000 }
    );

    const includeAdminUnverified = buildOrderDetailInclude({} as unknown as Request["query"]);
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: includeAdminUnverified,
    });
    return res.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating admin unverified order:", error);
    if (error instanceof Error && (
      error.message.includes("Tally invoice ID") ||
      error.message.includes("Invalid Tally invoice")
    )) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** Distributor-only: mark draft order as finalized ("Send to SS") so admin can see it. */
export const finalizeDistributorOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const user = req.user as { id?: string; userType?: string } | undefined;
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (user.userType !== "CUSTOMER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        orderCreatorId: true,
        isFinalizedByDistributor: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customerId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.orderCreatorId != null && order.orderCreatorId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.isFinalizedByDistributor !== false) {
      return res.status(400).json({
        message: "Order is already finalized or not awaiting distributor submission.",
      });
    }

    const include = buildOrderDetailInclude({} as unknown as Request["query"]);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { isFinalizedByDistributor: true },
      include,
    });

    return res.json({ order: updated });
  } catch (error) {
    console.error("Error finalizing distributor order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get orders by distributor ID with minimal info (no order details)
export const getOrdersByDistributorId = async (req: Request, res: Response) => {
  try {
    const { distributorId } = req.params;
    const { page = 1, limit = 1000, orderStatusTypeId, startDate, endDate } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      customerId: distributorId,
    };

    if (orderStatusTypeId) {
      where.orderStatusTypeId = orderStatusTypeId;
    }

    // Optional date range filter (inclusive). Expect ISO strings; ignore invalid values.
    const start = typeof startDate === "string" ? new Date(startDate) : null;
    const end = typeof endDate === "string" ? new Date(endDate) : null;
    if ((start && !Number.isNaN(start.getTime())) || (end && !Number.isNaN(end.getTime()))) {
      where.orderDate = {
        ...(start && !Number.isNaN(start.getTime()) ? { gte: start } : {}),
        ...(end && !Number.isNaN(end.getTime()) ? { lte: end } : {}),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: Number(limit),
        select: {
          id: true,
          customeOrderId: true,
          totalPrice: true,
          orderDate: true,
          status: true,
          orderStatusTypeId: true,
          customerId: true,
          vehicleId: true,
          deliveryAddressId: true,
          driverId: true,
          createdAt: true,
          updatedAt: true,
          isFinalizedByDistributor: true,
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          Vehicle: {
            select: {
              id: true,
              vehicleName: true,
              vehicleNumber: true,
              VehicleType: { select: { id: true, name: true } },
            },
          },
          OrderStatusType: true,
        },
        orderBy: {
          orderDate: "desc",
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: total,
        itemsPerPage: Number(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders by distributor ID:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Shared deletion: restore outstanding reserved stock (append-only), then remove order. */
async function deleteOrderWithStockCleanup(
  orderId: string,
  orderStatusTypeId: string | null,
  createdBy: string,
  opts?: {
    orderDate?: Date;
    orderItems?: { productId: string; quantity: number }[];
    isVerifiedByAdmin?: boolean | null;
  }
): Promise<void> {
  const shouldRestoreStock = orderStatusTypeId !== COMPLETED_ORDER_STATUS_TYPE_ID;
  const orderDate = opts?.orderDate ?? new Date();
  const shouldPropagateOpening =
    shouldRestoreStock &&
    opts?.isVerifiedByAdmin === true &&
    (opts.orderItems?.length ?? 0) > 0;

  await prisma.$transaction(
    async (tx) => {
      if (shouldRestoreStock) {
        const ledgerRows = await tx.stockRecord.findMany({
          where: {
            orderId,
            reason: { in: ["ASSIGNED_TO_ORDER", "RELEASED_FROM_ORDER"] },
          },
          select: {
            stockBatchId: true,
            productId: true,
            changeInStock: true,
          },
        });

        const netByBatch = new Map<
          string,
          { stockBatchId: string; productId: string; net: number }
        >();
        for (const row of ledgerRows) {
          if (!row.stockBatchId) continue;
          const cur = netByBatch.get(row.stockBatchId) ?? {
            stockBatchId: row.stockBatchId,
            productId: row.productId,
            net: 0,
          };
          cur.net += row.changeInStock;
          netByBatch.set(row.stockBatchId, cur);
        }

        for (const { stockBatchId, productId, net } of netByBatch.values()) {
          if (net >= 0) continue;
          const addBack = -net;
          await applyStockLedgerDelta({
            db: tx,
            stockBatchId,
            productId,
            delta: addBack,
            reason: "RELEASED_FROM_ORDER",
            changeDate: defaultChangeDateIst(),
            createdBy,
            orderId,
          });
        }
      }

      if (shouldPropagateOpening && opts?.orderItems) {
        const productDeltas = opts.orderItems
          .filter((i) => i.quantity > 0)
          .map((i) => ({ productId: i.productId, deltaQty: -i.quantity }));
        if (productDeltas.length > 0) {
          await propagateOpeningStockAfterOrderQtyChange({
            db: tx,
            productDeltas,
            orderDate,
          });
        }
      }

      // Keep StockRecords for audit / daily report; only remove order lines + order
      await tx.orderItem.deleteMany({
        where: { orderId },
      });

      await tx.order.delete({
        where: { id: orderId },
      });
    },
    {
      timeout: 90000,
    }
  );
}

// Delete an order
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        OrderItem: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const related = await countOrderRelatedDocuments(orderId);
    if (related.creditNoteCount > 0 || related.salesReturnCount > 0) {
      return res.status(409).json(relatedDocumentsPayload(
        related.creditNoteCount,
        related.salesReturnCount
      ));
    }

    await deleteOrderWithStockCleanup(
      orderId,
      order.orderStatusTypeId,
      await getCreatedByForStockRecord(req),
      {
        orderDate: order.orderDate,
        orderItems: order.OrderItem.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        isVerifiedByAdmin: order.isVerifiedByAdmin,
      }
    );

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:\n", error);
    if (isRelatedDocumentsConstraintError(error)) {
      const related = await countOrderRelatedDocuments(req.params.orderId);
      return res.status(409).json(relatedDocumentsPayload(
        related.creditNoteCount,
        related.salesReturnCount
      ));
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Distributor-only: delete own unfinalized draft (no admin middleware). */
export const deleteDistributorDraftOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const user = req.user as { id?: string; userType?: string } | undefined;
    if (!user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (user.userType !== "CUSTOMER") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        orderCreatorId: true,
        isFinalizedByDistributor: true,
        isVerifiedByAdmin: true,
        orderStatusTypeId: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customerId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.orderCreatorId != null && order.orderCreatorId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (order.isFinalizedByDistributor !== false) {
      return res.status(400).json({
        message: "Only draft orders that have not been sent to SS can be deleted.",
      });
    }
    if (order.isVerifiedByAdmin) {
      return res.status(400).json({ message: "Verified orders cannot be deleted here." });
    }

    const related = await countOrderRelatedDocuments(orderId);
    if (related.creditNoteCount > 0 || related.salesReturnCount > 0) {
      return res.status(409).json(relatedDocumentsPayload(
        related.creditNoteCount,
        related.salesReturnCount
      ));
    }

    await deleteOrderWithStockCleanup(
      orderId,
      order.orderStatusTypeId,
      await getCreatedByForStockRecord(req)
    );

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting distributor draft order:\n", error);
    if (isRelatedDocumentsConstraintError(error)) {
      const related = await countOrderRelatedDocuments(req.params.orderId);
      return res.status(409).json(relatedDocumentsPayload(
        related.creditNoteCount,
        related.salesReturnCount
      ));
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/orders/:orderId/schemes
 * Fetches active product schemes for all items in the order.
 * Schemes are resolved against the order date for all statuses.
 */
export const getOrderSchemes = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderDate: true,
        OrderItem: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const schemeReferenceDate = order.orderDate;
    const { startOfDay, endOfDay } = schemeActiveOn(schemeReferenceDate);

    const productIds = order.OrderItem.map((item) => item.productId);

    const activeSchemes = await prisma.productScheme.findMany({
      where: {
        productId: { in: productIds },
        isActive: true,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
      orderBy: { createdAt: "desc" },
    });

    const schemesByProductId: Record<string, typeof activeSchemes[0]> = {};
    for (const scheme of activeSchemes) {
      if (!schemesByProductId[scheme.productId]) {
        schemesByProductId[scheme.productId] = scheme;
      }
    }

    const getEffectivePercentage = (scheme: typeof activeSchemes[0], cbCount: number): number => {
      const slabs = [
        { minCb: scheme.slab1MinCb, maxCb: scheme.slab1MaxCb, percent: scheme.slab1Percent },
        { minCb: scheme.slab2MinCb, maxCb: scheme.slab2MaxCb, percent: scheme.slab2Percent },
        { minCb: scheme.slab3MinCb, maxCb: scheme.slab3MaxCb, percent: scheme.slab3Percent },
        { minCb: scheme.slab4MinCb, maxCb: scheme.slab4MaxCb, percent: scheme.slab4Percent },
      ]
        .filter(
          (s) =>
            s.minCb !== null && s.minCb !== undefined &&
            s.maxCb !== null && s.maxCb !== undefined &&
            s.percent !== null && s.percent !== undefined
        )
        .sort((a, b) => a.minCb! - b.minCb!);

      if (slabs.length === 0) return scheme.schemePercentage ?? 0;

      const match = slabs.find((s) => cbCount >= s.minCb! && cbCount <= s.maxCb!);
      if (match) return match.percent!;

      const first = slabs[0];
      const last = slabs[slabs.length - 1];
      // Do not apply scheme when order quantity is below the first slab minimum.
      if (cbCount < first.minCb!) return 0;
      if (cbCount > last.maxCb!) return last.percent!;
      return 0;
    };

    const result = order.OrderItem.map((item) => {
      const scheme = schemesByProductId[item.productId] ?? null;
      return {
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        scheme: scheme
          ? {
            id: scheme.id,
            schemePercentage: scheme.schemePercentage,
            effectivePercentage: getEffectivePercentage(scheme, item.quantity),
            startDate: scheme.startDate,
            endDate: scheme.endDate,
            slab1MinCb: scheme.slab1MinCb, slab1MaxCb: scheme.slab1MaxCb, slab1Percent: scheme.slab1Percent,
            slab2MinCb: scheme.slab2MinCb, slab2MaxCb: scheme.slab2MaxCb, slab2Percent: scheme.slab2Percent,
            slab3MinCb: scheme.slab3MinCb, slab3MaxCb: scheme.slab3MaxCb, slab3Percent: scheme.slab3Percent,
            slab4MinCb: scheme.slab4MinCb, slab4MaxCb: scheme.slab4MaxCb, slab4Percent: scheme.slab4Percent,
          }
          : null,
      };
    });

    res.json({ schemes: result });
  } catch (error) {
    console.error("Error fetching order schemes:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/items/:itemId/scheme-discount
 * Body: { schemeDiscountPercent: number }
 * Stores the applied scheme discount percentage on the order item.
 */
export const applyItemSchemeDiscount = async (req: Request, res: Response) => {
  try {
    const { orderId, itemId } = req.params;
    const { schemeDiscountPercent } = req.body as { schemeDiscountPercent: number };

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });

    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        schemeDiscountPercent:
          schemeDiscountPercent === 0 ? null : schemeDiscountPercent,
      },
    });

    res.json({ orderItem: updated });
  } catch (error) {
    console.error("Error applying item scheme discount:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/items/:itemId/item-discount
 * Body: { itemDiscountPercent: number }
 * Stores the admin-set per-line item discount percentage on the order item.
 */
export const applyItemDiscount = async (req: Request, res: Response) => {
  try {
    const { orderId, itemId } = req.params;
    const { itemDiscountPercent } = req.body as { itemDiscountPercent: number };

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });

    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        itemDiscountPercent:
          itemDiscountPercent === 0 ? null : itemDiscountPercent,
      },
    });

    res.json({ orderItem: updated });
  } catch (error) {
    console.error("Error applying item discount:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/items/:itemId/festive-price
 * Body: { isFestivePrice: boolean }
 * Re-snapshots the order item selling price from the product's festive (or regular) rates.
 */
export const applyItemFestivePrice = async (req: Request, res: Response) => {
  try {
    const { orderId, itemId } = req.params;
    const { isFestivePrice } = req.body as { isFestivePrice?: boolean };

    if (typeof isFestivePrice !== "boolean") {
      return res.status(400).json({ message: "isFestivePrice must be a boolean" });
    }

    const item = await prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
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
          },
        },
        Customer: {
          select: { CustomerDetail: { select: { dbCategory: true } } },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    if (isFestivePrice && (item.Product.festivePricePerPacket == null || item.Product.festivePricePerPacket <= 0)) {
      return res.status(400).json({
        message: `No festive price is set for ${item.Product.name}`,
      });
    }

    const dbCategory = resolveDbCategory(
      item.Customer as { CustomerDetail?: Array<{ dbCategory?: string | null }> } | null
    );
    const snap = buildOrderItemPriceSnapshot(item.Product, dbCategory, isFestivePrice);

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        isFestivePrice,
        ...snap,
      },
    });

    res.json({ orderItem: updated });
  } catch (error) {
    console.error("Error applying festive price:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/cash-discount
 * Body: { cashDiscountPercent: number } — 0 to clear, or >0 and <=100 to apply
 */
export const applyCashDiscount = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { cashDiscountPercent } = req.body as { cashDiscountPercent: number };

    const isClear = cashDiscountPercent === 0;
    const isValidPercent =
      typeof cashDiscountPercent === "number" &&
      Number.isFinite(cashDiscountPercent) &&
      cashDiscountPercent > 0 &&
      cashDiscountPercent <= 100;
    if (!isClear && !isValidPercent) {
      return res
        .status(400)
        .json({ message: "Cash discount must be 0 (clear) or greater than 0 and at most 100" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        cashDiscountPercent: cashDiscountPercent === 0 ? null : cashDiscountPercent,
      },
    });

    res.json({ order: updated });
  } catch (error) {
    console.error("Error applying cash discount:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/ledger-balance
 * Body: { ledgerBalance: number | null } — finite number (positive adds, negative subtracts from invoice base); null clears.
 */
export const applyLedgerBalance = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const body = req.body as { ledgerBalance: number | null | undefined };

    if (
      body.ledgerBalance !== null &&
      body.ledgerBalance !== undefined &&
      (typeof body.ledgerBalance !== "number" || !Number.isFinite(body.ledgerBalance))
    ) {
      return res.status(400).json({ message: "ledgerBalance must be a finite number or null" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const value =
      body.ledgerBalance === null || body.ledgerBalance === undefined ? null : body.ledgerBalance;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { ledgerBalance: value },
    });

    res.json({ order: updated });
  } catch (error) {
    console.error("Error applying ledger balance:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/narration
 * Admin only. Body: { narration: string | null } — null or empty string clears.
 */
export const updateOrderNarration = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const body = req.body as { narration: string | null };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const raw = body.narration;
    const value =
      raw === null || raw === undefined
        ? null
        : raw.trim() === ""
          ? null
          : raw.trim();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { narration: value },
    });

    res.json({ order: updated });
  } catch (error) {
    console.error("Error updating order narration:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/tally-invoice
 * Admin only. Body: { tallyInvoiceId: string | null } — null or empty string clears.
 * Validates format (SGT/YY-YY/N), uniqueness, and bumps the FY counter when needed.
 */
export const updateOrderTallyInvoice = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { tallyInvoiceId } = req.body as { tallyInvoiceId: string | null };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resolved = await resolveManualTallyInvoiceIdUpdate(
        tx,
        tallyInvoiceId,
        orderId
      );
      return tx.order.update({
        where: { id: orderId },
        data: { tallyInvoiceId: resolved ?? null },
      });
    });

    res.status(200).json({ order: updated });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Tally invoice ID") ||
        error.message.includes("Invalid Tally invoice"))
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error updating order tally invoice:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/excel-meta
 * Admin only. Update Excel sheet metadata / footer fields.
 */
export const updateOrderExcelMeta = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const body = req.body as {
      dmsInvoiceNumber?: string | null;
      tripNumber?: number | null;
      sheetTag?: string | null;
      tallyValue?: number | null;
      dmsValue?: number | null;
      diffReason?: string | null;
      valuesAutoMatched?: boolean | null;
      isManuallyConfirmed?: boolean | null;
      narration?: string | null;
      discountPercent?: number | null;
      cashDiscountPercent?: number | null;
    };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const data: Record<string, unknown> = {};
    if (body.dmsInvoiceNumber !== undefined) {
      data.dmsInvoiceNumber =
        body.dmsInvoiceNumber == null || String(body.dmsInvoiceNumber).trim() === ""
          ? null
          : String(body.dmsInvoiceNumber).trim();
    }
    if (body.tripNumber !== undefined) data.tripNumber = body.tripNumber;
    if (body.sheetTag !== undefined) {
      data.sheetTag =
        body.sheetTag == null || String(body.sheetTag).trim() === ""
          ? null
          : String(body.sheetTag).trim();
    }
    if (body.tallyValue !== undefined) data.tallyValue = body.tallyValue;
    if (body.dmsValue !== undefined) data.dmsValue = body.dmsValue;
    if (body.diffReason !== undefined) {
      data.diffReason =
        body.diffReason == null || String(body.diffReason).trim() === ""
          ? null
          : String(body.diffReason).trim();
    }
    if (body.valuesAutoMatched !== undefined) {
      data.valuesAutoMatched = body.valuesAutoMatched ?? false;
    }
    if (body.isManuallyConfirmed !== undefined) {
      data.isManuallyConfirmed = body.isManuallyConfirmed ?? false;
    }
    if (body.narration !== undefined) {
      data.narration =
        body.narration == null || String(body.narration).trim() === ""
          ? null
          : String(body.narration).trim();
    }
    if (body.discountPercent !== undefined) {
      data.discountPercent =
        body.discountPercent == null || body.discountPercent === 0
          ? null
          : body.discountPercent;
    }
    if (body.cashDiscountPercent !== undefined) {
      data.cashDiscountPercent =
        body.cashDiscountPercent == null || body.cashDiscountPercent === 0
          ? null
          : body.cashDiscountPercent;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data,
    });

    res.json({ order: updated });
  } catch (error) {
    console.error("Error updating order excel meta:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * PATCH /api/orders/:orderId/receiving-status
 * Admin only. Body: { receivingStatus: "PENDING" | "RECEIVED" }
 * Only allowed for completed sales-history orders.
 */
export const updateOrderReceivingStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { receivingStatus } = req.body as { receivingStatus: "PENDING" | "RECEIVED" };

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.orderStatusTypeId !== COMPLETED_ORDER_STATUS_TYPE_ID) {
      return res.status(400).json({
        message: "Receiving status can only be updated for completed sales history orders",
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { receivingStatus },
    });

    res.json({ order: updated });
  } catch (error) {
    console.error("Error updating order receiving status:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
