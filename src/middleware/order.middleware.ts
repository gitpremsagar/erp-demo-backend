import { Request, Response, NextFunction } from "express";
import {
  CreateOrderSchema,
  UpdateOrderSchema,
  UpdateDistributorDraftOrderSchema,
  AdminUpdateUnverifiedOrderSchema,
  UpdateOrderVehicleSchema,
  UpdateOrderDriverSchema,
  UpdateOrderDeliveryDateSchema,
  UpdateOrderStatusSchema,
  ApplyOrderDiscountSchema,
  UpdateOrderNarrationSchema,
  UpdateOrderTallyInvoiceSchema,
  UpdateOrderReceivingStatusSchema,
  UpdateOrderExcelMetaSchema,
  OrderQuerySchema,
} from "../libs/schemas/orderForm.schema";
import z from "zod";

export const validateCreateOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // console.log("Create Order Validation request body:\n", req.body);
    // CreateOrderSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Create Order Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateDistributorDraftOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateDistributorDraftOrderSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update distributor draft order validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateAdminUpdateUnverifiedOrder = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    AdminUpdateUnverifiedOrderSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Admin update unverified order validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderVehicle = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderVehicleSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Vehicle Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderDriver = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderDriverSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Driver Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderDeliveryDate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderDeliveryDateSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Delivery Date Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderStatus = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderStatusSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Status Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderNarration = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderNarrationSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Narration Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderTallyInvoice = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderTallyInvoiceSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Tally Invoice Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderExcelMeta = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    req.body = UpdateOrderExcelMetaSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Excel Meta Validation error:\n", error);
      res.status(400).json({ message: error.issues });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateOrderReceivingStatus = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateOrderReceivingStatusSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update Order Receiving Status Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateApplyOrderDiscount = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ApplyOrderDiscountSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Apply Order Discount Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateOrderQuery = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    OrderQuerySchema.parse(req.query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Order Query Validation error:\n", error);
      res.status(400).json({ message: error });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};
