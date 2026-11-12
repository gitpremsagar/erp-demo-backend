import { Request, Response, NextFunction } from "express";
import z from "zod";
import { CreateCreditNoteSchema, UpdateCreditNoteSchema } from "./credit-note.schema";

export const validateCreateCreditNote = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateCreditNoteSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdateCreditNote = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateCreditNoteSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
