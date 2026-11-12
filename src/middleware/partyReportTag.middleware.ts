import { Request, Response, NextFunction } from "express";
import {
  CreatePartyReportTagSchema,
  UpdatePartyReportTagSchema,
  PartyReportTagQuerySchema,
  AssignPartiesToTagSchema,
} from "../libs/schemas/partyReportTagForm.schema";
import z from "zod";

export const validateCreatePartyReportTag = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    CreatePartyReportTagSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdatePartyReportTag = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdatePartyReportTagSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validatePartyReportTagQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    PartyReportTagQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateAssignPartiesToTag = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    AssignPartiesToTagSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};
