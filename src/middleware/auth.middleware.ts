import { Request, Response, NextFunction } from "express";
import { SignupFormSchema } from "../libs/schemas/signupForm.schema";
import { SigninFormSchema } from "../libs/schemas/signinForm.schema";
import { UpdateProfileFormSchema } from "../libs/schemas/updateProfileForm.schema";
import { ChangePasswordFormSchema } from "../libs/schemas/changePasswordForm.schema";
import z from "zod";
import jwt, { JwtPayload } from "jsonwebtoken";

//extending default Request type to define type of custom req.user data
export interface AuthenticatedRequest extends Request {
  user?: string | JwtPayload;
}

function zodValidationResponse(res: Response, error: z.ZodError) {
  res.status(400).json({
    message: "Validation failed",
    errors: error.flatten().fieldErrors,
  });
}

export const validateSignupForm = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    SignupFormSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Signup Form Validation error:\n", error);
      zodValidationResponse(res, error);
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateSigninForm = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    SigninFormSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Signin Form Validation error:\n", error);
      zodValidationResponse(res, error);
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateUpdateProfileForm = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    UpdateProfileFormSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Update profile validation error:\n", error);
      zodValidationResponse(res, error);
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateChangePasswordForm = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    ChangePasswordFormSchema.parse(req.body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Change password validation error:\n", error);
      zodValidationResponse(res, error);
      return;
    }
    res.status(500).json({ message: "Internal server error" });
    return;
  }
  next();
};

export const validateAccessToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Dual-client: httpOnly cookie (web) or Authorization Bearer (native)
  const cookieToken =
    typeof req.cookies?.accessToken === "string"
      ? req.cookies.accessToken
      : undefined;
  const headerToken = req.headers["authorization"]?.split(" ")[1];
  const token = cookieToken || headerToken;

  if (!token) {
    res.status(401).json({ message: "Access token is missing" });
    return;
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET!);
    req.user = decoded;
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  next();
};

/** Admin portal roles including MIS (dashboard stays on requireAdminOnly). */
const ADMIN_PORTAL_TYPES = ["ADMIN", "SUPER_ADMIN", "MIS"] as const;

/** Full admin only — used for dashboard APIs (no MIS). */
export const requireAdminOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = ["ADMIN", "SUPER_ADMIN"];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (!(ADMIN_PORTAL_TYPES as readonly string[]).includes(user.userType)) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};

/** Read-only portal: admins and warehouse managers (e.g. sales returns list, customers list). */
export const requireAdminOrWarehouseManager = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = ["ADMIN", "SUPER_ADMIN", "MIS", "WAREHOUSE_MANAGER"];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  next();
};

/** Party-wise sales report: admin, warehouse manager, or sales officer (no MIS). */
export const requireAdminOrWarehouseOrSalesOfficer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = [
    "ADMIN",
    "SUPER_ADMIN",
    "WAREHOUSE_MANAGER",
    "SALES_OFFICER",
  ];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  next();
};

/** Party-wise sales targets: admin or warehouse manager (no MIS). */
export const requireAdminOrWarehouseManagerNoMis = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = ["ADMIN", "SUPER_ADMIN", "WAREHOUSE_MANAGER"];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  next();
};

/** Order creation: admins, sales officers, and distributors (non-admins are scoped and forced to draft in controller). */
export const requireOrderCreator = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = ["ADMIN", "SUPER_ADMIN", "MIS", "SALES_OFFICER", "CUSTOMER"];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  next();
};

/** Purchases / ops: admin, warehouse manager, or purchasing manager. */
export const requireAdminOrWarehouseOrPurchaser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const allowedTypes = [
    "ADMIN",
    "SUPER_ADMIN",
    "MIS",
    "WAREHOUSE_MANAGER",
    "PURCHASING_MANAGER",
  ];
  if (!allowedTypes.includes(user.userType)) {
    res.status(403).json({ message: "Access denied" });
    return;
  }

  next();
};

export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (user.userType !== "SUPER_ADMIN") {
    res.status(403).json({ message: "Super Admin access required" });
    return;
  }

  next();
};

export const requireSalesOfficer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (user.userType !== "SALES_OFFICER") {
    res.status(403).json({ message: "Sales officer access required" });
    return;
  }

  next();
};

export const requireWarehouseManager = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (user.userType !== "WAREHOUSE_MANAGER") {
    res.status(403).json({ message: "Warehouse manager access required" });
    return;
  }

  next();
};

export const requireGuard = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as any;

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (user.userType !== "GUARD") {
    res.status(403).json({ message: "Guard access required" });
    return;
  }

  next();
};
