"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTH_SHORT = exports.REPORT_ORDER_SELECT = void 0;
exports.findReportOrders = findReportOrders;
exports.computeOrderGrossSaleForReport = computeOrderGrossSaleForReport;
exports.computeOrderSaleForReport = computeOrderSaleForReport;
exports.computeOrderSaleFromSnapshots = computeOrderSaleFromSnapshots;
exports.getCompletedOrderFilter = getCompletedOrderFilter;
exports.getZonedDateParts = getZonedDateParts;
exports.resolveSafeTimeZone = resolveSafeTimeZone;
exports.zonedDateTimeToUtcDate = zonedDateTimeToUtcDate;
exports.formatMonthLabel = formatMonthLabel;
exports.formatBillingDate = formatBillingDate;
exports.getDaysInMonth = getDaysInMonth;
exports.isSunday = isSunday;
exports.addMonths = addMonths;
const prisma_1 = require("../lib/prisma");
const orderItemPriceSnapshot_1 = require("./orderItemPriceSnapshot");
const PRODUCT_PRICE_SELECT = {
    sellingPricePerCartonForDbWithGst: true,
    sellingPricePerCartonForDb: true,
    sellingPricePerCartonForRssWithGst: true,
    sellingPricePerCartonForRss: true,
    costPricePerCartonWithGst: true,
    costPricePerCarton: true,
};
exports.REPORT_ORDER_SELECT = {
    totalPrice: true,
    orderDate: true,
    customerId: true,
    cashDiscountPercent: true,
    ledgerBalance: true,
    Customer: {
        select: {
            CustomerDetail: {
                select: { dbCategory: true },
                take: 1,
            },
        },
    },
    OrderItem: {
        select: {
            quantity: true,
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
                select: PRODUCT_PRICE_SELECT,
            },
        },
    },
};
const ORDER_ITEM_NUMERIC_FIELDS = [
    "schemeDiscountPercent",
    "itemDiscountPercent",
    "gstPercentage",
    "packetsPerCarton",
    "costPricePerCarton",
    "costPricePerPacket",
    "sellingPricePerCartonForDb",
    "sellingPricePerPacketForDb",
    "sellingPricePerCartonForRss",
    "sellingPricePerPacketForRss",
];
function rawNumber(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "number")
        return value;
    if (typeof value === "object") {
        const wrapped = value;
        const inner = wrapped.$numberDouble ?? wrapped.$numberInt ?? wrapped.$numberLong ?? wrapped.$numberDecimal;
        if (inner !== undefined)
            return Number(inner);
    }
    return null;
}
function rawObjectId(value) {
    if (value && typeof value === "object" && "$oid" in value) {
        return String(value.$oid);
    }
    return String(value);
}
/**
 * Same result shape as `findMany({ select: REPORT_ORDER_SELECT })`, but order items are read with a raw
 * projection: Prisma's nested relation reads are very slow on large item volumes (multi-year reports).
 */
