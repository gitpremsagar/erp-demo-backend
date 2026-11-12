"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartonsToPallets = cartonsToPallets;
exports.palletsToCartons = palletsToCartons;
exports.loadPurchaseForecastWorkbook = loadPurchaseForecastWorkbook;
const prisma_1 = require("./prisma");
const orderSaleAmount_1 = require("./orderSaleAmount");
const schemeDates_1 = require("./schemeDates");
const dailyStockReport_1 = require("./dailyStockReport");
const ACTIVE_PRODUCT_WHERE = {
    OR: [
        { isDiscontinued: false },
        { isDiscontinued: null },
        { isDiscontinued: { isSet: false } },
    ],
};
function addQty(map, key, qty) {
    if (!qty)
        return;
    map.set(key, (map.get(key) ?? 0) + qty);
}
function addQtyByMonth(map, key, yearMonth, qty) {
    if (!qty)
        return;
    let byMonth = map.get(key);
    if (!byMonth) {
        byMonth = new Map();
        map.set(key, byMonth);
    }
    byMonth.set(yearMonth, (byMonth.get(yearMonth) ?? 0) + qty);
}
function groupKeyFor(productId, groupIdByProduct) {
    return groupIdByProduct.get(productId) || productId;
}
function istYearMonthOf(date) {
    return (0, schemeDates_1.toIstYmd)(date).slice(0, 7);
}
function cartonsToPallets(cartons, cartonsPerPallet) {
    if (cartons === null || cartons === undefined)
        return null;
    if (!cartonsPerPallet || cartonsPerPallet <= 0)
        return null;
    const pallets = cartons / cartonsPerPallet;
    return Number.isInteger(pallets) ? pallets : Math.round(pallets * 100) / 100;
}
function palletsToCartons(pallets, cartonsPerPallet) {
    return pallets * cartonsPerPallet;
}
function suggestQtyFromPreviousMonths(sales) {
    const lastThree = sales.slice(1, 4);
    const avg = lastThree.reduce((sum, n) => sum + n, 0) / Math.max(lastThree.length, 1);
    return Math.round(avg);
}
async function salesLinesForRange(rangeStart, rangeEnd, completedFilter) {
    const items = await prisma_1.prisma.orderItem.findMany({
        where: {
            Order: {
                ...completedFilter,
                orderDate: { gte: rangeStart, lte: rangeEnd },
            },
        },
        select: {
            productId: true,
            quantity: true,
            Order: { select: { orderDate: true } },
        },
    });
    const lines = [];
    for (const item of items) {
        const orderDate = item.Order?.orderDate;
        if (!orderDate)
            continue;
        lines.push({
            productId: item.productId,
            quantity: item.quantity ?? 0,
            yearMonth: istYearMonthOf(orderDate),
        });
    }
    return lines;
}
async function purchaseQtyByProductByDay(yearMonth) {
    const { monthStart, monthEnd } = (0, schemeDates_1.istMonthBounds)(yearMonth);
    const invoices = await prisma_1.prisma.purchaseInvoice.findMany({
        where: { invoiceDate: { gte: monthStart, lte: monthEnd } },
        select: {
            invoiceDate: true,
            PurchaseInvoiceItem: {
                select: { productId: true, quantity: true },
            },
        },
    });
    const byProduct = new Map();
    for (const inv of invoices) {
        if (!inv.invoiceDate)
            continue;
        const ymd = (0, schemeDates_1.toIstYmd)(inv.invoiceDate);
        if (!ymd.startsWith(yearMonth))
            continue;
        const day = Number(ymd.slice(8, 10));
        if (!Number.isFinite(day) || day < 1)
            continue;
        for (const item of inv.PurchaseInvoiceItem) {
            const qty = item.quantity ?? 0;
            if (!qty)
                continue;
            let byDay = byProduct.get(item.productId);
            if (!byDay) {
                byDay = new Map();
                byProduct.set(item.productId, byDay);
            }
            byDay.set(day, (byDay.get(day) ?? 0) + qty);
        }
    }
    return byProduct;
}
async function loadPurchaseForecastWorkbook(yearMonth) {
    if (!(0, schemeDates_1.isIstYearMonth)(yearMonth)) {
        throw new Error("yearMonth must be YYYY-MM");
    }
    const previousMonths = [4, 3, 2, 1].map((delta) => {
        const key = (0, schemeDates_1.shiftIstYearMonth)(yearMonth, -delta);
        return { yearMonth: key, label: (0, schemeDates_1.istMonthShortLabel)(key) };
    });
    const previousYearMonth = (0, schemeDates_1.shiftIstYearMonth)(yearMonth, -12);
    const purchaseMonth = yearMonth;
    const purchaseDays = (0, schemeDates_1.istMonthDayNumbers)(purchaseMonth);
    const salesWindowStart = (0, schemeDates_1.istMonthBounds)(previousMonths[0].yearMonth)
        .monthStart;
    const salesWindowEnd = (0, schemeDates_1.istMonthBounds)(previousMonths[3].yearMonth).monthEnd;
    const prevYearBounds = (0, schemeDates_1.istMonthBounds)(previousYearMonth);
    const todayYmd = (0, schemeDates_1.toIstYmd)(new Date());
    const completedFilter = await (0, orderSaleAmount_1.getCompletedOrderFilter)();
    const [products, productGroupIds, forecasts, salesRecent, salesPrevYear, purchaseByProduct, stockReport,] = await Promise.all([
        prisma_1.prisma.product.findMany({
            where: ACTIVE_PRODUCT_WHERE,
            select: {
                id: true,
                name: true,
                mrp: true,
                productCode: true,
                productGroupId: true,
                cartonsPerPallet: true,
                costPricePerCarton: true,
                positionSerialNumber: true,
                Category: { select: { name: true, position: true } },
                SubCategory: { select: { name: true } },
                ProductGroup: { select: { name: true } },
            },
            orderBy: [{ positionSerialNumber: "asc" }, { productCode: "asc" }],
        }),
        prisma_1.prisma.product.findMany({
            select: { id: true, productGroupId: true },
        }),
        prisma_1.prisma.productMonthlyPurchaseForecast.findMany({
            where: { yearMonth },
            select: { productId: true, forecastQuantity: true },
        }),
        salesLinesForRange(salesWindowStart, salesWindowEnd, completedFilter),
        salesLinesForRange(prevYearBounds.monthStart, prevYearBounds.monthEnd, completedFilter),
        purchaseQtyByProductByDay(purchaseMonth),
        (0, dailyStockReport_1.buildDailyStockReportRows)(todayYmd),
    ]);
    const forecastByProduct = new Map(forecasts.map((f) => [f.productId, f.forecastQuantity ?? null]));
    const groupIdByProduct = new Map(productGroupIds.map((p) => [p.id, p.productGroupId ?? null]));
    const recentSalesByGroup = new Map();
    for (const line of salesRecent) {
        addQtyByMonth(recentSalesByGroup, groupKeyFor(line.productId, groupIdByProduct), line.yearMonth, line.quantity);
    }
    const prevYearSaleByGroup = new Map();
    for (const line of salesPrevYear) {
        addQty(prevYearSaleByGroup, groupKeyFor(line.productId, groupIdByProduct), line.quantity);
    }
    const actualStockByProduct = new Map();
    for (const row of stockReport.rows) {
        actualStockByProduct.set(row.productId, (0, dailyStockReport_1.actualStockFromDailyRow)(row));
    }
    const rows = products.map((p) => {
        const groupKey = p.productGroupId || p.id;
        const previousMonthsSales = previousMonths.map((m) => recentSalesByGroup.get(groupKey)?.get(m.yearMonth) ?? 0);
        const forecastQuantity = forecastByProduct.get(p.id) ?? null;
        const byDay = purchaseByProduct.get(p.id);
        const actualPurchaseByDay = {};
        let actualPurchaseTotal = 0;
        if (byDay) {
            for (const [day, qty] of byDay) {
                actualPurchaseByDay[String(day)] = qty;
                actualPurchaseTotal += qty;
            }
        }
        return {
            productId: p.id,
            name: p.name,
            mrp: p.mrp,
            productCode: p.productCode,
            categoryName: p.Category?.name ?? "",
            subCategoryName: p.SubCategory?.name ?? "",
            productGroupName: p.ProductGroup?.name ?? "",
            cartonsPerPallet: p.cartonsPerPallet ?? null,
            costPricePerCarton: p.costPricePerCarton ?? null,
            positionSerialNumber: p.positionSerialNumber ?? null,
            previousYearSale: prevYearSaleByGroup.get(groupKey) ?? 0,
            previousMonthsSales,
            suggestQty: suggestQtyFromPreviousMonths(previousMonthsSales),
            actualStock: actualStockByProduct.get(p.id) ?? 0,
            forecastQuantity,
            forecastPallets: cartonsToPallets(forecastQuantity, p.cartonsPerPallet ?? null),
            actualPurchaseByDay,
            actualPurchaseTotal,
            balanceForecast: forecastQuantity === null ? null : forecastQuantity - actualPurchaseTotal,
        };
    });
    let car = 0;
    let valueBasic = 0;
    for (const row of rows) {
        const qty = row.forecastQuantity ?? 0;
        car += qty;
        valueBasic += qty * (row.costPricePerCarton ?? 0);
    }
    return {
        yearMonth,
        monthLabel: (0, schemeDates_1.istMonthShortLabel)(yearMonth),
        previousYearMonth,
        previousMonths,
        actualPurchase: {
            yearMonth: purchaseMonth,
            days: purchaseDays,
            labels: purchaseDays.map((d) => String(d).padStart(2, "0")),
        },
        totals: { car, valueBasic },
        rows,
    };
}
//# sourceMappingURL=purchaseForecastWorkbook.js.map