"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const node_cron_1 = __importDefault(require("node-cron"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const openingStock_controller_1 = require("./controller/openingStock.controller");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// test comment
// Route Handlers
const auth_route_1 = __importDefault(require("./route/auth.route"));
const product_route_1 = __importDefault(require("./route/product.route"));
const category_route_1 = __importDefault(require("./route/category.route"));
const subCategory_route_1 = __importDefault(require("./route/subCategory.route"));
const vehicle_route_1 = __importDefault(require("./route/vehicle.route"));
const vehicleType_route_1 = __importDefault(require("./route/vehicleType.route"));
const order_route_1 = __importDefault(require("./route/order.route"));
const orderItem_route_1 = __importDefault(require("./route/orderItem.route"));
const customer_route_1 = __importDefault(require("./route/customer.route"));
const employee_route_1 = __importDefault(require("./route/employee.route"));
const deliveryAddress_route_1 = __importDefault(require("./route/deliveryAddress.route"));
const productTag_route_1 = __importDefault(require("./route/productTag.route"));
const productGroup_route_1 = __importDefault(require("./route/productGroup.route"));
const stockBatch_route_1 = __importDefault(require("./route/stockBatch.route"));
const stockRecord_route_1 = __importDefault(require("./route/stockRecord.route"));
const plant_route_1 = __importDefault(require("./route/plant.route"));
const orderForecast_route_1 = __importDefault(require("./route/orderForecast.route"));
const productScheme_route_1 = __importDefault(require("./route/productScheme.route"));
const salesOfficer_route_1 = __importDefault(require("./route/salesOfficer.route"));
const transporter_route_1 = __importDefault(require("./module/transporter/transporter.route"));
const dispatch_trip_route_1 = __importDefault(require("./module/dispatch-trip/dispatch-trip.route"));
const purchase_route_1 = __importDefault(require("./module/purchase/purchase.route"));
const orderStatusType_route_1 = __importDefault(require("./route/orderStatusType.route"));
const dashboard_route_1 = __importDefault(require("./route/dashboard.route"));
const openingStock_route_1 = __importDefault(require("./route/openingStock.route"));
const purchaseForecast_route_1 = __importDefault(require("./route/purchaseForecast.route"));
const sales_return_route_1 = __importDefault(require("./module/sales-return/sales-return.route"));
const credit_note_route_1 = __importDefault(require("./module/credit-note/credit-note.route"));
const guard_route_1 = __importDefault(require("./route/guard.route"));
const guard_attendance_route_1 = __importDefault(require("./route/guard.attendance.route"));
const attendance_route_1 = __importDefault(require("./module/attendance/attendance.route"));
const partyReportTag_route_1 = __importDefault(require("./route/partyReportTag.route"));
const reports_route_1 = __importDefault(require("./route/reports.route"));
const tallyInvoiceSettings_route_1 = __importDefault(require("./route/tallyInvoiceSettings.route"));
const product_allocation_route_1 = __importDefault(require("./module/product-allocation/product-allocation.route"));
const app = (0, express_1.default)();
// Trust Vercel / reverse-proxy forwarding for accurate req.ip and cookies.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((0, helmet_1.default)());
const productionOrigins = [
    "https://www.srigopaltraders.com",
    "https://srigopaltraders.com",
];
const developmentOrigins = ["http://localhost:3000"];
const extraOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
const allowedOrigins = process.env.NODE_ENV === "production"
    ? [...productionOrigins, ...extraOrigins]
    : [...developmentOrigins, ...extraOrigins];
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.get("/", (req, res) => {
    res.send("Hello World! Test after reconnecting git!");
});
// endpoints
app.use("/api/auth", auth_route_1.default);
app.use("/api/products", product_route_1.default);
app.use("/api/categories", category_route_1.default);
app.use("/api/subcategories", subCategory_route_1.default);
app.use("/api/vehicles", vehicle_route_1.default);
app.use("/api/vehicle-types", vehicleType_route_1.default);
app.use("/api/orders", order_route_1.default);
app.use("/api/order-items", orderItem_route_1.default);
app.use("/api/customers", customer_route_1.default);
app.use("/api/employees", employee_route_1.default);
app.use("/api/delivery-addresses", deliveryAddress_route_1.default);
app.use("/api/product-tags", productTag_route_1.default);
app.use("/api/product-groups", productGroup_route_1.default);
app.use("/api/stock-batches", stockBatch_route_1.default);
app.use("/api/stock-records", stockRecord_route_1.default);
app.use("/api/plants", plant_route_1.default);
app.use("/api/order-forecasts", orderForecast_route_1.default);
app.use("/api/product-schemes", productScheme_route_1.default);
app.use("/api/sales-officers", salesOfficer_route_1.default);
app.use("/api/transporters", transporter_route_1.default);
app.use("/api/dispatch-trips", dispatch_trip_route_1.default);
app.use("/api/purchases", purchase_route_1.default);
app.use("/api/order-status-types", orderStatusType_route_1.default);
app.use("/api/dashboard", dashboard_route_1.default);
app.use("/api/opening-stock", openingStock_route_1.default);
app.use("/api/purchase-forecast", purchaseForecast_route_1.default);
app.use("/api/sales-returns", sales_return_route_1.default);
app.use("/api/credit-notes", credit_note_route_1.default);
app.use("/api/guard", guard_route_1.default);
app.use("/api/guard/attendance", guard_attendance_route_1.default);
app.use("/api/attendance", attendance_route_1.default);
app.use("/api/party-report-tags", partyReportTag_route_1.default);
app.use("/api/reports", reports_route_1.default);
app.use("/api/tally-invoice-settings", tallyInvoiceSettings_route_1.default);
app.use("/api/product-allocations", product_allocation_route_1.default);
// Local / long-running process only. On Vercel, @vercel/node imports this app.
const isVercel = !!process.env.VERCEL;
if (!isVercel) {
    const PORT = process.env.PORT || 3008;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(`Cookie Domain: ${process.env.COOKIE_DOMAIN || "undefined (localhost)"}`);
        console.log(`Visit: http://localhost:${PORT}`);
        // Daily opening stock snapshot at 2:00 AM (server local time).
        // Reconstructs true IST start-of-day openings for today and recent days.
        // On Vercel use vercel.json crons instead.
        node_cron_1.default.schedule("0 2 * * *", async () => {
            try {
                const { dates, productCount } = await (0, openingStock_controller_1.recordOpeningStockForDate)();
                console.log(`[Cron] Opening stock recorded for ${dates.join(", ")} (${productCount} products)`);
            }
            catch (err) {
                console.error("[Cron] Opening stock recording failed:", err);
            }
        });
    });
}
module.exports = app;
//# sourceMappingURL=server.js.map