async function findReportOrders(where) {
    const orders = await prisma_1.prisma.order.findMany({
        where,
        select: {
            id: true,
            totalPrice: true,
            orderDate: true,
            customerId: true,
            cashDiscountPercent: true,
            ledgerBalance: true,
        },
    });
    if (orders.length === 0)
        return [];
    const projection = { orderId: 1, productId: 1, quantity: 1, pricingTier: 1 };
    for (const field of ORDER_ITEM_NUMERIC_FIELDS)
        projection[field] = 1;
    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    const [rawItems, customerDetails] = await Promise.all([
        prisma_1.prisma.orderItem.findRaw({
            filter: { orderId: { $in: orders.map((o) => ({ $oid: o.id })) } },
            options: { projection },
        }),
        prisma_1.prisma.customerDetail.findMany({
            where: { dbUserId: { in: customerIds } },
            select: { dbUserId: true, dbCategory: true },
        }),
    ]);
    const productIds = [...new Set(rawItems.map((item) => rawObjectId(item.productId)))];
    const products = await prisma_1.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, ...PRODUCT_PRICE_SELECT },
    });
    const productById = new Map(products.map(({ id, ...price }) => [id, price]));
    const detailByCustomer = new Map();
    for (const detail of customerDetails) {
        if (!detailByCustomer.has(detail.dbUserId)) {
            detailByCustomer.set(detail.dbUserId, { dbCategory: detail.dbCategory });
        }
    }
    const itemsByOrder = new Map();
    for (const raw of rawItems) {
        const product = productById.get(rawObjectId(raw.productId));
        if (!product)
            continue;
        const item = {
            quantity: rawNumber(raw.quantity) ?? 0,
            pricingTier: (raw.pricingTier ?? null),
            Product: product,
        };
        for (const field of ORDER_ITEM_NUMERIC_FIELDS) {
            item[field] = rawNumber(raw[field]);
        }
        const orderId = rawObjectId(raw.orderId);
        const list = itemsByOrder.get(orderId);
        if (list)
            list.push(item);
        else
            itemsByOrder.set(orderId, [item]);
    }
    return orders.map(({ id, ...order }) => {
        const detail = detailByCustomer.get(order.customerId);
        return {
            ...order,
            Customer: { CustomerDetail: detail ? [detail] : [] },
            OrderItem: itemsByOrder.get(id) ?? [],
        };
    });
}
function getProductCartonRate(product, dbCategory) {
    if (dbCategory === "RSS") {
        return product.sellingPricePerCartonForRssWithGst ?? product.sellingPricePerCartonForRss ?? 0;
    }
    if (dbCategory === "SS") {
        return product.costPricePerCartonWithGst ?? product.costPricePerCarton ?? 0;
    }
    return product.sellingPricePerCartonForDbWithGst ?? product.sellingPricePerCartonForDb ?? 0;
}
function getProductCartonRateExGst(product, dbCategory) {
    if (dbCategory === "RSS") {
        return product.sellingPricePerCartonForRss ?? 0;
    }
    if (dbCategory === "SS") {
        return product.costPricePerCarton ?? 0;
    }
    return product.sellingPricePerCartonForDb ?? 0;
}
/** Gross sale for party-wise report: qty × ex-GST rate, no scheme/GST/cash discount/ledger. */
function computeOrderGrossSaleForReport(order) {
    if (order.OrderItem.length === 0) {
        return order.totalPrice ?? 0;
    }
    const dbCategory = (0, orderItemPriceSnapshot_1.resolveDbCategory)(order.Customer ?? null);
    let total = 0;
    let hasAtLeastOneDerivableLine = false;
    for (const item of order.OrderItem) {
        const qty = item.quantity ?? 0;
        const resolved = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(item);
        if (resolved && resolved.carton > 0) {
            hasAtLeastOneDerivableLine = true;
            total += qty * resolved.carton;
            continue;
        }
        const product = item.Product;
        if (product) {
            const rate = getProductCartonRateExGst(product, dbCategory);
            if (rate > 0) {
                hasAtLeastOneDerivableLine = true;
                total += qty * rate;
            }
        }
    }
    if (!hasAtLeastOneDerivableLine) {
        return order.totalPrice ?? 0;
    }
    return total;
}
/** Sale amount for reports: snapshot rates first, then current product prices for legacy orders. */
function computeOrderSaleForReport(order) {
    if (order.OrderItem.length === 0) {
        return order.totalPrice ?? 0;
    }
    const dbCategory = (0, orderItemPriceSnapshot_1.resolveDbCategory)(order.Customer ?? null);
    let totalTaxable = 0;
    let totalWithGst = 0;
    let hasAtLeastOneDerivableLine = false;
    for (const item of order.OrderItem) {
        const qty = item.quantity ?? 0;
        const schemePercent = item.schemeDiscountPercent ?? 0;
        const itemDiscountPercent = item.itemDiscountPercent ?? 0;
        const resolved = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(item);
        if (resolved && resolved.carton > 0) {
            const base = qty * resolved.carton;
            hasAtLeastOneDerivableLine = true;
            const schemeAmount = base * (schemePercent / 100);
            const itemDiscountAmount = base * (itemDiscountPercent / 100);
            const taxable = base - schemeAmount - itemDiscountAmount;
            const gstAmount = taxable * (resolved.gstPercent / 100);
            totalTaxable += taxable;
            totalWithGst += taxable + gstAmount;
            continue;
        }
        const product = item.Product;
        if (product) {
            const rate = getProductCartonRate(product, dbCategory);
            if (rate > 0) {
                hasAtLeastOneDerivableLine = true;
                const base = qty * rate;
                const schemeAmount = base * (schemePercent / 100);
                const itemDiscountAmount = base * (itemDiscountPercent / 100);
                const lineTotal = base - schemeAmount - itemDiscountAmount;
                totalTaxable += lineTotal;
                totalWithGst += lineTotal;
            }
        }
    }
    if (!hasAtLeastOneDerivableLine) {
        return order.totalPrice ?? 0;
    }
    const cashDiscountPercent = order.cashDiscountPercent ?? 0;
    const cashDiscountAmount = totalTaxable * (cashDiscountPercent / 100);
    const chargeableAmount = totalWithGst - cashDiscountAmount;
    const ledgerAdjustment = order.ledgerBalance ?? 0;
    return chargeableAmount + ledgerAdjustment;
}
function computeOrderSaleFromSnapshots(order) {
    if (order.OrderItem.length === 0) {
        return order.totalPrice ?? 0;
    }
    let totalTaxable = 0;
    let totalWithGst = 0;
    let hasAtLeastOneDerivableLine = false;
    for (const item of order.OrderItem) {
        const qty = item.quantity ?? 0;
        const resolved = (0, orderItemPriceSnapshot_1.resolveOrderItemSnapshotRates)(item);
        const rate = resolved?.carton ?? 0;
        const gstPercent = resolved?.gstPercent ?? 0;
        const base = qty * rate;
        if (base > 0)
            hasAtLeastOneDerivableLine = true;
        const schemePercent = item.schemeDiscountPercent ?? 0;
        const schemeAmount = base * (schemePercent / 100);
        const itemDiscountPercent = item.itemDiscountPercent ?? 0;
        const itemDiscountAmount = base * (itemDiscountPercent / 100);
        const taxable = base - schemeAmount - itemDiscountAmount;
        const gstAmount = taxable * (gstPercent / 100);
        totalTaxable += taxable;
        totalWithGst += taxable + gstAmount;
    }
    if (!hasAtLeastOneDerivableLine) {
        return order.totalPrice ?? 0;
    }
    const cashDiscountPercent = order.cashDiscountPercent ?? 0;
    const cashDiscountAmount = totalTaxable * (cashDiscountPercent / 100);
    const chargeableAmount = totalWithGst - cashDiscountAmount;
    const ledgerAdjustment = order.ledgerBalance ?? 0;
    return chargeableAmount + ledgerAdjustment;
}
async function getCompletedOrderFilter() {
    const completedOrderStatusType = await prisma_1.prisma.orderStatusType.findFirst({
        where: { name: { in: ["COMPLETE", "COMPLETED"] } },
        select: { id: true },
    });
    return completedOrderStatusType
        ? {
            OR: [{ orderStatusTypeId: completedOrderStatusType.id }, { status: "COMPLETED" }],
        }
        : { status: "COMPLETED" };
}
function getZonedDateParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const mapped = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
        year: Number(mapped.year),
        month: Number(mapped.month),
        day: Number(mapped.day),
        hour: Number(mapped.hour),
        minute: Number(mapped.minute),
        second: Number(mapped.second),
    };
}
function resolveSafeTimeZone(timeZone) {
    if (!timeZone)
        return "Asia/Kolkata";
    try {
        Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
        return timeZone;
    }
    catch {
        return "Asia/Kolkata";
    }
}
function getTimeZoneOffsetMs(date, timeZone) {
    const parts = getZonedDateParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
    return asUtc - date.getTime();
}
function zonedDateTimeToUtcDate(timeZone, year, monthIndex, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
    let utcMillis = Date.UTC(year, monthIndex, day, hour, minute, second, millisecond);
    for (let i = 0; i < 2; i += 1) {
        const offset = getTimeZoneOffsetMs(new Date(utcMillis), timeZone);
        utcMillis = Date.UTC(year, monthIndex, day, hour, minute, second, millisecond) - offset;
    }
    return new Date(utcMillis);
}
exports.MONTH_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
function formatMonthLabel(year, month) {
    return `${exports.MONTH_SHORT[month - 1]}-${String(year).slice(2)}`;
}
function formatBillingDate(date, timeZone) {
    const parts = getZonedDateParts(date, timeZone);
    return `${parts.day}-${exports.MONTH_SHORT[parts.month - 1]}`;
}
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}
function isSunday(year, month, day) {
    return new Date(year, month - 1, day).getDay() === 0;
}
function addMonths(year, month, delta) {
    const d = new Date(year, month - 1 + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
//# sourceMappingURL=orderSaleAmount.js.map