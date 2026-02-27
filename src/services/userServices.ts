import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User";
import { sendMail } from "../utils/mail/sendMail";

type ServiceResult<T = any> = {
  message: string;
  data: T | null;
  verify?: boolean;
  active?: boolean;
};

const validateUser = (data: any): ServiceResult => {
  if (!data.name || typeof data.name !== "string") {
    return { message: "Name is required and must be a string", data: null };
  }
  if (!data.email || typeof data.email !== "string") {
    return { message: "Email is required and must be a string", data: null };
  }
  if (!data.password || typeof data.password !== "string") {
    return { message: "Password is required and must be a string", data: null };
  }
  if (!data.username || typeof data.username !== "string") {
    return { message: "Username is required and must be a string", data: null };
  }
  return { message: "User is valid", data };
};

const otpGenerator = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const otpExpiration = (): Date => {
  return new Date(Date.now() + 10 * 60 * 1000);
};

const getUser = async (
  identifier: string,
): Promise<ServiceResult<any>> => {
  try {
    const conditions: any[] = [
      { email: identifier },
      { username: identifier },
    ];

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      conditions.push({ _id: identifier });
    }

    if (conditions.length === 0) {
      return { message: "User not found", data: null };
    }

    const user = await User.findOne({ $or: conditions });
    if (!user) {
      return { message: "User not found", data: null };
    }
    return { message: "User found", data: user };
  } catch (error) {
    console.log("Error getting user:", error);
    return { message: "Failed to get user", data: null };
  }
};

const otpVerification = async (
  email: string,
  otp: string,
): Promise<ServiceResult<any>> => {
  const { message, data: user } = await getUser(email);
  if (message !== "User found" || !user) {
    return { message: "User not found", data: null };
  }

  if (String(user.otp) !== String(otp)) {
    return { message: "Invalid OTP", data: null };
  }

  if (user.otpExpiry < Date.now()) {
    return { message: "OTP expired", data: null };
  }

  user.isVerified = true;
  user.isActive = true;
  user.otp = null;
  user.otpExpiry = null;
  await user.save();

  return { message: "OTP verified", data: user };
};

export const signUp = async (userData: any): Promise<ServiceResult<any>> => {
  try {
    const validation = validateUser(userData);
    if (validation.message !== "User is valid") {
      return { message: validation.message, data: null };
    }

    const { message: emailCheckMessage, data: existingUser } = await getUser(
      userData.email,
    );
    if (emailCheckMessage === "User found" && existingUser) {
      return { message: "User already exists", data: null };
    }

    const {
      message: usernameCheckMessage,
      data: existingUserByUsername,
    } = await getUser(userData.username);
    if (usernameCheckMessage === "User found" && existingUserByUsername) {
      return { message: "Username already exists", data: null };
    }

    const otp = otpGenerator();
    const otpExpiry = otpExpiration();
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await User.create({
      ...userData,
      password: hashedPassword,
      otp,
      otpExpiry,
    });

    try {
      await sendMail({
        subject: "OTP Verification - Portfolio Tracker",
        to: user.email,
        templateName: "OTP",
        replacements: { name: user.name, otp },
        body: "",
        consoleMessage: `OTP email sent to ${user.email}`,
      });
    } catch (emailError) {
      console.log("Error sending OTP email:", emailError);
    }

    return { message: "User created successfully", data: user };
  } catch (error) {
    console.log("Error creating user:", error);
    return { message: "Failed to create user", data: null };
  }
};

export const getAllUsers = async (): Promise<ServiceResult<any[]>> => {
  try {
    const users = await User.find();
    return { message: "Users fetched successfully", data: users };
  } catch (error) {
    console.log("Error fetching users:", error);
    return { message: "Failed to fetch users", data: null };
  }
};

export const getUserService = getUser;

