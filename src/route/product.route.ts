import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductsForDistributor,
  getCurrentActiveScheme,
  getDistributorOrderProducts,
  getProductSalesAndForecastHistory,
  getDistributorOrderProductsForOrderUpdate,
  getLastSoldByCustomer,
  getProductChangeHistory,
  getProductLookup,
  updateProductExternalStock,
  bulkUpdateProductExternalStock,
} from "../controller/product.controller";
import {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductQuery,
} from "../middleware/product.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

// Protected routes - require authentication
router.use(validateAccessToken);

// Create a new product
router.post("/", requireAdmin, validateCreateProduct, createProduct);

// Get all products with pagination and filtering
router.get("/", validateProductQuery, getProducts);

// Get products for distributors - only basic product information
router.get("/distributor", validateProductQuery, getProductsForDistributor);

// Get products for a specific order (modify-order view) - includes forecast items and availableForOrder
router.get(
  "/distributor-order/:orderId",
  validateProductQuery,
  getDistributorOrderProductsForOrderUpdate
);

// Get products for distributor orders (generic) - includes forecast items
router.get(
  "/distributor-order",
  validateProductQuery,
  getDistributorOrderProducts
);

// Last completed sale date per product for one customer
router.get("/last-sold", getLastSoldByCustomer);

// Get product statistics
router.get("/stats", getProductStats);

// Slim id/name/productCode catalog for purchase autosuggest and Excel import
router.get("/lookup", getProductLookup);

// Bulk update Tally/DMS quantities (Excel import) — before /:id routes
router.post("/external-stock/bulk", requireAdmin, bulkUpdateProductExternalStock);

// Patch Tally/DMS qty + remarks for one product
router.patch("/:id/external-stock", requireAdmin, updateProductExternalStock);

// Get current active scheme for a product
router.get("/:id/active-scheme", getCurrentActiveScheme);

// Get sales and forecast history for a product (for a distributor)
router.get("/:productId/sales-forecast-history", getProductSalesAndForecastHistory);

// Get change history for a product
router.get("/:productId/change-history", getProductChangeHistory);

// Get a single product by ID
router.get("/:id", getProductById);

// Update a product
router.put("/:id", requireAdmin, validateUpdateProduct, updateProduct);

// Partial update a product (same handler as PUT)
router.patch("/:id", requireAdmin, validateUpdateProduct, updateProduct);

// Delete a product
router.delete("/:id", requireAdmin, deleteProduct);

export default router;
