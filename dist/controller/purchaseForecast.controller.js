"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchaseForecastWorkbook = exports.upsertMonthlyPurchaseForecast = exports.getMonthlyPurchaseForecast = void 0;
const prisma_1 = require("../lib/prisma");
const openingStockSnapshot_1 = require("../lib/openingStockSnapshot");
const schemeDates_1 = require("../lib/schemeDates");
const purchaseForecastWorkbook_1 = require("../lib/purchaseForecastWorkbook");
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
async function billedQuantityByProductForMonth(monthStart, monthEnd) {
    const invoices = await prisma_1.prisma.purchaseInvoice.findMany({
        where: {
            invoiceDate: { gte: monthStart, lte: monthEnd },
        },
        select: {
            PurchaseInvoiceItem: {
                select: {
                    productId: true,
                    quantity: true,
                },
            },
        },
    });
    const billed = new Map();
    for (const inv of invoices) {
        for (const item of inv.PurchaseInvoiceItem) {
            const qty = item.quantity ?? 0;
            billed.set(item.productId, (billed.get(item.productId) ?? 0) + qty);
        }
    }
    return billed;
}
function parseForecastQuantity(raw) {
    if (raw === null || raw === undefined || raw === "") {
        return { ok: true, value: null };
    }
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        return {
            ok: false,
            message: "forecastQuantity must be a non-negative integer or null",
        };
    }
    return { ok: true, value: n };
}
/**
 * GET /api/purchase-forecast/monthly?date=YYYY-MM-DD
 */
const getMonthlyPurchaseForecast = async (req, res) => {
    try {
        const dateStr = req.query.date?.trim();
        if (!dateStr) {
            return res
                .status(400)
                .json({ message: "Query parameter 'date' (YYYY-MM-DD) is required" });
        }
        if (!(0, openingStockSnapshot_1.isIstYmd)(dateStr)) {
            return res.status(400).json({ message: "date must be YYYY-MM-DD" });
        }
        const yearMonth = (0, schemeDates_1.toIstYearMonthFromYmd)(dateStr);
        const { monthStart, monthEnd } = (0, schemeDates_1.istMonthBounds)(yearMonth);
        const [products, forecasts, billedByProduct] = await Promise.all([
            prisma_1.prisma.product.findMany({
                select: { id: true },
                orderBy: { productCode: "asc" },
            }),
            prisma_1.prisma.productMonthlyPurchaseForecast.findMany({
                where: { yearMonth },
                select: { productId: true, forecastQuantity: true },
            }),
            billedQuantityByProductForMonth(monthStart, monthEnd),
        ]);
        const forecastByProduct = new Map(forecasts.map((f) => [f.productId, f.forecastQuantity ?? null]));
        const rows = products.map((p) => {
            const forecastQuantity = forecastByProduct.get(p.id) ?? null;
            const billedQuantity = billedByProduct.get(p.id) ?? 0;
            const dueQuantity = forecastQuantity === null || forecastQuantity === undefined
                ? null
                : forecastQuantity - billedQuantity;
            return {
                productId: p.id,
                forecastQuantity,
                billedQuantity,
                dueQuantity,
            };
        });
        res.json({
            date: dateStr,
            yearMonth,
            monthLabel: (0, schemeDates_1.istMonthShortLabel)(yearMonth),
            monthStart: monthStart.toISOString(),
            monthEnd: monthEnd.toISOString(),
            rows,
        });
    }
    catch (error) {
        console.error("Error fetching monthly purchase forecast:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMonthlyPurchaseForecast = getMonthlyPurchaseForecast;
/**
 * PATCH /api/purchase-forecast/monthly
 * Body: { date: YYYY-MM-DD, productId, forecastQuantity: number | null }
 */
const upsertMonthlyPurchaseForecast = async (req, res) => {
    try {
        const dateStr = req.body?.date?.trim();
        const productId = req.body?.productId?.trim();
        const parsed = parseForecastQuantity(req.body?.forecastQuantity);
        if (!dateStr) {
            return res
                .status(400)
                .json({ message: "Body field 'date' (YYYY-MM-DD) is required" });
        }
        if (!(0, openingStockSnapshot_1.isIstYmd)(dateStr)) {
            return res.status(400).json({ message: "date must be YYYY-MM-DD" });
        }
        if (!productId || !OBJECT_ID_RE.test(productId)) {
            return res.status(400).json({ message: "Valid productId is required" });
        }
        if (!parsed.ok) {
            return res.status(400).json({ message: parsed.message });
        }
        const forecastQuantity = parsed.value;
        const product = await prisma_1.prisma.product.findUnique({
            where: { id: productId },
            select: { id: true },
        });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const yearMonth = (0, schemeDates_1.toIstYearMonthFromYmd)(dateStr);
        const { monthStart, monthEnd } = (0, schemeDates_1.istMonthBounds)(yearMonth);
        const row = await prisma_1.prisma.productMonthlyPurchaseForecast.upsert({
            where: {
                productId_yearMonth: { productId, yearMonth },
            },
            create: {
                productId,
                yearMonth,
                forecastQuantity,
            },
            update: { forecastQuantity },
            select: {
                productId: true,
                yearMonth: true,
                forecastQuantity: true,
            },
        });
        const billedByProduct = await billedQuantityByProductForMonth(monthStart, monthEnd);
        const billedQuantity = billedByProduct.get(productId) ?? 0;
        const dueQuantity = row.forecastQuantity === null || row.forecastQuantity === undefined
            ? null
            : row.forecastQuantity - billedQuantity;
        res.json({
            date: dateStr,
            yearMonth,
            monthLabel: (0, schemeDates_1.istMonthShortLabel)(yearMonth),
            productId: row.productId,
            forecastQuantity: row.forecastQuantity ?? null,
            billedQuantity,
            dueQuantity,
        });
    }
    catch (error) {
        console.error("Error upserting monthly purchase forecast:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.upsertMonthlyPurchaseForecast = upsertMonthlyPurchaseForecast;
/**
 * GET /api/purchase-forecast/workbook?yearMonth=YYYY-MM
 * Also accepts date=YYYY-MM-DD and derives the IST month.
 */
const getPurchaseForecastWorkbook = async (req, res) => {
    try {
        const yearMonthRaw = req.query.yearMonth?.trim();
        const dateRaw = req.query.date?.trim();
        let yearMonth = yearMonthRaw;
        if (!yearMonth && dateRaw) {
            if (!(0, openingStockSnapshot_1.isIstYmd)(dateRaw)) {
                return res.status(400).json({ message: "date must be YYYY-MM-DD" });
            }
            yearMonth = (0, schemeDates_1.toIstYearMonthFromYmd)(dateRaw);
        }
        if (!yearMonth) {
            return res.status(400).json({
                message: "Query parameter 'yearMonth' (YYYY-MM) or 'date' (YYYY-MM-DD) is required",
            });
        }
        if (!(0, schemeDates_1.isIstYearMonth)(yearMonth)) {
            return res.status(400).json({ message: "yearMonth must be YYYY-MM" });
        }
        const workbook = await (0, purchaseForecastWorkbook_1.loadPurchaseForecastWorkbook)(yearMonth);
        res.json(workbook);
    }
    catch (error) {
        console.error("Error fetching purchase forecast workbook:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPurchaseForecastWorkbook = getPurchaseForecastWorkbook;
//# sourceMappingURL=purchaseForecast.controller.js.map