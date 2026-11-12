import { NextFunction, Request, Response } from "express";
import z from "zod";

const UpdateGuardPurchaseStatusSchema = z.discriminatedUnion("purchaseTransportStatus", [
  z.object({
    purchaseTransportStatus: z.literal("EXITED"),
  }),
  z.object({
    purchaseTransportStatus: z.literal("ARRIVED"),
    markedArrivedAt: z.coerce.date(),
    grnNumber: z.string().trim().min(1, "GRN number is required"),
  }),
]);

const UpdateGuardOrderDriverSchema = z.object({
  driverId: z.string().min(1, "driverId is required"),
});

const UpdateGuardOrderStatusSchema = z.object({
  orderStatusTypeId: z.string().min(1, "orderStatusTypeId is required"),
});

export const validateGuardPurchaseStatusUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateGuardPurchaseStatusSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateGuardOrderDriverUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateGuardOrderDriverSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};

export const validateGuardOrderStatusUpdate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateGuardOrderStatusSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
  next();
};
