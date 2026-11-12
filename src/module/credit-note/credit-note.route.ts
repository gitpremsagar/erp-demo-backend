import express from "express";
import {
  createCreditNote,
  getCreditNotes,
  getCreditNoteById,
  updateCreditNote,
  deleteCreditNote,
} from "./credit-note.controller";
import { validateCreateCreditNote, validateUpdateCreditNote } from "./credit-note.middleware";
import {
  validateAccessToken,
  requireAdmin,
  requireAdminOrWarehouseManager,
} from "../../middleware/auth.middleware";

const router = express.Router();

router.post("/", validateAccessToken, requireAdmin, validateCreateCreditNote, createCreditNote);
router.get("/", validateAccessToken, requireAdminOrWarehouseManager, getCreditNotes);
router.get("/:id", validateAccessToken, requireAdminOrWarehouseManager, getCreditNoteById);
router.patch(
  "/:id",
  validateAccessToken,
  requireAdmin,
  validateUpdateCreditNote,
  updateCreditNote
);
router.delete("/:id", validateAccessToken, requireAdmin, deleteCreditNote);

export default router;
