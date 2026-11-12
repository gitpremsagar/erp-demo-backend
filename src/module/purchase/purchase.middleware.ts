import { Request, Response, NextFunction } from "express";
import {
  CreatePurchaseSchema,
  CreatePurchasesBulkSchema,
  UpdatePurchaseSchema,
  UpdatePurchaseStatusSchema,
  UpdatePurchaseTargetUnloadingSchema,
  UpdatePurchaseManualDatetimesSchema,
  UpdatePurchaseGrnSchema,
} from "./purchase.schema";
import z from "zod";

export const validateCreatePurchase = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // console.log("req.body", req.body);
    req.body = CreatePurchaseSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // console.log("error", error);
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePurchase = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePurchaseSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateCreatePurchasesBulk = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreatePurchasesBulkSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePurchaseStatus = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePurchaseStatusSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePurchaseTargetUnloading = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePurchaseTargetUnloadingSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePurchaseManualDatetimes = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePurchaseManualDatetimesSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePurchaseGrn = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePurchaseGrnSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
