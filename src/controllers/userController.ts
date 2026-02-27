import { Request, Response } from "express";
import {
  signUp,
  getAllUsers,
  getUserService,
  verifyOtp,
  login,
  forgotPassword,
  resetPassword,
  updateUser,
} from "../services/userServices";

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, username } = req.body;
    const { message, data } = await signUp({ name, email, password, username });

    if (message !== "User created successfully") {
      return res.status(400).json({ message });
    }

    return res.status(201).json({ message, data });
  } catch (error: any) {
    console.log("Error creating user:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getAllUsersController = async (req: Request, res: Response) => {
  try {
    const { message, data } = await getAllUsers();
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error fetching users:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getUserController = async (req: Request, res: Response) => {
  try {
    const identifier = req.body?.identifier || req.body?.email || req.body?.username;
    const { message, data } = await getUserService(identifier);
    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error getting user:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const { email, otp, forgotPassword: forgotPasswordFlag } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const { message, data } = await verifyOtp(email, otp, forgotPasswordFlag);

    if (message !== "OTP verified") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error verifying OTP:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res
        .status(400)
        .json({ message: "Email/Username and password are required" });
    }

    const { message, data, verify, active } = await login(name, password);

    if (verify === false || active === false) {
      return res.status(403).json({ message, verify, active });
    }

    if (message !== "User logged in successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error logging in:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const forgotPasswordController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const { message } = await forgotPassword(email);

    if (message === "User not found") {
      return res.status(404).json({ message });
    }

    if (message !== "OTP has been sent to your email") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message });
  } catch (error: any) {
    console.log("Error in forgot password:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const resetPasswordController = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email and new password are required" });
    }

    const { message } = await resetPassword(email, newPassword);

    if (message === "User not found") {
      return res.status(404).json({ message });
    }

    if (message === "Invalid OTP" || message === "OTP expired") {
      return res.status(400).json({ message });
    }

    if (message !== "Password reset successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message });
  } catch (error: any) {
    console.log("Error in reset password:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const updateUserController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { message, data } = await updateUser(userId, req.body);

    if (message !== "User updated successfully") {
      return res.status(400).json({ message });
    }

    return res.status(200).json({ message, data });
  } catch (error: any) {
    console.log("Error updating user:", error);
    return res.status(500).json({ message: error.message });
  }
};

