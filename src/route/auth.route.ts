import express from "express";
import {
  signup,
  signin,
  signout,
  refreshAccessToken,
  decodeAccessToken,
  getUserProfile,
  updateProfile,
  changePassword,
} from "../controller/auth.controller";
import {
  validateSignupForm,
  validateSigninForm,
  validateAccessToken,
  validateUpdateProfileForm,
  validateChangePasswordForm,
} from "../middleware/auth.middleware";
const router = express.Router();

router.post("/sign-up", validateSignupForm, signup);

router.post("/log-in", validateSigninForm, signin);

router.post("/log-out", signout);

router.post("/decode-access-token", validateAccessToken, decodeAccessToken);

router.get("/profile", validateAccessToken, getUserProfile);

router.patch("/profile", validateAccessToken, validateUpdateProfileForm, updateProfile);

router.post("/refresh-access-token", refreshAccessToken);

router.post("/change-password", validateAccessToken, validateChangePasswordForm, changePassword);

export default router;
