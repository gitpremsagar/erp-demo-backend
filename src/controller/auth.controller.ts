import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createRefreshSession(
  userId: string,
  refreshToken: string,
  expiresInSeconds: number
) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  return prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
  });
}

async function findValidRefreshSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await prisma.refreshSession.findFirst({
    where: { tokenHash },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.refreshSession
      .delete({ where: { id: session.id } })
      .catch(() => undefined);
    return null;
  }
  return session;
}

async function rotateRefreshSession(
  oldRefreshToken: string,
  userId: string,
  newRefreshToken: string,
  expiresInSeconds: number
) {
  const oldHash = hashRefreshToken(oldRefreshToken);
  await prisma.refreshSession.deleteMany({ where: { tokenHash: oldHash } });
  return createRefreshSession(userId, newRefreshToken, expiresInSeconds);
}

async function revokeRefreshSession(refreshToken: string | undefined) {
  if (!refreshToken) return;
  const tokenHash = hashRefreshToken(refreshToken);
  await prisma.refreshSession.deleteMany({ where: { tokenHash } });
}

function cookieOptions(isProduction: boolean, maxAge?: number) {
  const shouldSetDomain =
    isProduction &&
    !!process.env.COOKIE_DOMAIN &&
    process.env.COOKIE_DOMAIN.trim() !== "";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    ...(shouldSetDomain ? { domain: process.env.COOKIE_DOMAIN!.trim() } : {}),
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function resolveRefreshToken(req: Request): string | undefined {
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

export const signup = async (req: Request, res: Response) => {
  const {
    email,
    password,
    name,
    phone,
  } = req.body;

  //check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ message: "User already exists" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(
    password,
    +process.env.BCRYPT_SALT_ROUNDS!
  );

  try {
    // Public signup always creates CUSTOMER. Elevated roles use /api/employees.
    const user = await prisma.user.create({
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
  } catch (error) {
    console.error("Error creating user:\n", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};

export const signin = async (req: Request, res: Response) => {
  // console.log("signin");
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      CustomerDetail: true,
    },
  });
  if (!user) {
    // console.log("User not found");
    return res.status(404).json({ message: "Invalid email or password" });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
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
  const accessToken = jwt.sign(
    { ...userData },
    process.env.ACCESS_TOKEN_JWT_SECRET!,
    { expiresIn: +process.env.ACCESS_TOKEN_JWT_EXPIRY! }
  );
  const refreshExpiry = +process.env.REFRESH_TOKEN_JWT_EXPIRY!;
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_TOKEN_JWT_SECRET!,
    { expiresIn: refreshExpiry }
  );

  await createRefreshSession(user.id, refreshToken, refreshExpiry);

  const isProduction = process.env.NODE_ENV === "production";
  const options = cookieOptions(isProduction);

  res
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json({ accessToken, refreshToken, user: userData });
  return;
};

export const signout = async (req: Request, res: Response) => {
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

export const refreshAccessToken = async (req: Request, res: Response) => {
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

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_JWT_SECRET!
    ) as { userId: string };

    const user = await prisma.user.findUnique({
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

    const accessToken = jwt.sign(
      { ...userData },
      process.env.ACCESS_TOKEN_JWT_SECRET!,
      { expiresIn: +process.env.ACCESS_TOKEN_JWT_EXPIRY! }
    );

    const refreshExpiry = +process.env.REFRESH_TOKEN_JWT_EXPIRY!;
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_JWT_SECRET!,
      { expiresIn: refreshExpiry }
    );

    await rotateRefreshSession(
      refreshToken,
      user.id,
      newRefreshToken,
      refreshExpiry
    );

    const isProduction = process.env.NODE_ENV === "production";
    const options = cookieOptions(isProduction);

    res
      .status(200)
      .cookie("refreshToken", newRefreshToken, options)
      .cookie("accessToken", accessToken, options)
      .json({ accessToken, refreshToken: newRefreshToken, user: userData });
    return;
  } catch (error: any) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      console.log("Error while refreshing access token\n", error);
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }
    console.error("Error refreshing access token:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const decodeAccessToken = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: (req.user as any).id },
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
  } catch (error) {
    console.error("Error decoding access token:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = (req.user as any).id;

    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error("Error getting user profile:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const updateProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = (req.user as any).id;
    const { name, phone, email } = req.body;

    const updateData: { name?: string; phone?: string | null; email?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "Email already in use" });
      }
      updateData.email = email;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { CustomerDetail: true },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Error updating profile:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = (req.user as any).id;
    const { oldPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      +process.env.BCRYPT_SALT_ROUNDS!
    );

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:\n", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
