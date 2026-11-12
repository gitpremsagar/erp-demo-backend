import { Request, Response, NextFunction } from "express";
import {
  CreatePlantSchema,
  UpdatePlantSchema,
} from "../libs/schemas/plantForm.schema";
import z from "zod";

// Plant Middleware
export const validateCreatePlant = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreatePlantSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create Plant Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdatePlant = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdatePlantSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Plant Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

