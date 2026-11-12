"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productScheme_controller_1 = require("../controller/productScheme.controller");
const productScheme_middleware_1 = require("../middleware/productScheme.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new product scheme
router.post("/", auth_middleware_1.requireAdmin, productScheme_middleware_1.validateCreateProductScheme, productScheme_controller_1.createProductScheme);
// Get all product schemes with pagination and filtering
router.get("/", productScheme_middleware_1.validateProductSchemeQuery, productScheme_controller_1.getProductSchemes);
// Get active schemes for a specific product
router.get("/product/:productId/active", productScheme_controller_1.getActiveSchemesByProduct);
// Get a single product scheme by ID
router.get("/:id", productScheme_controller_1.getProductSchemeById);
// Update a product scheme
router.put("/:id", auth_middleware_1.requireAdmin, productScheme_middleware_1.validateUpdateProductScheme, productScheme_controller_1.updateProductScheme);
// Toggle product scheme status (activate/deactivate)
router.patch("/:id/toggle-status", auth_middleware_1.requireAdmin, productScheme_middleware_1.validateToggleStatus, productScheme_controller_1.toggleProductSchemeStatus);
// Delete a product scheme
router.delete("/:id", auth_middleware_1.requireAdmin, productScheme_controller_1.deleteProductScheme);
exports.default = router;
//# sourceMappingURL=productScheme.route.js.map