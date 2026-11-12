import { Request, Response, NextFunction } from "express";
import {
  CreateDispatchTripSchema,
  CreatePendingDistributorSchema,
  UpdatePendingDistributorSchema,
  UpdateDispatchTripSchema,
} from "./dispatch-trip.schema";
import z from "zod";

export const validateCreateDispatchTrip = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreateDispatchTripSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateCreatePendingDistributor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = CreatePendingDistributorSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdatePendingDistributor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdatePendingDistributorSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateUpdateDispatchTrip = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateDispatchTripSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
