import { Request, Response, NextFunction } from "express";
import { CreateSalesReturnSchema, UpdateSalesReturnSchema } from "./sales-return.schema";
import z from "zod";

export const validateCreateSalesReturn = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateSalesReturnSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdateSalesReturn = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateSalesReturnSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
