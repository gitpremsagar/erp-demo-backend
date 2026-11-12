import { Request, Response, NextFunction } from "express";
import { CreateProductGroupSchema, UpdateProductGroupSchema, ProductGroupQuerySchema } from "../libs/schemas/productGroupForm.schema";
import z from "zod";

export const validateCreateProductGroup = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateProductGroupSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create ProductGroup Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateProductGroup = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateProductGroupSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update ProductGroup Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateProductGroupQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ProductGroupQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("ProductGroup Query Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

