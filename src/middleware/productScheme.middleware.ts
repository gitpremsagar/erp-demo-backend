import { Request, Response, NextFunction } from "express";
import {
  CreateProductSchemeSchema,
  UpdateProductSchemeSchema,
  ProductSchemeQuerySchema,
} from "../libs/schemas/productScheme.schema";
import z from "zod";

export const validateCreateProductScheme = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateProductSchemeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create Product Scheme Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateProductScheme = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateProductSchemeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Product Scheme Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateProductSchemeQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ProductSchemeQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Product Scheme Query Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateToggleStatus = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schema = z.object({
      isActive: z.boolean(),
    });
    schema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Toggle Status Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

