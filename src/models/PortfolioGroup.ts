import mongoose from "mongoose";

export interface IPortfolioGroup extends mongoose.Document {
  name: string;
  user: mongoose.Types.ObjectId;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const PortfolioGroup = mongoose.model<IPortfolioGroup>("PortfolioGroup", portfolioGroupSchema);
export default PortfolioGroup;