export const verifyOtp = async (
  email: string,
  otp: string,
  forgotPassword = false,
): Promise<ServiceResult<any>> => {
  try {
    const { message, data } = await otpVerification(email, otp);
    if (message !== "OTP verified" || !data) {
      return { message, data: null };
    }

    if (forgotPassword) {
      return { message: "OTP verified", data: { user: data } };
    }

    const token = jwt.sign(
      { userId: data._id },
      process.env.JWT_SECRET as string,
    );
    return { message: "OTP verified", data: { user: data, token } };
  } catch (error) {
    console.log("Error verifying OTP:", error);
    return { message: "Failed to verify OTP", data: null };
  }
};

export const login = async (
  identifier: string,
  password: string,
): Promise<ServiceResult<any>> => {
  try {
    const { message, data: user } = await getUser(identifier);
    if (message !== "User found" || !user) {
      return { message: "User not found", data: null };
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return { message: "Invalid password", data: null };
    }

    if (!user.isVerified || !user.isActive) {
      const otp = otpGenerator();
      const otpExpiry = otpExpiration();

      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();

      try {
        await sendMail({
          subject: "OTP Verification - Portfolio Tracker",
          to: user.email,
          templateName: "OTP",
          replacements: { name: user.name, otp },
          body: "",
          consoleMessage: `OTP email sent to ${user.email}`,
        });
      } catch (emailError) {
        console.log("Error sending OTP email:", emailError);
      }

      if (!user.isVerified) {
        return {
          message: "User not verified. OTP has been sent to your email.",
          data: null,
          verify: false,
        };
      }
      if (!user.isActive) {
        return {
          message: "User is not active. OTP has been sent to your email.",
          data: null,
          active: false,
        };
      }
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
    );
    return { message: "User logged in successfully", data: { user, token } };
  } catch (error) {
    console.log("Error logging in:", error);
    return { message: "Failed to login", data: null };
  }
};

export const forgotPassword = async (
  email: string,
): Promise<ServiceResult<null>> => {
  try {
    if (!email) {
      return { message: "Email is required", data: null };
    }

    const { message: userCheckMessage, data: user } = await getUser(email);
    if (userCheckMessage !== "User found" || !user) {
      return { message: "User not found", data: null };
    }

    const otp = otpGenerator();
    const otpExpiry = otpExpiration();

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    try {
      await sendMail({
        subject: "Password Reset OTP - Portfolio Tracker",
        to: user.email,
        templateName: "OTP",
        replacements: { name: user.name, otp },
        body: "",
        consoleMessage: `Password reset OTP email sent to ${user.email}`,
      });
    } catch (emailError) {
      console.log("Error sending OTP email:", emailError);
      return { message: "Failed to send OTP email", data: null };
    }

    return { message: "OTP has been sent to your email", data: null };
  } catch (error) {
    console.log("Error in forgot password:", error);
    return {
      message: "Failed to process forgot password request",
      data: null,
    };
  }
};

export const resetPassword = async (
  email: string,
  newPassword: string,
): Promise<ServiceResult<null>> => {
  try {
    if (!email || !newPassword) {
      return {
        message: "Email and new password are required",
        data: null,
      };
    }

    const { message: userCheckMessage, data: user } = await getUser(email);
    if (userCheckMessage !== "User found" || !user) {
      return { message: "User not found", data: null };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return { message: "Password reset successfully", data: null };
  } catch (error) {
    console.log("Error in reset password:", error);
    return { message: "Failed to reset password", data: null };
  }
};

export const updateUser = async (
  userId: string,
  updateData: any,
): Promise<ServiceResult<any>> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { message: "Invalid user ID", data: null };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { message: "User not found", data: null };
    }

    if (updateData.email && updateData.email !== user.email) {
      const { message, data: existingUser } = await getUser(updateData.email);
      if (
        message === "User found" &&
        existingUser &&
        existingUser._id.toString() !== userId
      ) {
        return { message: "Email already in use", data: null };
      }
    }

    const allowedFields = ["name", "email"];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        (user as any)[field] = updateData[field];
      }
    });

    await user.save();

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      isVerified: user.isVerified,
      isActive: user.isActive,
    };

    return { message: "User updated successfully", data: userResponse };
  } catch (error) {
    console.log("Error updating user:", error);
    return { message: "Failed to update user", data: null };
  }
};
