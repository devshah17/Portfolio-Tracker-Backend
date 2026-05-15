import mongoose from "mongoose";

export interface ITransaction extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  ticker: mongoose.Types.ObjectId;
  type: "BUY" | "SELL";
  date: Date;
  quantity: number;
  price: number;
  exchangeRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    exchangeRate: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);

export default Transaction;
