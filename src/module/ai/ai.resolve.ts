import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  getCatalog,
  type CatalogProduct,
  type CatalogTransporter,
} from "./ai.catalogCache";
import { matchCandidate } from "./ai.matching";
import { isObjectId, normalizeCode, normalizeText, similarity } from "./ai.utils";

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  CustomerDetail: {
    select: { dbName: true, dbCategory: true },
    take: 1,
  },
} satisfies Prisma.UserSelect;

export type ResolvedCustomer = Prisma.UserGetPayload<{
  select: typeof customerSelect;
}>;

function customerLabel(customer: ResolvedCustomer): string {
  return customer.CustomerDetail[0]?.dbName || customer.name;
}

function candidateList(customers: ResolvedCustomer[]): string {
  return customers
    .slice(0, 8)
    .map((customer) => `${customerLabel(customer)} (${customer.id})`)
    .join("; ");
}

export async function resolveCustomer(input: {
  customerId?: string;
  customerQuery?: string;
}): Promise<ResolvedCustomer> {
  if (input.customerId) {
    const customer = await prisma.user.findFirst({
      where: { id: input.customerId, userType: "CUSTOMER" },
      select: customerSelect,
    });
    if (!customer) {
      throw new Error(`Customer id ${input.customerId} was not found.`);
    }
    return customer;
  }

  const query = (input.customerQuery ?? "").trim();
  if (!query) {
    throw new Error("Provide customerId or customerQuery (name/dbName/email/phone).");
  }

  const matches = await prisma.user.findMany({
    where: {
      userType: "CUSTOMER",
      OR: [
        ...(isObjectId(query) ? [{ id: query }] : []),
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { CustomerDetail: { some: { dbName: { contains: query, mode: "insensitive" } } } },
      ],
    },
    take: 10,
    select: customerSelect,
  });

  const pickFrom = (candidates: ResolvedCustomer[]): ResolvedCustomer | null => {
    if (!candidates.length) return null;
    const normalizedQuery = normalizeText(query);
    const scored = candidates
      .map((customer) => {
        const label = customerLabel(customer);
        const exact =
          normalizeText(label) === normalizedQuery ||
          normalizeText(customer.name) === normalizedQuery ||
          normalizeText(customer.email) === normalizedQuery ||
          normalizeText(customer.phone ?? "") === normalizedQuery;
        const score = Math.max(
          similarity(query, label),
          similarity(query, customer.name),
          similarity(query, customer.email),
          customer.phone ? similarity(query, customer.phone) : 0
        );
        return { customer, exact, score };
      })
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        return b.score - a.score;
      });

    const best = scored[0];
    const second = scored[1];
    if (best.exact || (best.score >= 0.86 && best.score - (second?.score ?? 0) >= 0.05)) {
      return best.customer;
    }
    return null;
  };

  const direct = pickFrom(matches);
  if (direct) return direct;

  // Case-insensitive fallback: one bounded read, then match in memory.
  const allCustomers = await prisma.user.findMany({
    where: { userType: "CUSTOMER" },
    take: 5000,
    select: customerSelect,
  });
  const fallback = pickFrom(allCustomers);
  if (fallback) return fallback;

  if (matches.length > 1) {
    throw new Error(
      `Customer "${query}" is ambiguous. Candidates: ${candidateList(matches)}. Ask the user which one to use.`
    );
  }
  if (matches.length === 1) {
    throw new Error(
      `Customer "${query}" did not match closely enough. Did you mean ${candidateList(matches)}?`
    );
  }
  throw new Error(
    `Customer "${query}" was not found. Try a different name or use search_customers.`
  );
}

export interface ProductLineRef {
  productId?: string;
  productCode?: string;
  productName?: string;
  quantity: number;
}

function productMatchError(
  item: ProductLineRef,
  candidates: CatalogProduct[]
): Error {
  const raw = item.productName ?? item.productCode ?? item.productId ?? "unknown product";
  const list = candidates
    .slice(0, 6)
    .map((candidate) => `${candidate.name} (${candidate.productCode})`)
    .join("; ");
  return new Error(
    `Product "${raw}" ${list ? `is ambiguous. Candidates: ${list}` : "was not found"}. ` +
      "Ask the user which product they mean, or pass an exact product code."
  );
}

/** Resolve every line against the cached product catalog. No per-line DB queries. */
export function resolveProducts(
  items: ProductLineRef[],
  catalogProducts: CatalogProduct[]
): CatalogProduct[] {
  return items.map((item) => {
    if (item.productId) {
      const byId = catalogProducts.find((product) => product.id === item.productId);
      if (byId) return byId;
    }

    if (item.productCode) {
      const code = normalizeCode(item.productCode);
      const codeMatches = catalogProducts.filter(
        (product) => normalizeCode(product.productCode) === code
      );
      if (codeMatches.length === 1) return codeMatches[0];
      if (codeMatches.length > 1) throw productMatchError(item, codeMatches);
    }

    if (item.productName) {
      const match = matchCandidate(item.productName, catalogProducts);
      if (match.match) {
        const resolved = catalogProducts.find(
          (product) => product.id === match.match!.id
        );
        if (resolved) return resolved;
      }
      throw productMatchError(item, match.candidates);
    }

    throw productMatchError(item, []);
  });
}

