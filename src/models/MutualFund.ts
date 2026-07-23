import mongoose from "mongoose";

export interface IMutualFund extends mongoose.Document {
  name: string;
  amc: string;
  category: string;
  user: mongoose.Types.ObjectId;
}

const mutualFundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amc: { type: String, required: true },
    category: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const MutualFund = mongoose.model<IMutualFund>("MutualFund", mutualFundSchema);
export default MutualFund;
