"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transporter_controller_1 = require("./transporter.controller");
const transporter_middleware_1 = require("./transporter.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdminOrWarehouseManager);
router.post("/", transporter_middleware_1.validateCreateTransporter, transporter_controller_1.createTransporter);
router.get("/", transporter_controller_1.getTransporters);
router.get("/:id", transporter_controller_1.getTransporterById);
router.put("/:id", transporter_middleware_1.validateUpdateTransporter, transporter_controller_1.updateTransporter);
router.delete("/:id", transporter_controller_1.deleteTransporter);
exports.default = router;
//# sourceMappingURL=transporter.route.js.map