export async function resolveTransporter(input: {
  transporterId?: string;
  transporterQuery?: string;
}): Promise<CatalogTransporter> {
  const catalog = await getCatalog();

  if (input.transporterId) {
    const cached = catalog.transporters.find(
      (transporter) => transporter.id === input.transporterId
    );
    if (cached) return cached;

    const dbMatch = await prisma.transporter.findUnique({
      where: { id: input.transporterId },
      select: { id: true, name: true },
    });
    if (dbMatch) return dbMatch;
    throw new Error(`Transporter id ${input.transporterId} was not found.`);
  }

  const query = (input.transporterQuery ?? "").trim();
  if (!query) {
    throw new Error("Provide transporterId or transporterQuery (name).");
  }

  const catalogMatch = matchCandidate(query, catalog.transporters);
  if (catalogMatch.match) return catalogMatch.match;

  const candidates = await prisma.transporter.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    take: 8,
    select: { id: true, name: true },
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    throw new Error(
      `Transporter "${query}" is ambiguous. Candidates: ${candidates
        .map((candidate) => `${candidate.name} (${candidate.id})`)
        .join("; ")}. Ask the user which one to use.`
    );
  }
  throw new Error(
    `Transporter "${query}" was not found. Try a different name or use search_transporters.`
  );
}

const orderSelect = {
  id: true,
  customeOrderId: true,
  isVerifiedByAdmin: true,
  customerId: true,
  OrderStatusType: { select: { id: true, name: true, displayName: true } },
  Customer: {
    select: {
      name: true,
      CustomerDetail: { select: { dbName: true, dbCategory: true }, take: 1 },
    },
  },
  OrderItem: {
    select: {
      productId: true,
      quantity: true,
      Product: { select: { name: true, productCode: true } },
    },
  },
  _count: { select: { StockRecord: true } },
} satisfies Prisma.OrderSelect;

export type ResolvedOrder = Prisma.OrderGetPayload<{
  select: typeof orderSelect;
}>;

export async function resolveOrder(input: {
  orderId?: string;
  orderCode?: string;
}): Promise<ResolvedOrder> {
  const rawId = input.orderId?.trim();
  const code = input.orderCode?.trim();
  const where: Prisma.OrderWhereInput | null = rawId
    ? isObjectId(rawId)
      ? { id: rawId }
      : { customeOrderId: rawId }
    : code
      ? { customeOrderId: code }
      : null;

  if (!where) {
    throw new Error("Provide orderId or orderCode.");
  }

  const order = await prisma.order.findFirst({ where, select: orderSelect });
  if (!order) {
    const key = rawId ?? code;
    throw new Error(`Order "${key}" was not found.`);
  }
  return order;
}

const purchaseSelect = {
  id: true,
  transporterId: true,
  vehicleNumber: true,
  driverContact: true,
  grnNumber: true,
  purchaseTransportStatus: true,
  stockAddedAt: true,
  Transporter: { select: { id: true, name: true } },
  PurchaseInvoice: {
    include: { PurchaseInvoiceItem: true },
  },
  purchaseStockBatches: {
    include: { product: { select: { name: true, productCode: true } } },
  },
  stockBatches: { select: { id: true } },
} satisfies Prisma.PurchaseSelect;

export type ResolvedPurchase = Prisma.PurchaseGetPayload<{
  select: typeof purchaseSelect;
}>;

function purchaseLabel(purchase: ResolvedPurchase): string {
  const invoices = purchase.PurchaseInvoice.map((invoice) => invoice.invoiceID)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
  return [
    purchase.vehicleNumber ? `vehicle ${purchase.vehicleNumber}` : null,
    purchase.grnNumber ? `GRN ${purchase.grnNumber}` : null,
    invoices ? `invoice ${invoices}` : null,
    `id ${purchase.id}`,
  ]
    .filter(Boolean)
    .join(" / ");
}

export async function resolvePurchase(input: {
  purchaseId?: string;
  grnNumber?: string;
  invoiceID?: string;
  vehicleNumber?: string;
}): Promise<ResolvedPurchase> {
  const purchaseId = input.purchaseId?.trim();

  if (purchaseId && isObjectId(purchaseId)) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      select: purchaseSelect,
    });
    if (!purchase) throw new Error(`Purchase id ${purchaseId} was not found.`);
    return purchase;
  }

  const or: Prisma.PurchaseWhereInput[] = [];
  if (purchaseId) {
    or.push(
      { grnNumber: { contains: purchaseId } },
      { vehicleNumber: { contains: purchaseId } },
      { PurchaseInvoice: { some: { invoiceID: { contains: purchaseId } } } }
    );
  }
  if (input.grnNumber) or.push({ grnNumber: { contains: input.grnNumber } });
  if (input.vehicleNumber) {
    or.push({ vehicleNumber: { contains: input.vehicleNumber } });
  }
  if (input.invoiceID) {
    or.push({ PurchaseInvoice: { some: { invoiceID: { contains: input.invoiceID } } } });
  }

  if (!or.length) {
    throw new Error("Provide purchaseId, grnNumber, invoiceID, or vehicleNumber.");
  }

  const matches = await prisma.purchase.findMany({
    where: { OR: or },
    take: 6,
    orderBy: { createdAt: "desc" },
    select: purchaseSelect,
  });

  if (!matches.length) {
    throw new Error("No purchase matched those details. Try search_purchases.");
  }
  if (matches.length > 1) {
    throw new Error(
      `Multiple purchases match. Candidates: ${matches
        .map(purchaseLabel)
        .join("; ")}. Ask the user which one to use.`
    );
  }
  return matches[0];
}
