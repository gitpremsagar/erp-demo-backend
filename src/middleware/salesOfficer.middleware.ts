import { Request, Response, NextFunction } from "express";
import { CreateSalesOfficerSchema, UpdateSalesOfficerSchema, AssignDistributorSchema } from "../libs/schemas/salesOfficerForm.schema";
import z from "zod";

export const validateCreateSalesOfficer = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreateSalesOfficerSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create Sales Officer Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateSalesOfficer = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateSalesOfficerSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Sales Officer Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateAssignDistributor = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    AssignDistributorSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Assign Distributor Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};
