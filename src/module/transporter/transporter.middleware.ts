import { Request, Response, NextFunction } from "express";
import {
  CreateTransporterSchema,
  UpdateTransporterSchema,
} from "./transporter.schema";
import z from "zod";

export const validateCreateTransporter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateTransporterSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdateTransporter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateTransporterSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
