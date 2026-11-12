"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireGuard = exports.requireWarehouseManager = exports.requireSalesOfficer = exports.requireSuperAdmin = exports.requireAdminOrWarehouseOrPurchaser = exports.requireOrderCreator = exports.requireAdminOrWarehouseManagerNoMis = exports.requireAdminOrWarehouseOrSalesOfficer = exports.requireAdminOrWarehouseManager = exports.requireAdmin = exports.requireAdminOnly = exports.validateAccessToken = exports.validateChangePasswordForm = exports.validateUpdateProfileForm = exports.validateSigninForm = exports.validateSignupForm = void 0;
const signupForm_schema_1 = require("../libs/schemas/signupForm.schema");
const signinForm_schema_1 = require("../libs/schemas/signinForm.schema");
const updateProfileForm_schema_1 = require("../libs/schemas/updateProfileForm.schema");
const changePasswordForm_schema_1 = require("../libs/schemas/changePasswordForm.schema");
const zod_1 = __importDefault(require("zod"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function zodValidationResponse(res, error) {
    res.status(400).json({
        message: "Validation failed",
        errors: error.flatten().fieldErrors,
    });
}
const validateSignupForm = (req, res, next) => {
    try {
        signupForm_schema_1.SignupFormSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Signup Form Validation error:\n", error);
            zodValidationResponse(res, error);
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateSignupForm = validateSignupForm;
const validateSigninForm = (req, res, next) => {
    try {
        signinForm_schema_1.SigninFormSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Signin Form Validation error:\n", error);
            zodValidationResponse(res, error);
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateSigninForm = validateSigninForm;
const validateUpdateProfileForm = (req, res, next) => {
    try {
        updateProfileForm_schema_1.UpdateProfileFormSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Update profile validation error:\n", error);
            zodValidationResponse(res, error);
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateUpdateProfileForm = validateUpdateProfileForm;
const validateChangePasswordForm = (req, res, next) => {
    try {
        changePasswordForm_schema_1.ChangePasswordFormSchema.parse(req.body);
    }
    catch (error) {
        if (error instanceof zod_1.default.ZodError) {
            console.error("Change password validation error:\n", error);
            zodValidationResponse(res, error);
            return;
        }
        res.status(500).json({ message: "Internal server error" });
        return;
    }
    next();
};
exports.validateChangePasswordForm = validateChangePasswordForm;
const validateAccessToken = (req, res, next) => {
    // Dual-client: httpOnly cookie (web) or Authorization Bearer (native)
    const cookieToken = typeof req.cookies?.accessToken === "string"
        ? req.cookies.accessToken
        : undefined;
    const headerToken = req.headers["authorization"]?.split(" ")[1];
    const token = cookieToken || headerToken;
    if (!token) {
        res.status(401).json({ message: "Access token is missing" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);
        req.user = decoded;
    }
    catch (error) {
        res.status(401).json({ message: "Invalid token" });
        return;
    }
    next();
};
exports.validateAccessToken = validateAccessToken;
/** Admin portal roles including MIS (dashboard stays on requireAdminOnly). */
const ADMIN_PORTAL_TYPES = ["ADMIN", "SUPER_ADMIN", "MIS"];
/** Full admin only — used for dashboard APIs (no MIS). */
const requireAdminOnly = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminOnly = requireAdminOnly;
const requireAdmin = (req, res, next) => {
    const user = req.user;
    if (!user) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    if (!ADMIN_PORTAL_TYPES.includes(user.userType)) {
        res.status(403).json({ message: "Admin access required" });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
/** Read-only portal: admins and warehouse managers (e.g. sales returns list, customers list). */
const requireAdminOrWarehouseManager = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminOrWarehouseManager = requireAdminOrWarehouseManager;
/** Party-wise sales report: admin, warehouse manager, or sales officer (no MIS). */
const requireAdminOrWarehouseOrSalesOfficer = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminOrWarehouseOrSalesOfficer = requireAdminOrWarehouseOrSalesOfficer;
/** Party-wise sales targets: admin or warehouse manager (no MIS). */
const requireAdminOrWarehouseManagerNoMis = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminOrWarehouseManagerNoMis = requireAdminOrWarehouseManagerNoMis;
/** Order creation: admins, sales officers, and distributors (non-admins are scoped and forced to draft in controller). */
const requireOrderCreator = (req, res, next) => {
    const user = req.user;
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
exports.requireOrderCreator = requireOrderCreator;
/** Purchases / ops: admin, warehouse manager, or purchasing manager. */
const requireAdminOrWarehouseOrPurchaser = (req, res, next) => {
    const user = req.user;
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
exports.requireAdminOrWarehouseOrPurchaser = requireAdminOrWarehouseOrPurchaser;
const requireSuperAdmin = (req, res, next) => {
    const user = req.user;
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
exports.requireSuperAdmin = requireSuperAdmin;
const requireSalesOfficer = (req, res, next) => {
    const user = req.user;
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
exports.requireSalesOfficer = requireSalesOfficer;
const requireWarehouseManager = (req, res, next) => {
    const user = req.user;
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
exports.requireWarehouseManager = requireWarehouseManager;
const requireGuard = (req, res, next) => {
    const user = req.user;
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
exports.requireGuard = requireGuard;
//# sourceMappingURL=auth.middleware.js.map