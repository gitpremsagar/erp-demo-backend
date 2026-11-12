"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const product_controller_1 = require("../controller/product.controller");
const product_middleware_1 = require("../middleware/product.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new product
router.post("/", auth_middleware_1.requireAdmin, product_middleware_1.validateCreateProduct, product_controller_1.createProduct);
// Get all products with pagination and filtering
router.get("/", product_middleware_1.validateProductQuery, product_controller_1.getProducts);
// Get products for distributors - only basic product information
router.get("/distributor", product_middleware_1.validateProductQuery, product_controller_1.getProductsForDistributor);
// Get products for a specific order (modify-order view) - includes forecast items and availableForOrder
router.get("/distributor-order/:orderId", product_middleware_1.validateProductQuery, product_controller_1.getDistributorOrderProductsForOrderUpdate);
// Get products for distributor orders (generic) - includes forecast items
router.get("/distributor-order", product_middleware_1.validateProductQuery, product_controller_1.getDistributorOrderProducts);
// Last completed sale date per product for one customer
router.get("/last-sold", product_controller_1.getLastSoldByCustomer);
// Get product statistics
router.get("/stats", product_controller_1.getProductStats);
// Slim id/name/productCode catalog for purchase autosuggest and Excel import
router.get("/lookup", product_controller_1.getProductLookup);
// Bulk update Tally/DMS quantities (Excel import) — before /:id routes
router.post("/external-stock/bulk", auth_middleware_1.requireAdmin, product_controller_1.bulkUpdateProductExternalStock);
// Patch Tally/DMS qty + remarks for one product
router.patch("/:id/external-stock", auth_middleware_1.requireAdmin, product_controller_1.updateProductExternalStock);
// Get current active scheme for a product
router.get("/:id/active-scheme", product_controller_1.getCurrentActiveScheme);
// Get sales and forecast history for a product (for a distributor)
router.get("/:productId/sales-forecast-history", product_controller_1.getProductSalesAndForecastHistory);
// Get change history for a product
router.get("/:productId/change-history", product_controller_1.getProductChangeHistory);
// Get a single product by ID
router.get("/:id", product_controller_1.getProductById);
// Update a product
router.put("/:id", auth_middleware_1.requireAdmin, product_middleware_1.validateUpdateProduct, product_controller_1.updateProduct);
// Partial update a product (same handler as PUT)
router.patch("/:id", auth_middleware_1.requireAdmin, product_middleware_1.validateUpdateProduct, product_controller_1.updateProduct);
// Delete a product
router.delete("/:id", auth_middleware_1.requireAdmin, product_controller_1.deleteProduct);
exports.default = router;
//# sourceMappingURL=product.route.js.map