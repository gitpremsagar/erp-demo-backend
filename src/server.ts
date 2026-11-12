import cron from "node-cron";
import express from "express";
import helmet from "helmet";
import { recordOpeningStockForDate } from "./controller/openingStock.controller";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
// test comment
// Route Handlers
import authRouteHandler from "./route/auth.route";
import productRouteHandler from "./route/product.route";
import categoryRouteHandler from "./route/category.route";
import subCategoryRouteHandler from "./route/subCategory.route";
import vehicleRouteHandler from "./route/vehicle.route";
import vehicleTypeRouteHandler from "./route/vehicleType.route";
import orderRouteHandler from "./route/order.route";
import orderItemRouteHandler from "./route/orderItem.route";
import customerRouteHandler from "./route/customer.route";
import employeeRouteHandler from "./route/employee.route";
import deliveryAddressRouteHandler from "./route/deliveryAddress.route";
import productTagRouteHandler from "./route/productTag.route";
import productGroupRouteHandler from "./route/productGroup.route";
import stockBatchRouteHandler from "./route/stockBatch.route";
import stockRecordRouteHandler from "./route/stockRecord.route";
import plantRouteHandler from "./route/plant.route";
import orderForecastRouteHandler from "./route/orderForecast.route";
import productSchemeRouteHandler from "./route/productScheme.route";
import salesOfficerRouteHandler from "./route/salesOfficer.route";
import transporterRouteHandler from "./module/transporter/transporter.route";
import dispatchTripRouteHandler from "./module/dispatch-trip/dispatch-trip.route";
import purchaseRouteHandler from "./module/purchase/purchase.route";
import orderStatusTypeRouteHandler from "./route/orderStatusType.route";
import dashboardRouteHandler from "./route/dashboard.route";
import openingStockRouteHandler from "./route/openingStock.route";
import purchaseForecastRouteHandler from "./route/purchaseForecast.route";
import salesReturnRouteHandler from "./module/sales-return/sales-return.route";
import creditNoteRouteHandler from "./module/credit-note/credit-note.route";
import guardRouteHandler from "./route/guard.route";
import guardAttendanceRouteHandler from "./route/guard.attendance.route";
import attendanceRouteHandler from "./module/attendance/attendance.route";
import partyReportTagRouteHandler from "./route/partyReportTag.route";
import reportsRouteHandler from "./route/reports.route";
import tallyInvoiceSettingsRouteHandler from "./route/tallyInvoiceSettings.route";
import productAllocationRouteHandler from "./module/product-allocation/product-allocation.route";

const app = express();

// Trust Vercel / reverse-proxy forwarding for accurate req.ip and cookies.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());

const productionOrigins = [
  "https://www.srigopaltraders.com",
  "https://srigopaltraders.com",
];
const developmentOrigins = ["http://localhost:3000"];
const extraOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [...productionOrigins, ...extraOrigins]
    : [...developmentOrigins, ...extraOrigins];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Hello World! Test after reconnecting git!");
});

// endpoints
app.use("/api/auth", authRouteHandler);
app.use("/api/products", productRouteHandler);
app.use("/api/categories", categoryRouteHandler);
app.use("/api/subcategories", subCategoryRouteHandler);
app.use("/api/vehicles", vehicleRouteHandler);
app.use("/api/vehicle-types", vehicleTypeRouteHandler);
app.use("/api/orders", orderRouteHandler);
app.use("/api/order-items", orderItemRouteHandler);
app.use("/api/customers", customerRouteHandler);
app.use("/api/employees", employeeRouteHandler);
app.use("/api/delivery-addresses", deliveryAddressRouteHandler);
app.use("/api/product-tags", productTagRouteHandler);
app.use("/api/product-groups", productGroupRouteHandler);
app.use("/api/stock-batches", stockBatchRouteHandler);
app.use("/api/stock-records", stockRecordRouteHandler);
app.use("/api/plants", plantRouteHandler);
app.use("/api/order-forecasts", orderForecastRouteHandler);
app.use("/api/product-schemes", productSchemeRouteHandler);
app.use("/api/sales-officers", salesOfficerRouteHandler);
app.use("/api/transporters", transporterRouteHandler);
app.use("/api/dispatch-trips", dispatchTripRouteHandler);
app.use("/api/purchases", purchaseRouteHandler);
app.use("/api/order-status-types", orderStatusTypeRouteHandler);
app.use("/api/dashboard", dashboardRouteHandler);
app.use("/api/opening-stock", openingStockRouteHandler);
app.use("/api/purchase-forecast", purchaseForecastRouteHandler);
app.use("/api/sales-returns", salesReturnRouteHandler);
app.use("/api/credit-notes", creditNoteRouteHandler);
app.use("/api/guard", guardRouteHandler);
app.use("/api/guard/attendance", guardAttendanceRouteHandler);
app.use("/api/attendance", attendanceRouteHandler);
app.use("/api/party-report-tags", partyReportTagRouteHandler);
app.use("/api/reports", reportsRouteHandler);
app.use("/api/tally-invoice-settings", tallyInvoiceSettingsRouteHandler);
app.use("/api/product-allocations", productAllocationRouteHandler);

// Local / long-running process only. On Vercel, @vercel/node imports this app.
const isVercel = !!process.env.VERCEL;
if (!isVercel) {
  const PORT = process.env.PORT || 3008;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(
      `Cookie Domain: ${process.env.COOKIE_DOMAIN || "undefined (localhost)"}`
    );
    console.log(`Visit: http://localhost:${PORT}`);

    // Daily opening stock snapshot at 2:00 AM (server local time).
    // Reconstructs true IST start-of-day openings for today and recent days.
    // On Vercel use vercel.json crons instead.
    cron.schedule("0 2 * * *", async () => {
      try {
        const { dates, productCount } = await recordOpeningStockForDate();
        console.log(
          `[Cron] Opening stock recorded for ${dates.join(", ")} (${productCount} products)`
        );
      } catch (err) {
        console.error("[Cron] Opening stock recording failed:", err);
      }
    });
  });
}

export = app;
