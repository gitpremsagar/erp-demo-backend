import { Request, Response, NextFunction } from "express";
import {
  CreateOrderStatusTypeSchema,
  UpdateOrderStatusTypeSchema,
} from "../libs/schemas/orderStatusTypeForm.schema";
import z from "zod";

export const validateCreateOrderStatusType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateOrderStatusTypeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues.map((issue: z.ZodIssue) => issue.message).join("; ");
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderStatusType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderStatusTypeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues.map((issue: z.ZodIssue) => issue.message).join("; ");
      res.status(400).json({ message: msg });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};
