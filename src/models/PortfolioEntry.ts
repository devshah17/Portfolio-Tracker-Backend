import mongoose from "mongoose";

export interface IPortfolioEntry extends mongoose.Document {
  portfolioGroup: mongoose.Types.ObjectId;
  portfolioItem: mongoose.Types.ObjectId;
}

const portfolioEntrySchema = new mongoose.Schema(
  {
    portfolioGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortfolioGroup",
      required: true,
    },
    portfolioItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortfolioItem",
      required: true,
    },
  },
  { timestamps: true }
);

// One asset can only appear once per portfolio
portfolioEntrySchema.index({ portfolioGroup: 1, portfolioItem: 1 }, { unique: true });

const PortfolioEntry = mongoose.model<IPortfolioEntry>("PortfolioEntry", portfolioEntrySchema);
export default PortfolioEntry;
