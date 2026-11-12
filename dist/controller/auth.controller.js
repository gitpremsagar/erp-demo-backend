"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.updateProfile = exports.getUserProfile = exports.decodeAccessToken = exports.refreshAccessToken = exports.signout = exports.signin = exports.signup = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
function hashRefreshToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
async function createRefreshSession(userId, refreshToken, expiresInSeconds) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return prisma_1.prisma.refreshSession.create({
        data: {
            userId,
            tokenHash: hashRefreshToken(refreshToken),
            expiresAt,
        },
    });
}
async function findValidRefreshSession(refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await prisma_1.prisma.refreshSession.findFirst({
        where: { tokenHash },
    });
    if (!session)
        return null;
    if (session.expiresAt.getTime() < Date.now()) {
        await prisma_1.prisma.refreshSession
            .delete({ where: { id: session.id } })
            .catch(() => undefined);
        return null;
    }
    return session;
}
async function rotateRefreshSession(oldRefreshToken, userId, newRefreshToken, expiresInSeconds) {
    const oldHash = hashRefreshToken(oldRefreshToken);
    await prisma_1.prisma.refreshSession.deleteMany({ where: { tokenHash: oldHash } });
    return createRefreshSession(userId, newRefreshToken, expiresInSeconds);
}
async function revokeRefreshSession(refreshToken) {
    if (!refreshToken)
        return;
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma_1.prisma.refreshSession.deleteMany({ where: { tokenHash } });
}
function cookieOptions(isProduction, maxAge) {
    const shouldSetDomain = isProduction &&
        !!process.env.COOKIE_DOMAIN &&
        process.env.COOKIE_DOMAIN.trim() !== "";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
        ...(shouldSetDomain ? { domain: process.env.COOKIE_DOMAIN.trim() } : {}),
        ...(maxAge !== undefined ? { maxAge } : {}),
    };
}
function resolveRefreshToken(req) {
    // Prefer httpOnly cookie (web); body fallback for native apps
    const fromCookie = req.cookies?.refreshToken;
    if (typeof fromCookie === "string" && fromCookie.trim()) {
        return fromCookie;
    }
    const fromBody = req.body?.refreshToken;
    if (typeof fromBody === "string" && fromBody.trim()) {
        return fromBody;
    }
    return undefined;
}
const signup = async (req, res) => {
    const { email, password, name, phone, } = req.body;
    //check if user already exists
    const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
    }
    // Hash the password
    const hashedPassword = await bcrypt_1.default.hash(password, +process.env.BCRYPT_SALT_ROUNDS);
    try {
        // Public signup always creates CUSTOMER. Elevated roles use /api/employees.
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone,
                userType: "CUSTOMER",
            }
        });
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        // Send response
        res.status(201).json({
            message: "User created successfully",
            user: userWithoutPassword
        });
        return;
    }
    catch (error) {
        console.error("Error creating user:\n", error);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
};
exports.signup = signup;
const signin = async (req, res) => {
    // console.log("signin");
    const { email, password } = req.body;
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        include: {
            CustomerDetail: true,
        },
    });
    if (!user) {
        // console.log("User not found");
        return res.status(404).json({ message: "Invalid email or password" });
    }
    const isValidPassword = await bcrypt_1.default.compare(password, user.password);
    if (!isValidPassword) {
        // console.log("Invalid password");
        return res.status(401).json({ message: "Invalid email or password" });
    }
    // Remove password from user data
    const { password: _, ...userWithoutPassword } = user;
    const userData = {
        id: userWithoutPassword.id,
        email: userWithoutPassword.email,
        name: userWithoutPassword.name,
        phone: userWithoutPassword.phone,
        userType: userWithoutPassword.userType,
        CustomerDetail: userWithoutPassword.CustomerDetail,
    };
    // Generate JWT tokens
    const accessToken = jsonwebtoken_1.default.sign({ ...userData }, process.env.ACCESS_TOKEN_JWT_SECRET, { expiresIn: +process.env.ACCESS_TOKEN_JWT_EXPIRY });
    const refreshExpiry = +process.env.REFRESH_TOKEN_JWT_EXPIRY;
    const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.REFRESH_TOKEN_JWT_SECRET, { expiresIn: refreshExpiry });
    await createRefreshSession(user.id, refreshToken, refreshExpiry);
    const isProduction = process.env.NODE_ENV === "production";
    const options = cookieOptions(isProduction);
    res
        .cookie("refreshToken", refreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json({ accessToken, refreshToken, user: userData });
    return;
};
exports.signin = signin;
const signout = async (req, res) => {
    const refreshToken = resolveRefreshToken(req);
    await revokeRefreshSession(refreshToken);
    const isProduction = process.env.NODE_ENV === "production";
    const options = cookieOptions(isProduction, 0);
    res
        .status(200)
        .cookie("refreshToken", "", options)
        .cookie("accessToken", "", options)
        .json({ success: true, message: "Logged out successfully" });
    return;
};
exports.signout = signout;
const refreshAccessToken = async (req, res) => {
    const refreshToken = resolveRefreshToken(req);
    if (!refreshToken) {
        console.log("Refreshing access token failed: Refresh token is missing");
        return res.status(401).json({ message: "Refresh token is missing" });
    }
    try {
        const session = await findValidRefreshSession(refreshToken);
        if (!session) {
            return res.status(401).json({ message: "Invalid or revoked refresh token" });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_JWT_SECRET);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                CustomerDetail: true,
            },
        });
        if (!user) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }
        const { password: _, ...userWithoutPassword } = user;
        const userData = {
            id: userWithoutPassword.id,
            email: userWithoutPassword.email,
            name: userWithoutPassword.name,
            phone: userWithoutPassword.phone,
            userType: userWithoutPassword.userType,
            CustomerDetail: userWithoutPassword.CustomerDetail,
        };
        const accessToken = jsonwebtoken_1.default.sign({ ...userData }, process.env.ACCESS_TOKEN_JWT_SECRET, { expiresIn: +process.env.ACCESS_TOKEN_JWT_EXPIRY });
        const refreshExpiry = +process.env.REFRESH_TOKEN_JWT_EXPIRY;
        const newRefreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.REFRESH_TOKEN_JWT_SECRET, { expiresIn: refreshExpiry });
        await rotateRefreshSession(refreshToken, user.id, newRefreshToken, refreshExpiry);
        const isProduction = process.env.NODE_ENV === "production";
        const options = cookieOptions(isProduction);
        res
            .status(200)
            .cookie("refreshToken", newRefreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json({ accessToken, refreshToken: newRefreshToken, user: userData });
        return;
    }
    catch (error) {
        if (error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError") {
            console.log("Error while refreshing access token\n", error);
            return res
                .status(401)
                .json({ message: "Invalid or expired refresh token" });
        }
        console.error("Error refreshing access token:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.refreshAccessToken = refreshAccessToken;
const decodeAccessToken = async (req, res) => {
    try {
        // Get fresh user data from database
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                CustomerDetail: {
                    select: {
                        dbCategory: true,
                        dbName: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    }
    catch (error) {
        console.error("Error decoding access token:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.decodeAccessToken = decodeAccessToken;
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                CustomerDetail: true,
            },
        });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    }
    catch (error) {
        console.error("Error getting user profile:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getUserProfile = getUserProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, email } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone || null;
        if (email !== undefined) {
            const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
            if (existing && existing.id !== userId) {
                return res.status(409).json({ message: "Email already in use" });
            }
            updateData.email = email;
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: { CustomerDetail: true },
        });
        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    }
    catch (error) {
        console.error("Error updating profile:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateProfile = updateProfile;
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isValid = await bcrypt_1.default.compare(oldPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, +process.env.BCRYPT_SALT_ROUNDS);
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        res.json({ message: "Password updated successfully" });
    }
    catch (error) {
        console.error("Error changing password:\n", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.changePassword = changePassword;
//# sourceMappingURL=auth.controller.js.map