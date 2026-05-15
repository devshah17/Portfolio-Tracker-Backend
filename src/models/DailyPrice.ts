import mongoose from "mongoose";

const dailyPriceSchema = new mongoose.Schema(
  {
    tickerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticker",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    price: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// We want to be able to quickly find the latest price for a ticker
dailyPriceSchema.index({ tickerId: 1, date: -1 });

// Enforce one record per ticker per day
dailyPriceSchema.index({ tickerId: 1, date: 1 }, { unique: true });

const DailyPrice = mongoose.model("DailyPrice", dailyPriceSchema);

export default DailyPrice;
