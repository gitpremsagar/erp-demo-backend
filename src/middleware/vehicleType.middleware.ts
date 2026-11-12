import { Request, Response, NextFunction } from "express";
import {
  CreateVehicleTypeSchema,
  UpdateVehicleTypeSchema,
} from "../libs/schemas/vehicleTypeForm.schema";
import z from "zod";

export const validateCreateVehicleType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateVehicleTypeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create Vehicle Type Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateVehicleType = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateVehicleTypeSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Vehicle Type Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};
