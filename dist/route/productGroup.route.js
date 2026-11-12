"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productGroup_controller_1 = require("../controller/productGroup.controller");
const productGroup_middleware_1 = require("../middleware/productGroup.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Protected routes - require authentication
router.use(auth_middleware_1.validateAccessToken);
// Create a new product group
router.post("/", auth_middleware_1.requireAdmin, productGroup_middleware_1.validateCreateProductGroup, productGroup_controller_1.createProductGroup);
// Get all product groups with pagination and filtering
router.get("/", productGroup_middleware_1.validateProductGroupQuery, productGroup_controller_1.getProductGroups);
// Get product group statistics
router.get("/stats", productGroup_controller_1.getProductGroupStats);
// Get a single product group by ID
router.get("/:id", productGroup_controller_1.getProductGroupById);
// Update a product group
router.put("/:id", auth_middleware_1.requireAdmin, productGroup_middleware_1.validateUpdateProductGroup, productGroup_controller_1.updateProductGroup);
// Delete a product group
router.delete("/:id", auth_middleware_1.requireAdmin, productGroup_controller_1.deleteProductGroup);
exports.default = router;
//# sourceMappingURL=productGroup.route.js.map