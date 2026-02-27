import { Router } from "express";
import {
  createUser,
  getAllUsersController,
  getUserController,
  verifyOtpController,
  loginController,
  forgotPasswordController,
  resetPasswordController,
  updateUserController,
} from "../controllers/userController";
import { authenticateToken } from "../utils/middlewares/authentication";

const router = Router();

router.post("/create", createUser);
router.get("/all", getAllUsersController);
router.post("/get", getUserController);
router.post("/verify-otp", verifyOtpController);
router.post("/login", loginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);
router.put("/update", authenticateToken, updateUserController);

export default router;

