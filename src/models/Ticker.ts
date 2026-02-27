import mongoose from "mongoose";

export type TickerType = "Stock" | "MF";

const tickerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tickerName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["Stock", "MF"],
      required: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
    },
    market: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

const Ticker = mongoose.model("Ticker", tickerSchema);

export default Ticker;

