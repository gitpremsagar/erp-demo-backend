import express from "express";
import {
  createPartyReportTag,
  getPartyReportTags,
  getPartyReportTagById,
  updatePartyReportTag,
  deletePartyReportTag,
  getTagDistributors,
  assignPartiesToTag,
} from "../controller/partyReportTag.controller";
import {
  validateCreatePartyReportTag,
  validateUpdatePartyReportTag,
  validatePartyReportTagQuery,
  validateAssignPartiesToTag,
} from "../middleware/partyReportTag.middleware";
import {
  validateAccessToken,
  requireAdmin,
} from "../middleware/auth.middleware";

const router = express.Router();

router.use(validateAccessToken, requireAdmin);

router.post("/", validateCreatePartyReportTag, createPartyReportTag);
router.get("/", validatePartyReportTagQuery, getPartyReportTags);
router.get("/:id/distributors", getTagDistributors);
router.put("/:id/distributors", validateAssignPartiesToTag, assignPartiesToTag);
router.get("/:id", getPartyReportTagById);
router.put("/:id", validateUpdatePartyReportTag, updatePartyReportTag);
router.delete("/:id", deletePartyReportTag);

export default router;
