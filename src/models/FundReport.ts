import mongoose from "mongoose";

export interface IFundHolding {
  ticker: string; // Used as the id for frontend maps
  name: string;
  industry?: string;
  quantity?: number;
  amount?: number;
  weight?: number;
}

export interface IFundReport extends mongoose.Document {
  mutualFundId: mongoose.Types.ObjectId;
  reportMonth: string; // e.g. "2023-10" or "01/10/2023"
  totalAUM?: number;
  data: IFundHolding[];
}

const fundHoldingSchema = new mongoose.Schema(
  {
    ticker: { type: String, required: true },
    name: { type: String, required: true },
    industry: { type: String },
    quantity: { type: Number },
    amount: { type: Number },
    weight: { type: Number },
  },
  { _id: false }
);

const fundReportSchema = new mongoose.Schema(
  {
    mutualFundId: { type: mongoose.Schema.Types.ObjectId, ref: "MutualFund", required: true },
    reportMonth: { type: String, required: true },
    totalAUM: { type: Number },
    data: [fundHoldingSchema],
  },
  { timestamps: true }
);

// Prevent duplicate reports for the same month per fund
fundReportSchema.index({ mutualFundId: 1, reportMonth: 1 }, { unique: true });

const FundReport = mongoose.model<IFundReport>("FundReport", fundReportSchema);
export default FundReport;
