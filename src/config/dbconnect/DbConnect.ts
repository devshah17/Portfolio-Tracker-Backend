import mongoose from "mongoose";

export const DbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
  }
};