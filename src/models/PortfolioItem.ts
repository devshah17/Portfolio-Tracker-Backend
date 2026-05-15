import mongoose from "mongoose";

export interface IPortfolioItem extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  ticker: mongoose.Types.ObjectId;
  buyingPrice: number;
  quantity: number;
  exchangeRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ticker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticker",
      required: true,
    },
    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    exchangeRate: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

const PortfolioItem = mongoose.model<IPortfolioItem>(
  "PortfolioItem",
  portfolioItemSchema,
);

export default PortfolioItem;
