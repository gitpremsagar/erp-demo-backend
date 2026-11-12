import { Request, Response, NextFunction } from "express";
import z from "zod";
import {
  CreateProductAllocationSchema,
  UpdateProductAllocationSchema,
  CreateFulfillmentSchema,
  UpdateFulfillmentSchema,
  ProductAllocationQuerySchema,
} from "./product-allocation.schema";

function handleZod(
  err: unknown,
  res: Response
): Response | undefined {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ message: err.issues });
  }
  return res.status(500).json({ message: "Internal server error" });
}

export const validateCreateProductAllocation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateProductAllocationSchema.parse(req.body);
  } catch (error) {
    return handleZod(error, res);
  }
  next();
};

export const validateUpdateProductAllocation = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateProductAllocationSchema.parse(req.body);
  } catch (error) {
    return handleZod(error, res);
  }
  next();
};

export const validateCreateFulfillment = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateFulfillmentSchema.parse(req.body);
  } catch (error) {
    return handleZod(error, res);
  }
  next();
};

export const validateUpdateFulfillment = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateFulfillmentSchema.parse(req.body);
  } catch (error) {
    return handleZod(error, res);
  }
  next();
};

export const validateProductAllocationQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = ProductAllocationQuerySchema.parse(req.query);
    (req as Request & { allocationQuery: typeof parsed }).allocationQuery = parsed;
  } catch (error) {
    return handleZod(error, res);
  }
  next();
};
