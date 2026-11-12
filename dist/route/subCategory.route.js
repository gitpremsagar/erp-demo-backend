"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const subCategory_controller_1 = require("../controller/subCategory.controller");
const subCategory_middleware_1 = require("../middleware/subCategory.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken);
router.post("/", auth_middleware_1.requireAdmin, subCategory_middleware_1.validateCreateSubCategory, subCategory_controller_1.createSubCategory);
router.get("/", subCategory_controller_1.getSubCategories);
router.get("/:id", subCategory_controller_1.getSubCategoryById);
router.put("/:id", auth_middleware_1.requireAdmin, subCategory_middleware_1.validateUpdateSubCategory, subCategory_controller_1.updateSubCategory);
router.delete("/:id", auth_middleware_1.requireAdmin, subCategory_controller_1.deleteSubCategory);
exports.default = router;
//# sourceMappingURL=subCategory.route.js.map