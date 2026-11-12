"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const partyReportTag_controller_1 = require("../controller/partyReportTag.controller");
const partyReportTag_middleware_1 = require("../middleware/partyReportTag.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.validateAccessToken, auth_middleware_1.requireAdmin);
router.post("/", partyReportTag_middleware_1.validateCreatePartyReportTag, partyReportTag_controller_1.createPartyReportTag);
router.get("/", partyReportTag_middleware_1.validatePartyReportTagQuery, partyReportTag_controller_1.getPartyReportTags);
router.get("/:id/distributors", partyReportTag_controller_1.getTagDistributors);
router.put("/:id/distributors", partyReportTag_middleware_1.validateAssignPartiesToTag, partyReportTag_controller_1.assignPartiesToTag);
router.get("/:id", partyReportTag_controller_1.getPartyReportTagById);
router.put("/:id", partyReportTag_middleware_1.validateUpdatePartyReportTag, partyReportTag_controller_1.updatePartyReportTag);
router.delete("/:id", partyReportTag_controller_1.deletePartyReportTag);
exports.default = router;
//# sourceMappingURL=partyReportTag.route.js.map